import { readFile, readdir, stat, open } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { SessionService } from './SessionService';
import { IProjectRepository } from '../../domain/repositories/IProjectRepository';

// ── Types ────────────────────────────────────────────────────

export interface TextEntry {
  timestamp: number;
  text: string;
  source: 'assistant' | 'user';
}

export interface StuckSignal {
  silentDurationMs: number;
  toolCallsSinceLastText: number;
  warning: string;
}

export interface TextOnlyDigest {
  sessionId: string;
  workerName?: string;
  taskIds: string[];
  state: 'active' | 'idle' | 'needs_input';
  entries: TextEntry[];
  stuck: StuckSignal | null;
  lastActivityTimestamp: number;
}

// ── Internal cache type ──────────────────────────────────────

interface PathCacheEntry {
  path: string;
  resolvedAt: number;
}

const PATH_CACHE_TTL_MS = 60_000; // 60s
const TAIL_BYTES = 100 * 1024;    // 100KB tail
const MAX_TEXT_LENGTH = 150;

// ── Tags & patterns to filter out ────────────────────────────

const NOISE_TAG_PATTERNS = [
  /<system-reminder>/,
  /<local-command>/,
  /<local-command-caveat>/,
  /<teammate-message/,
];

const SESSION_ID_REGEX = /<session_id>(sess_[^<]+)<\/session_id>/;

/**
 * Stateless, on-demand service for reading Claude session JSONL logs
 * and producing text-only digests for coordinator observation.
 */
export class LogDigestService {
  private pathCache = new Map<string, PathCacheEntry>();

  constructor(
    private sessionService: SessionService,
    private projectRepo: IProjectRepository,
  ) {}

  // ── Public API ───────────────────────────────────────────

  /**
   * Get a text-only digest for a single session.
   * @param options.last - Number of entries to return (default 5)
   * @param options.maxLength - Max chars per entry (0 = unlimited, undefined = default 150)
   */
  async getDigest(sessionId: string, options: { last?: number; maxLength?: number } = {}): Promise<TextOnlyDigest> {
    const last = options.last ?? 5;

    // Fetch session metadata
    const session = await this.sessionService.getSession(sessionId);
    const project = session.projectId ? await this.projectRepo.findById(session.projectId) : null;

    // Resolve JSONL file path
    const jsonlPath = await this.resolveJsonlPath(sessionId, project?.workingDir);

    if (!jsonlPath) {
      return this.emptyDigest(sessionId, session);
    }

    // Read tail of JSONL file
    const lines = await this.readTail(jsonlPath);

    // Determine effective max text length (0 = unlimited, undefined = default)
    const effectiveMaxLength = options.maxLength !== undefined ? options.maxLength : MAX_TEXT_LENGTH;

    // Extract text entries
    const allEntries = this.extractTextEntries(lines, effectiveMaxLength);

    // Detect stuck signal
    const stuck = this.detectStuck(lines);

    // Get last N entries
    const entries = allEntries.slice(-last);

    // Determine state from session status
    const state = this.mapSessionState(session.status, session.needsInput);

    return {
      sessionId,
      workerName: session.teamMemberSnapshot?.name || session.name,
      taskIds: session.taskIds || [],
      state,
      entries,
      stuck,
      lastActivityTimestamp: entries.length > 0
        ? entries[entries.length - 1].timestamp
        : session.lastActivity || Date.now(),
    };
  }

  /**
   * Get digests for multiple sessions in parallel.
   */
  async getDigests(sessionIds: string[], options: { last?: number; maxLength?: number } = {}): Promise<TextOnlyDigest[]> {
    return Promise.all(
      sessionIds.map(id => this.getDigest(id, options).catch(() => this.fallbackDigest(id)))
    );
  }

  /**
   * Get digests for all workers under a coordinator session.
   */
  async getWorkerDigests(coordinatorSessionId: string, options: { last?: number; maxLength?: number } = {}): Promise<TextOnlyDigest[]> {
    // List sessions spawned by this coordinator
    const sessions = await this.sessionService.listSessions({
      parentSessionId: coordinatorSessionId,
    });

    // Filter to active sessions
    const activeIds = sessions
      .filter(s => s.status !== 'completed' && s.status !== 'failed' && s.status !== 'stopped')
      .map(s => s.id);

    if (activeIds.length === 0) {
      return [];
    }

    return this.getDigests(activeIds, options);
  }

  // ── File Discovery ───────────────────────────────────────

