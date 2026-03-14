import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Session, SessionStatus, CreateSessionPayload, UpdateSessionPayload, SessionTimelineEvent, DocEntry } from '../../types';
import { ISessionRepository, SessionFilter } from '../../domain/repositories/ISessionRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

/**
 * Lightweight metadata index entry for fast filtering without full session load.
 */
interface SessionIndexEntry {
  id: string;
  status: SessionStatus;
  projectId: string;
  taskIds: string[];
  parentSessionId: string | null;
  rootSessionId: string;
  teamSessionId: string | null;
}

/** Statuses that indicate a session is terminal and can be evicted from memory. */
const TERMINAL_STATUSES: Set<SessionStatus> = new Set(['completed', 'failed', 'stopped']);

/**
 * File system based implementation of ISessionRepository.
 * Stores sessions as individual JSON files.
 *
 * Only active sessions are kept in memory. Completed/failed/stopped sessions
 * are evicted and loaded on-demand from disk. A lightweight metadata index
 * is maintained for all sessions to support fast filtering.
 */
export class FileSystemSessionRepository implements ISessionRepository {
  private sessionsDir: string;
  private sessionDocsDir: string;
  /** Full session objects for active (non-terminal) sessions only. */
  private sessions: Map<string, Session>;
  /** Lightweight index of all sessions for fast filtering without full load. */
  private sessionIndex: Map<string, SessionIndexEntry>;
  private initialized: boolean = false;

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.sessionsDir = path.join(dataDir, 'sessions');
    this.sessionDocsDir = path.join(dataDir, 'session-docs');
    this.sessions = new Map();
    this.sessionIndex = new Map();
  }

  /**
   * Build a lightweight index entry from a session object.
   */
  private buildIndexEntry(session: Session): SessionIndexEntry {
    return {
      id: session.id,
      status: session.status,
      projectId: session.projectId,
      taskIds: [...session.taskIds],
      parentSessionId: session.parentSessionId ?? null,
      rootSessionId: session.rootSessionId ?? session.id,
      teamSessionId: session.teamSessionId ?? null,
    };
  }

  /**
   * Apply migrations to a session object. Returns true if any migration was applied.
   */
  private async migrateSession(session: any): Promise<boolean> {
    let needsSave = false;

    // MIGRATION: Convert old taskId to taskIds array
    if (session.taskId && !session.taskIds) {
      session.taskIds = [session.taskId];
      delete session.taskId;
      needsSave = true;
    }

    // Initialize Phase IV-A fields if missing
    if (!session.taskIds) { session.taskIds = []; needsSave = true; }
    if (!session.name) { session.name = `Session ${session.id}`; needsSave = true; }
    if (!session.env) { session.env = {}; needsSave = true; }
    if (!session.events) { session.events = []; needsSave = true; }
    if (!session.timeline) { session.timeline = []; needsSave = true; }
    if (!session.docs) { session.docs = []; needsSave = true; }
    if (!session.rootSessionId) { session.rootSessionId = session.id; needsSave = true; }
    // Remove deprecated strategy field if present
    if (session.strategy) { delete session.strategy; needsSave = true; }
    // MIGRATION: Recover claudeSessionId from env vars for pre-fix sessions
    if (!session.claudeSessionId && session.env?.MAESTRO_CLAUDE_SESSION_ID) {
      session.claudeSessionId = session.env.MAESTRO_CLAUDE_SESSION_ID;
      needsSave = true;
    }

    // MIGRATION: Move inline doc content to separate files
    if (session.docs && session.docs.length > 0) {
      for (const doc of session.docs) {
        if (doc.content && !doc.contentFilePath) {
          try {
            const docDir = path.join(this.sessionDocsDir, session.id);
            await fs.mkdir(docDir, { recursive: true });
            const contentPath = path.join(docDir, `${doc.id}.md`);
            await fs.writeFile(contentPath, doc.content, 'utf-8');
            doc.contentFilePath = contentPath;
            delete doc.content;
            needsSave = true;
          } catch (docErr) {
            this.logger.warn(`Failed to migrate doc content for session ${session.id}, doc ${doc.id}`, { error: (docErr as Error).message });
          }
        }
      }
    }

    return needsSave;
  }

  /**
   * Load a session from disk by ID, applying any necessary migrations.
   */
  private async loadSessionFromDisk(id: string): Promise<Session | null> {
    try {
      const filePath = path.join(this.sessionsDir, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(data) as any;

      const migrated = await this.migrateSession(session);
      if (migrated) {
        await this.saveSession(session as Session);
      }

      return session as Session;
    } catch {
      return null;
    }
  }

  /**
   * Get a session by ID, checking in-memory cache first, then lazy-loading from disk.
   * Throws NotFoundError if session doesn't exist anywhere.
   */
  private async getSessionOrThrow(id: string): Promise<Session> {
    const cached = this.sessions.get(id);
    if (cached) return cached;

    if (this.sessionIndex.has(id)) {
      const loaded = await this.loadSessionFromDisk(id);
      if (loaded) return loaded;
    }

    throw new NotFoundError('Session', id);
  }

  /**
   * Save session to disk and update index. Cache in memory only if active.
   */
  private async saveAndCache(session: Session): Promise<void> {
    this.sessionIndex.set(session.id, this.buildIndexEntry(session));
    if (TERMINAL_STATUSES.has(session.status)) {
      this.sessions.delete(session.id);
    } else {
      this.sessions.set(session.id, session);
    }
    await this.saveSession(session);
  }

  /**
   * Resolve a list of session IDs to full Session objects,
   * using the in-memory cache where available and lazy-loading the rest.
   */
  private async resolveSessionIds(ids: string[]): Promise<Session[]> {
    const results: Session[] = [];
    for (const id of ids) {
      const cached = this.sessions.get(id);
      if (cached) {
        results.push(cached);
      } else {
        const loaded = await this.loadSessionFromDisk(id);
        if (loaded) results.push(loaded);
      }
    }
    return results;
  }

  /**
   * Initialize the repository by loading existing data.
   * Only active sessions are kept in memory; terminal sessions are indexed only.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      await fs.mkdir(this.sessionDocsDir, { recursive: true });

      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(f => f.endsWith('.json'));

      let activeCount = 0;
      let terminalCount = 0;

      for (const file of sessionFiles) {
        try {
          const data = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
          const session = JSON.parse(data) as any;

          const migrated = await this.migrateSession(session);

          // Build index entry for ALL sessions
          this.sessionIndex.set(session.id, this.buildIndexEntry(session as Session));

          // Only keep active sessions in memory
          if (!TERMINAL_STATUSES.has(session.status)) {
            this.sessions.set(session.id, session as Session);
            activeCount++;
          } else {
            terminalCount++;
          }

          // Persist migrated session
          if (migrated) {
            await this.saveSession(session as Session);
          }
        } catch (err) {
          this.logger.warn(`Failed to load session file: ${file}`, { error: (err as Error).message });
        }
      }

      this.logger.info(`Loaded ${activeCount} active sessions, indexed ${terminalCount} terminal sessions (${activeCount + terminalCount} total)`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize session repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveSession(session: Session): Promise<void> {
    const filePath = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  private async deleteSessionFile(id: string): Promise<void> {
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  }

  async create(input: CreateSessionPayload): Promise<Session> {
    await this.ensureInitialized();

    const now = Date.now();
    const sessionId = input.id || this.idGenerator.generate('sess');

    const session: Session = {
      id: sessionId,
      projectId: input.projectId,
      taskIds: input.taskIds || [],
      name: input.name || 'Unnamed Session',
      agentId: input.agentId,
      claudeSessionId: input.claudeSessionId,
      env: input.env || {},
      status: input.status || 'idle',
      startedAt: now,
      lastActivity: now,
      completedAt: null,
      hostname: os.hostname(),
      platform: os.platform(),
      events: [],
      timeline: [
        {
          id: this.idGenerator.generate('evt'),
          type: 'session_started',
          timestamp: now,
          message: 'Session created',
        }
      ],
      docs: [],
      metadata: input.metadata,
      parentSessionId: input.parentSessionId || null,
      rootSessionId: input.rootSessionId || sessionId,
      teamSessionId: input.teamSessionId || null,
      teamId: input.teamId || null,
    };

    await this.saveAndCache(session);

    this.logger.debug(`Created session: ${session.id}`);
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    await this.ensureInitialized();

    // Check in-memory cache first
    const cached = this.sessions.get(id);
    if (cached) return cached;

    // Check index — if it exists, lazy-load from disk
    if (this.sessionIndex.has(id)) {
      return await this.loadSessionFromDisk(id);
    }

    return null;
  }

  async findByProjectId(projectId: string): Promise<Session[]> {
    await this.ensureInitialized();
    const matchingIds: string[] = [];
    for (const [id, entry] of this.sessionIndex) {
      if (entry.projectId === projectId) matchingIds.push(id);
    }
    return this.resolveSessionIds(matchingIds);
  }

  async findByTaskId(taskId: string): Promise<Session[]> {
    await this.ensureInitialized();
    const matchingIds: string[] = [];
    for (const [id, entry] of this.sessionIndex) {
      if (entry.taskIds.includes(taskId)) matchingIds.push(id);
    }
    return this.resolveSessionIds(matchingIds);
  }

  async findByStatus(status: SessionStatus): Promise<Session[]> {
    await this.ensureInitialized();
    const matchingIds: string[] = [];
    for (const [id, entry] of this.sessionIndex) {
      if (entry.status === status) matchingIds.push(id);
    }
    return this.resolveSessionIds(matchingIds);
  }

  async findAll(filter?: SessionFilter): Promise<Session[]> {
    await this.ensureInitialized();

    // Use index for fast filtering
    const matchingIds: string[] = [];
    for (const [id, entry] of this.sessionIndex) {
      if (filter) {
        if (filter.projectId && entry.projectId !== filter.projectId) continue;
        if (filter.taskId && !entry.taskIds.includes(filter.taskId)) continue;
        if (filter.status && entry.status !== filter.status) continue;
        if (filter.parentSessionId && entry.parentSessionId !== filter.parentSessionId) continue;
        if (filter.rootSessionId && entry.rootSessionId !== filter.rootSessionId) continue;
        if (filter.teamSessionId && entry.teamSessionId !== filter.teamSessionId) continue;
      }
      matchingIds.push(id);
    }

    return this.resolveSessionIds(matchingIds);
  }

  async findByTeamSessionId(teamSessionId: string): Promise<Session[]> {
    await this.ensureInitialized();
    const matchingIds: string[] = [];
    for (const [id, entry] of this.sessionIndex) {
      if (entry.teamSessionId === teamSessionId) matchingIds.push(id);
    }
    return this.resolveSessionIds(matchingIds);
  }

  async update(id: string, updates: UpdateSessionPayload): Promise<Session> {
    await this.ensureInitialized();

    const session = await this.getSessionOrThrow(id);

    // Apply updates
    if (updates.taskIds !== undefined) session.taskIds = updates.taskIds;
    if (updates.status !== undefined) {
      session.status = updates.status;
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'stopped') {
        session.completedAt = Date.now();
      }
    }
    if (updates.agentId !== undefined) session.agentId = updates.agentId;
    if (updates.env !== undefined) session.env = { ...session.env, ...updates.env };
    if (updates.events !== undefined) session.events = [...session.events, ...updates.events];
    if (updates.timeline !== undefined) session.timeline = [...session.timeline, ...updates.timeline];
    if (updates.needsInput !== undefined) {
      session.needsInput = updates.needsInput;
    }
    if (updates.rootSessionId !== undefined) {
      session.rootSessionId = updates.rootSessionId;
    }
    if (updates.teamSessionId !== undefined) {
      session.teamSessionId = updates.teamSessionId;
    }
    if (updates.teamId !== undefined) {
      session.teamId = updates.teamId;
    }

    session.lastActivity = Date.now();

    await this.saveAndCache(session);

    this.logger.debug(`Updated session: ${id}`);
    return session;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.sessionIndex.has(id) && !this.sessions.has(id)) {
      throw new NotFoundError('Session', id);
    }

    this.sessions.delete(id);
    this.sessionIndex.delete(id);
    await this.deleteSessionFile(id);

    this.logger.debug(`Deleted session: ${id}`);
  }

  async addTask(sessionId: string, taskId: string): Promise<void> {
    await this.ensureInitialized();

    const session = await this.getSessionOrThrow(sessionId);

    if (!session.taskIds.includes(taskId)) {
      session.taskIds.push(taskId);
      session.lastActivity = Date.now();
      await this.saveAndCache(session);
    }
  }

  async removeTask(sessionId: string, taskId: string): Promise<void> {
    await this.ensureInitialized();

    const session = await this.getSessionOrThrow(sessionId);

    session.taskIds = session.taskIds.filter(id => id !== taskId);
    session.lastActivity = Date.now();
    await this.saveAndCache(session);
  }

  async existsByProjectId(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    for (const entry of this.sessionIndex.values()) {
      if (entry.projectId === projectId) return true;
    }
    return false;
  }

  async count(): Promise<number> {
    await this.ensureInitialized();
    return this.sessionIndex.size;
  }

  async countByStatus(status: SessionStatus): Promise<number> {
    await this.ensureInitialized();
    let count = 0;
    for (const entry of this.sessionIndex.values()) {
      if (entry.status === status) count++;
    }
    return count;
  }

  async addEvent(sessionId: string, event: { type: string; data?: any }): Promise<Session> {
    await this.ensureInitialized();

    const session = await this.getSessionOrThrow(sessionId);

    const fullEvent = {
      id: this.idGenerator.generate('evt'),
      timestamp: Date.now(),
      type: event.type,
      data: event.data
    };

    session.events.push(fullEvent);
    session.lastActivity = Date.now();

    await this.saveAndCache(session);

    this.logger.debug(`Added event to session: ${sessionId}, type: ${event.type}`);
    return session;
  }

  async addTimelineEvent(sessionId: string, event: SessionTimelineEvent): Promise<Session> {
    await this.ensureInitialized();

    const session = await this.getSessionOrThrow(sessionId);

    session.timeline.push(event);
    session.lastActivity = Date.now();

    await this.saveAndCache(session);

    this.logger.debug(`Added timeline event to session: ${sessionId}, type: ${event.type}`);
    return session;
  }

  async addDoc(sessionId: string, doc: DocEntry): Promise<Session> {
    await this.ensureInitialized();

    const session = await this.getSessionOrThrow(sessionId);

    // Write content to a separate file instead of storing inline in session JSON
    if (doc.content) {
      const docDir = path.join(this.sessionDocsDir, sessionId);
      await fs.mkdir(docDir, { recursive: true });
      const contentPath = path.join(docDir, `${doc.id}.md`);
      await fs.writeFile(contentPath, doc.content, 'utf-8');
      doc.contentFilePath = contentPath;
      delete doc.content;
    }

    if (!session.docs) { session.docs = []; }
    session.docs.push(doc);
    session.lastActivity = Date.now();

    await this.saveAndCache(session);

    this.logger.debug(`Added doc to session: ${sessionId}, title: ${doc.title}`);
    return session;
  }

  async getDocContent(sessionId: string, docId: string): Promise<string | null> {
    await this.ensureInitialized();

    const session = await this.getSessionOrThrow(sessionId);

    const doc = session.docs?.find(d => d.id === docId);
    if (!doc) return null;

    // Return inline content if still present (legacy)
    if (doc.content) return doc.content;

    // Read from file
    if (doc.contentFilePath) {
      try {
        return await fs.readFile(doc.contentFilePath, 'utf-8');
      } catch {
        return null;
      }
    }

    return null;
  }
}