  /**
   * Resolve the JSONL log file path for a session ID.
   * Uses a 60s path cache to avoid repeated filesystem scans.
   */
  private async resolveJsonlPath(sessionId: string, workingDir?: string | null): Promise<string | null> {
    // Check cache
    const cached = this.pathCache.get(sessionId);
    if (cached && (Date.now() - cached.resolvedAt) < PATH_CACHE_TTL_MS) {
      // Verify file still exists
      try {
        await stat(cached.path);
        return cached.path;
      } catch {
        this.pathCache.delete(sessionId);
      }
    }

    // Scan for JSONL files
    const projectsDirs = await this.getProjectsDirs(workingDir);

    for (const dir of projectsDirs) {
      try {
        const files = await readdir(dir);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

        for (const file of jsonlFiles) {
          const filePath = join(dir, file);
          try {
            // Read first 8KB to find session ID
            const header = await this.readHead(filePath, 8192);
            const match = header.match(SESSION_ID_REGEX);
            if (match && match[1] === sessionId) {
              this.pathCache.set(sessionId, { path: filePath, resolvedAt: Date.now() });
              return filePath;
            }
          } catch {
            // Skip unreadable files
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }

    return null;
  }

  /**
   * Get possible Claude projects directories to scan.
   * Encodes the working directory path: / → -
   */
  private async getProjectsDirs(workingDir?: string | null): Promise<string[]> {
    const claudeProjectsBase = join(homedir(), '.claude', 'projects');
    const dirs: string[] = [];

    if (workingDir) {
      // Encode path: / → - (mirrors Rust extract_maestro_session_id)
      const encoded = workingDir.replace(/\//g, '-');
      // Remove leading dash if present
      const cleanEncoded = encoded.startsWith('-') ? encoded.slice(1) : encoded;
      dirs.push(join(claudeProjectsBase, cleanEncoded));
    }

    // Also try to scan all project directories as fallback
    try {
      const allDirs = await readdir(claudeProjectsBase);
      for (const d of allDirs) {
        const fullPath = join(claudeProjectsBase, d);
        try {
          const s = await stat(fullPath);
          if (s.isDirectory() && !dirs.includes(fullPath)) {
            dirs.push(fullPath);
          }
        } catch {
          // skip
        }
      }
    } catch {
      // ~/.claude/projects doesn't exist
    }

    return dirs;
  }

  // ── File Reading ─────────────────────────────────────────

  /**
   * Read the first N bytes of a file.
   */
  private async readHead(filePath: string, bytes: number): Promise<string> {
    const fh = await open(filePath, 'r');
    try {
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await fh.read(buf, 0, bytes, 0);
      return buf.toString('utf-8', 0, bytesRead);
    } finally {
      await fh.close();
    }
  }

  /**
   * Read the tail of a JSONL file (last ~100KB).
   * Returns parsed JSONL lines (drops first potentially truncated line).
   */
  private async readTail(filePath: string): Promise<any[]> {
    const fileStats = await stat(filePath);
    const fileSize = fileStats.size;

    let content: string;
    const offset = Math.max(0, fileSize - TAIL_BYTES);

    if (offset === 0) {
      // File is small enough to read entirely
      content = await readFile(filePath, 'utf-8');
    } else {
      const fh = await open(filePath, 'r');
      try {
        const buf = Buffer.alloc(TAIL_BYTES);
        const { bytesRead } = await fh.read(buf, 0, TAIL_BYTES, offset);
        content = buf.toString('utf-8', 0, bytesRead);
      } finally {
        await fh.close();
      }
    }

    const rawLines = content.split('\n').filter(l => l.trim());

    // Drop first line if we seeked (it's likely truncated)
    const lines = offset > 0 ? rawLines.slice(1) : rawLines;

    const parsed: any[] = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }

    return parsed;
  }

  // ── Text Extraction ──────────────────────────────────────

  /**
   * Extract text entries from parsed JSONL lines.
   * Keeps only human-readable text, filters noise.
   * @param maxLength - 0 for unlimited, positive number for max chars per entry
   */
  private extractTextEntries(lines: any[], maxLength: number = MAX_TEXT_LENGTH): TextEntry[] {
    const entries: TextEntry[] = [];

    for (const line of lines) {
      const type = line.type;
      const timestamp = line.timestamp ? new Date(line.timestamp).getTime() : Date.now();

      if (type === 'assistant') {
        const texts = this.extractAssistantText(line, maxLength);
        for (const text of texts) {
          if (text) {
            entries.push({ timestamp, text, source: 'assistant' });
          }
        }
      } else if (type === 'user') {
        const text = this.extractUserText(line, maxLength);
        if (text) {
          entries.push({ timestamp, text: `[PROMPT] ${text}`, source: 'user' });
        }
      }
    }

    return entries;
  }

  /**
   * Extract readable text from an assistant message.
   * Only keeps type: 'text' blocks. Drops thinking, tool_use, tool_result.
   */
  private extractAssistantText(line: any, maxLength: number = MAX_TEXT_LENGTH): string[] {
    const message = line.message || line;
    const content = message.content;

    if (!content) return [];

    if (typeof content === 'string') {
      const cleaned = this.cleanText(content);
      return cleaned ? [this.truncateText(cleaned, maxLength)] : [];
    }

    if (Array.isArray(content)) {
      const texts: string[] = [];
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          const cleaned = this.cleanText(block.text);
          if (cleaned) {
            texts.push(this.truncateText(cleaned, maxLength));
          }
        }
      }
      return texts;
    }

    return [];
  }

  /**
   * Extract readable text from a user message.
   * Filters out meta/system messages.
   */
  private extractUserText(line: any, maxLength: number = MAX_TEXT_LENGTH): string | null {
    const message = line.message || line;
    const content = message.content;

    if (!content) return null;

    let text: string;
    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      // Concatenate text blocks only
      text = content
        .filter((b: any) => b.type === 'text' && b.text)
        .map((b: any) => b.text)
        .join(' ');
    } else {
      return null;
    }

    // Filter noise tags
    for (const pattern of NOISE_TAG_PATTERNS) {
      if (pattern.test(text)) {
        return null;
      }
    }

    // Skip empty or very short messages
    const cleaned = text.trim();
    if (cleaned.length < 3) return null;

    return this.truncateText(cleaned, maxLength);
  }

  /**
   * Clean text by removing noise tags and trimming.
   */
  private cleanText(text: string): string {
    let cleaned = text.trim();

    // Remove system-reminder blocks
    cleaned = cleaned.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
    // Remove local-command blocks
    cleaned = cleaned.replace(/<local-command>[\s\S]*?<\/local-command>/g, '').trim();
    // Remove local-command-caveat blocks
    cleaned = cleaned.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '').trim();

    return cleaned;
  }

  /**
   * Truncate text to first sentence or maxLength chars.
   * @param maxLength - 0 for unlimited, positive number for max chars
   */
  private truncateText(text: string, maxLength: number = MAX_TEXT_LENGTH): string {
    // 0 means unlimited — return full text
    if (maxLength === 0) {
      return text;
    }

    // Get first sentence
    const sentenceEnd = text.search(/[.!?]\s/);
    if (sentenceEnd > 0 && sentenceEnd < maxLength) {
      return text.substring(0, sentenceEnd + 1);
    }

    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength) + '...';
  }

  // ── Stuck Detection ──────────────────────────────────────

  /**
   * Detect if a worker is stuck: many tool calls with no recent text output.
   *
   * Scans backwards from the most recent entry to find consecutive tool calls
   * without any intervening text. Uses Date.now() for real-time silence
   * measurement so a completely idle worker (no new JSONL writes) is still
   * detected as stuck.
   */
  private detectStuck(lines: any[]): StuckSignal | null {
    const STUCK_TOOL_CALL_THRESHOLD = 5;
    const STUCK_SILENCE_MS = 30_000; // 30 seconds

    let toolCallsSinceLastText = 0;
    let lastTextTimestamp = 0;

    // Scan backwards from most recent to count tool calls since last text
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];

      if (line.type === 'assistant') {
        const content = line.message?.content || line.content;
        if (Array.isArray(content)) {
          const hasText = content.some((b: any) => b.type === 'text' && b.text?.trim());
          const hasToolUse = content.some((b: any) => b.type === 'tool_use');

          if (hasText) {
            lastTextTimestamp = line.timestamp ? new Date(line.timestamp).getTime() : 0;
            break; // Found last text entry — stop counting
          }
          if (hasToolUse) {
            toolCallsSinceLastText++;
          }
        }
      }
    }

    if (toolCallsSinceLastText <= STUCK_TOOL_CALL_THRESHOLD) {
      return null;
    }

    // Use real-time measurement so a completely silent worker is always detected.
    // If lastTextTimestamp is 0 (no text found in tail window), the silence
    // duration is unknown — fire without the time guard.
    const silentDurationMs = lastTextTimestamp > 0 ? Date.now() - lastTextTimestamp : 0;

    if (lastTextTimestamp > 0 && silentDurationMs < STUCK_SILENCE_MS) {
      return null; // Recent text found — not stuck yet
    }

    return {
      silentDurationMs,
      toolCallsSinceLastText,
      warning: `Worker has made ${toolCallsSinceLastText} tool calls without printing status text.`,
    };
  }

  // ── Helpers ──────────────────────────────────────────────

  private mapSessionState(status: string, needsInput?: { active: boolean }): 'active' | 'idle' | 'needs_input' {
    if (needsInput?.active) return 'needs_input';
    if (status === 'working' || status === 'spawning') return 'active';
    return 'idle';
  }

  private emptyDigest(sessionId: string, session: any): TextOnlyDigest {
    return {
      sessionId,
      workerName: session.teamMemberSnapshot?.name || session.name,
      taskIds: session.taskIds || [],
      state: this.mapSessionState(session.status, session.needsInput),
      entries: [],
      stuck: null,
      lastActivityTimestamp: session.lastActivity || Date.now(),
    };
  }

  private fallbackDigest(sessionId: string): TextOnlyDigest {
    return {
      sessionId,
      taskIds: [],
      state: 'idle',
      entries: [],
      stuck: null,
      lastActivityTimestamp: Date.now(),
    };
  }
}
