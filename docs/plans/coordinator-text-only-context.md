# Design: Text-Only Coordinator Context (No Tool Calls)

## The Insight

The previous compacted log streaming design (see `compacted-session-log-streaming-for-coordinators.md`) proposed sending compacted tool calls to the coordinator — things like `Read: src/api.ts (312 lines)`, `Bash: npm test ✓ (4 passed)`, etc.

**The refinement:** Don't send tool calls at all. The coordinator should only receive the **text output** — what the agent prints/says. These are the `type: 'text'` content blocks from assistant messages in the JSONL session log.

## Why This Is Better

### 1. Text output IS the summary

When Claude Code works, it naturally produces text output that summarizes what it's doing:

```
"I'll start by reading the authentication configuration..."
"The tests are passing now. I've fixed the validation logic in auth.ts by adding the missing null check."
"I'm blocked — the serde module is missing. Need to add it to Cargo.toml."
```

These text blocks already contain the signal the coordinator needs. The tool calls (`Read: auth.ts`, `Edit: auth.ts (+3 -1)`, `Bash: cargo test`) are implementation details that the text output summarizes in natural language.

### 2. Even more aggressive token savings

| Approach | Tokens per API turn | 5 workers × 40 turns |
|---|---|---|
| Raw JSONL | ~5,000 | 1,000,000 |
| Compacted (previous design) | ~50-100 | 15,000 |
| **Text-only (this design)** | ~15-30 | 4,500 |

The text-only approach is **~3x cheaper** than the already-efficient compacted design, and **~200x cheaper** than raw logs.

### 3. Higher signal density

Tool calls are mechanical actions. The coordinator doesn't need to know that the worker read 5 files and ran 3 grep searches. It needs to know:
- What is the worker trying to do?
- Is it making progress?
- Is it stuck?
- What did it accomplish?

The agent's text output answers all of these questions directly. Tool calls answer "what specific files were touched" — useful for debugging, not for coordination.

### 4. Natural language = better coordinator reasoning

When the coordinator's context contains:

```
[Worker 1] "I've fixed the login validation. Tests pass. Moving to signup form next."
[Worker 2] "Stuck on a build error — missing serde dependency in Cargo.toml."
```

...it can reason about this much more naturally than:

```
[Worker 1] Read: Login.tsx → Edit: Login.tsx (+8 -2) → Bash: npm test ✓
[Worker 2] Bash: cargo build ✗ → Read: lib.rs → [THINKING 12s]
```

The text-only version tells the coordinator *why* things are happening, not just *what* happened. It's the difference between reading a progress report vs. reading a raw activity log.

## What "Text Output" Means Concretely

In Claude Code's JSONL format, each assistant message has a `content` array with blocks:

```json
{
  "type": "assistant",
  "message": {
    "content": [
      { "type": "thinking", "thinking": "..." },        // DROP
      { "type": "text", "text": "I'll fix the bug..." }, // KEEP
      { "type": "tool_use", "name": "Edit", ... },       // DROP
      { "type": "text", "text": "Done. Tests pass." },   // KEEP
      { "type": "tool_use", "name": "Bash", ... }        // DROP
    ]
  }
}
```

**Keep:** `text` blocks from `assistant` messages only (the agent's printed output).
**Drop:** `thinking`, `tool_use`, `tool_result`, `image`, system messages, user meta messages.

### What about user messages?

Real user messages (not tool results) should also be included when they exist — these represent either:
- The initial task prompt
- Human follow-up instructions
- `maestro session prompt` messages from other agents

Including user messages gives the coordinator context on what the worker was asked to do.

### What about maestro CLI output?

When the worker runs `maestro task report complete ...`, these appear as tool calls (Bash tool). The text output around them ("I've completed the task, reporting to coordinator...") is kept. The actual CLI invocation is dropped. This is fine because the coordinator already receives these reports through the task system directly.

## Digest Format (Text-Only)

### For the coordinator's prompt context:

```xml
<session_activity>
  <session id="sess_abc123" worker="Frontend Dev" task="task_456" state="active">
    [14:32:05] "I'll start by reading the login component to understand the current validation..."
    [14:32:12] "Found the issue — the email regex doesn't handle plus signs. Fixing now."
    [14:32:18] "Login validation is fixed. All 12 tests pass. Moving to the signup form."
  </session>
  <session id="sess_def789" worker="Backend Dev" task="task_457" state="idle_15s">
    [14:31:55] "Starting the database migration. I'll update the schema first."
    [14:32:02] "Hit a build error — missing serde_json dependency. Adding it to Cargo.toml."
    [14:32:10] "Build error persists. The issue might be deeper — investigating the workspace config."
  </session>
</session_activity>
```

**Token cost for this example:** ~120 tokens for 2 workers. The coordinator gets full narrative context.

### Structured format:

```typescript
interface TextOnlyDigest {
  sessionId: string;
  sessionName: string;
  workerName?: string;
  taskIds: string[];
  state: 'active' | 'idle' | 'thinking' | 'needs_input';

  // Only text output entries
  entries: TextEntry[];

  // Lightweight metrics (no per-tool breakdown needed)
  metrics: {
    turnsSinceLastText: number;   // Detect silent workers
    lastActivityTimestamp: number;
    idleDurationMs: number;       // 0 if active
  };
}

interface TextEntry {
  timestamp: number;
  text: string;          // The agent's text output (trimmed, max ~150 chars)
  isFirstSentence: boolean; // If we truncated a longer block
}
```

## What We Lose (And Why It's OK)

| Lost Signal | Why It's Acceptable |
|---|---|
| Tool names (Read, Edit, Bash) | The text output describes what was done in natural language |
| File paths touched | Only relevant for debugging, not coordination. Available in full logs if needed |
| Success/failure of tool calls | Agent's text output reports success ("tests pass") or failure ("build error") |
| Thinking block duration | If the worker is thinking for a long time, the idle timer captures this |
| Token usage per turn | Can still track aggregate metrics separately if needed |
| Exact edit diffs | Way too detailed for a coordinator — the agent summarizes changes in text |

### One exception: Error escalation

When a session has **no text output for an extended period** (e.g., >30 seconds) but is still producing tool calls, this likely means the agent is stuck in a loop (retrying, reading the same files, etc.). The LogWatcherService should detect this pattern and inject a synthetic status line:

```
[14:33:45] ⚠ No text output for 45s — agent may be stuck (12 tool calls since last text)
```

This is the one case where we peek at tool call *counts* (not contents) to provide a safety signal.

## Implementation Changes vs. Previous Design

The previous compacted log streaming design had a `compactMessage()` function that processed tool calls, thinking blocks, and text. The text-only approach dramatically simplifies this:

### Simplified compaction function:

```typescript
function extractTextEntries(messages: ParsedMessage[]): TextEntry[] {
  const entries: TextEntry[] = [];

  for (const msg of messages) {
    // Only process assistant messages
    if (msg.type !== 'assistant') continue;
    if (!Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (block.type !== 'text') continue;

      const text = block.text.trim();
      if (!text) continue;

      // Skip very short fragments (tool call artifacts)
      if (text.length < 10) continue;

      // Take first meaningful sentence, cap at 150 chars
      const firstSentence = text.split(/(?<=[.!?])\s/)[0];
      const truncated = firstSentence.length > 150
        ? firstSentence.slice(0, 147) + '...'
        : firstSentence;

      entries.push({
        timestamp: msg.timestamp.getTime(),
        text: truncated,
        isFirstSentence: truncated.length < text.length,
      });
    }
  }

  return entries;
}
```

This is **~30 lines** vs. the **~100+ lines** of the previous compaction algorithm. No tool name switching, no path shortening, no result parsing.

### Also include real user messages (task prompts, directives):

```typescript
function extractUserPrompts(messages: ParsedMessage[]): TextEntry[] {
  const entries: TextEntry[] = [];

  for (const msg of messages) {
    if (msg.type !== 'user' || msg.isMeta) continue;

    // Real user/agent prompt
    const text = typeof msg.content === 'string'
      ? msg.content
      : msg.content.filter(b => b.type === 'text').map(b => b.text).join(' ');

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 5) continue;

    // Skip system tags
    if (trimmed.startsWith('<local-command') || trimmed.startsWith('<system-reminder')) continue;

    const truncated = trimmed.length > 200 ? trimmed.slice(0, 197) + '...' : trimmed;

    entries.push({
      timestamp: msg.timestamp.getTime(),
      text: `[PROMPT] ${truncated}`,
      isFirstSentence: truncated.length < trimmed.length,
    });
  }

  return entries;
}
```

## Rolling Window: Count-Based

Use a count-based window (last N text entries per worker) instead of time-based, as suggested in the architecture review. This gives predictable token budgets:

| Config | Entries per worker | ~Tokens per worker | 5 workers total |
|---|---|---|---|
| Minimal | 3 | ~100 | ~500 |
| Normal | 5 | ~175 | ~875 |
| Verbose | 10 | ~350 | ~1,750 |

Even at "verbose," 5 workers cost < 2,000 tokens. This is negligible.

## Combined Flow: Observation + Action

```
Coordinator Prompt Context:
  <session_activity>
    <session worker="Frontend Dev" state="active">
      [PROMPT] "Fix the login validation bug in the email field"
      "Found the issue — email regex doesn't handle plus signs. Fixing now."
      "Login validation fixed. All 12 tests pass. Moving to signup form."
    </session>
    <session worker="Backend Dev" state="idle_15s">
      [PROMPT] "Implement the user deletion API endpoint"
      "Hit a build error — missing serde dependency."
      "Build error persists. Investigating workspace config."
    </session>
  </session_activity>

Coordinator Action:
  maestro session prompt <backend-dev> --message "Try: cargo add serde_json -p api-service"
```

The coordinator reads text → understands the situation → sends a directive. No polling, no tool call parsing. Pure text in, text out.

## CLI Architecture: How the Coordinator Watches Logs

### Current State (Gap Analysis)

What exists today:

| Component | What It Does | Limitation |
|---|---|---|
| `maestro session watch <ids>` | Watches **domain events** via WebSocket (status changes, progress reports, timeline events) | Only sees what workers explicitly report. Does NOT read JSONL logs. |
| Rust `claude_logs.rs` (Tauri) | Tails JSONL files from `~/.claude/projects/` | Only accessible from **Tauri UI** — not exposed to server or CLI |
| `maestro-ui/src/utils/claude-log/` | Parses JSONL → messages, classifies, groups | **UI-only** TypeScript — not available server-side |

**The gap:** There is NO way for a coordinator CLI session to read worker session log content. The coordinator is blind to what workers are printing — it only sees explicit `maestro report progress` messages.

### New Command: `maestro session logs`

The coordinator needs a single command to watch text output from one or more worker sessions, multiplexed into a single stream.

```bash
# Watch text output from a single worker (live, like tail -f)
maestro session logs sess_abc123

# Watch multiple workers multiplexed (comma-separated)
maestro session logs sess_abc123,sess_def789,sess_ghi012

# Watch ALL workers spawned by this coordinator session
maestro session logs --my-workers

# One-shot: get the last N text entries (no follow)
maestro session logs sess_abc123 --last 10

# JSON output for programmatic consumption
maestro session logs --my-workers --json
```

**Human-readable output (multiplexed):**

```
[14:32:05] [Frontend Dev | sess_abc123] "I'll start by reading the login component..."
[14:32:08] [Backend Dev  | sess_def789] "Starting the database migration. Updating schema first."
[14:32:12] [Frontend Dev | sess_abc123] "Found the issue — email regex doesn't handle plus signs. Fixing now."
[14:32:15] [Backend Dev  | sess_def789] "Hit a build error — missing serde_json dependency."
[14:32:18] [Frontend Dev | sess_abc123] "Login validation fixed. All 12 tests pass."
[14:32:22] [Backend Dev  | sess_def789] ⚠ No text output for 30s (8 tool calls since last text)
```

Each line is prefixed with timestamp and session identity, making it easy for the coordinator to scan. Multiple sessions interleave naturally by timestamp.

**JSON output (one JSONL line per text entry):**

```json
{"sessionId":"sess_abc123","worker":"Frontend Dev","timestamp":1708012325000,"text":"I'll start by reading the login component..."}
{"sessionId":"sess_def789","worker":"Backend Dev","timestamp":1708012328000,"text":"Starting the database migration. Updating schema first."}
```

### Architecture: Server-Side Log Tailing

The JSONL log files live on disk at `~/.claude/projects/{encoded_cwd}/{sessionfile}.jsonl`. The server already has access to the filesystem (it reads session/task data from disk). We add a new service and endpoint.

```
Coordinator CLI
  │
  ├── maestro session logs sess_abc,sess_def --my-workers
  │
  ▼
maestro-server (REST API + WebSocket)
  │
  ├── GET /api/sessions/:id/log-digest       — One-shot digest for one session
  ├── GET /api/sessions/log-digests?parent=X  — Digests for all workers under coordinator
  │
  ├── WebSocket event: 'session:log_digest'   — Pushed when new text is detected
  │
  ▼
LogWatcherService (new server-side service)
  │
  ├── Resolves: maestroSessionId → JSONL file path
  │   (scans ~/.claude/projects/{encoded_cwd}/ for matching file,
  │    same logic as Rust extract_maestro_session_id but in TypeScript)
  │
  ├── Tails each watched session's JSONL file (byte-offset, 3s interval)
  │
  ├── Parses new lines → extracts text blocks only
  │   (port parseJsonlText + text extraction, ~50 lines)
  │
  ├── Stores rolling window per session: Map<sessionId, TextOnlyDigest>
  │
  └── Emits 'session:log_digest' when new text entries appear
```

### CLI Implementation: `maestro session logs`

**File:** `maestro-cli/src/commands/session.ts`

```typescript
session.command('logs [sessionIds]')
  .description('Watch text output from worker sessions (comma-separated IDs)')
  .option('--my-workers', 'Watch all worker sessions spawned by this coordinator')
  .option('--last <n>', 'Show last N text entries only (no follow)', parseInt)
  .option('--follow', 'Keep watching for new text output (default: true)')
  .action(async (sessionIds: string | undefined, cmdOpts: any) => {
    await guardCommand('session:logs');
    const globalOpts = program.opts();
    const isJson = globalOpts.json;

    // Resolve session IDs
    let ids: string[] = [];

    if (cmdOpts.myWorkers) {
      const myId = config.sessionId;
      if (!myId) {
        console.error('Error: MAESTRO_SESSION_ID not set.');
        process.exit(1);
      }
      // Fetch child sessions from server
      const sessions: any[] = await api.get(
        `/api/sessions?parentSessionId=${myId}&active=true`
      );
      ids = sessions.map(s => s.id);
      if (ids.length === 0) {
        console.error('No active worker sessions found.');
        process.exit(1);
      }
    } else if (sessionIds) {
      ids = sessionIds.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      console.error('Error: provide session IDs or use --my-workers');
      process.exit(1);
    }

    if (!isJson) {
      console.log(`[session:logs] Watching ${ids.length} session(s): ${ids.join(', ')}`);
    }

    // Option A: One-shot (--last N, no follow)
    if (cmdOpts.last && !cmdOpts.follow) {
      for (const id of ids) {
        const digest = await api.get(
          `/api/sessions/${id}/log-digest?last=${cmdOpts.last}`
        );
        printDigest(digest, isJson);
      }
      return;
    }

    // Option B: Follow mode via WebSocket
    const wsUrl = config.apiUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      // Subscribe to log digest events for these sessions
      ws.send(JSON.stringify({
        type: 'subscribe',
        sessionIds: ids,
      }));
      // Request initial digests
      ws.send(JSON.stringify({
        type: 'request_log_digests',
        sessionIds: ids,
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.event === 'session:log_digest') {
        printDigestEntry(msg.data, isJson);
      }
    });

    // Keep alive until all sessions complete or Ctrl+C
    await new Promise<void>((resolve) => { ws.on('close', resolve); });
  });
```

### How the Server Discovers JSONL Files

Each maestro session has a `cwd` (the project working directory) stored in its metadata or the project record. The JSONL filename contains the Claude Code session UUID, but we identify it by the `<session_id>sess_xxx</session_id>` tag embedded in the first 8KB.

**Resolution flow:**

```
1. Server receives request for session sess_abc123
2. Looks up session → gets project → gets project.workingDir (cwd)
3. Encodes cwd: "/Users/user/project" → "-Users-user-project"
4. Scans ~/.claude/projects/-Users-user-project/*.jsonl
5. For each .jsonl file, reads first 8KB looking for <session_id>sess_abc123</session_id>
6. Found match → this is the log file for sess_abc123
7. Tails from stored byte offset, parses new lines, extracts text blocks
```

This is the same logic already in `claude_logs.rs` (`extract_maestro_session_id`), ported to TypeScript for the server.

### Server Endpoints

**`GET /api/sessions/:id/log-digest`**

Returns the latest text-only digest for one session.

```typescript
// Response:
{
  sessionId: "sess_abc123",
  sessionName: "Worker: Fix Login",
  workerName: "Frontend Dev",
  state: "active",
  entries: [
    { timestamp: 1708012305000, text: "I'll start by reading the login component...", source: "assistant" },
    { timestamp: 1708012312000, text: "Found the issue — email regex doesn't handle plus signs.", source: "assistant" },
    { timestamp: 1708012318000, text: "Login validation fixed. All 12 tests pass.", source: "assistant" }
  ],
  metrics: {
    turnsSinceLastText: 0,
    lastActivityTimestamp: 1708012318000,
    idleDurationMs: 0
  }
}
```

Query params:
- `?last=N` — return only last N entries (default: 10)
- `?since=<epochMs>` — return entries after this timestamp

**`GET /api/sessions/log-digests`**

Returns digests for multiple sessions at once (the "dashboard" endpoint).

Query params:
- `?parentSessionId=sess_xyz` — all workers under this coordinator
- `?sessionIds=sess_a,sess_b,sess_c` — specific sessions
- `?projectId=proj_xxx` — all active sessions in project

### WebSocket Events for Live Streaming

**New event: `session:log_digest`**

When the LogWatcherService detects new text output, it emits:

```typescript
// Domain event
'session:log_digest': {
  sessionId: string;
  entries: TextEntry[];       // Only the NEW entries since last emit
  state: 'active' | 'idle' | 'thinking';
  workerName?: string;
  timestamp: number;
}
```

The WebSocketBridge already broadcasts domain events to subscribed clients. Adding this event is a 1-line change to the events array.

The CLI's `maestro session logs --my-workers` connects via WebSocket and subscribes to its worker session IDs. New text entries stream in as they're detected.

### `maestro session watch` vs `maestro session logs`

These serve different purposes and can coexist:

| Feature | `session watch` | `session logs` |
|---|---|---|
| **Data source** | Maestro domain events (WebSocket) | Claude Code JSONL files (file tailing) |
| **Shows** | Status changes, progress reports, timeline events | Agent's actual text output (what it prints) |
| **Granularity** | High-level: "task completed", "needs input" | Detailed: "Found the bug in auth.ts, fixing..." |
| **Coordinator use** | Know WHEN things happen | Know WHAT the agent is thinking/doing |
| **Depends on worker** | Worker must call `maestro report` | No worker action needed — reads raw logs |

**For the coordinator, `session logs` is the primary observation tool.** It provides passive visibility without requiring workers to report. `session watch` is useful for definitive state transitions (completed, failed, needs input).

A coordinator's typical workflow:

```bash
# In coordinator prompt instructions:
1. Spawn workers with maestro session spawn
2. Check what they're doing: maestro session logs --my-workers --last 5
3. If a worker looks stuck, send help: maestro session prompt <id> --message "try X"
4. For status changes, use: maestro session watch <ids>
```

### LogWatcherService: New Server-Side Service

**File:** `maestro-server/src/infrastructure/LogWatcherService.ts`

This is the core new component. It:

1. **Discovers JSONL files** per session (scan + match by maestro session ID tag)
2. **Tails files** at 3-second intervals using byte offsets
3. **Parses JSONL lines** and extracts text-only entries
4. **Maintains rolling window** per session (last 10 text entries)
5. **Emits events** when new text appears

```typescript
class LogWatcherService {
  // sessionId → watcher state
  private watchers = new Map<string, {
    filePath: string;
    offset: number;
    entries: TextEntry[];
    lastTextTimestamp: number;
    toolCallsSinceLastText: number;
  }>();

  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private eventBus: IEventBus,
    private sessionService: SessionService,
    private projectRepo: IProjectRepository,
  ) {}

  // Start watching a session's log file
  async watchSession(sessionId: string): Promise<void> {
    // 1. Resolve JSONL file path
    const session = await this.sessionService.getSession(sessionId);
    const project = await this.projectRepo.findById(session.projectId);
    const cwd = project.workingDir;
    const encodedCwd = cwd.replace(/\//g, '-');
    const projectDir = path.join(os.homedir(), '.claude', 'projects', encodedCwd);

    // 2. Scan for matching JSONL file
    const logFile = await this.findLogFileForSession(projectDir, sessionId);
    if (!logFile) return; // File not found yet — will retry next poll

    // 3. Initialize watcher
    this.watchers.set(sessionId, {
      filePath: logFile,
      offset: 0,
      entries: [],
      lastTextTimestamp: Date.now(),
      toolCallsSinceLastText: 0,
    });
  }

  // Poll all watched sessions (called every 3s)
  async poll(): Promise<void> {
    for (const [sessionId, watcher] of this.watchers) {
      // Read new bytes from offset
      const newContent = await this.tailFile(watcher.filePath, watcher.offset);
      if (!newContent.text) continue;

      watcher.offset = newContent.newOffset;

      // Parse and extract text entries
      const messages = parseJsonlText(newContent.text);
      const newEntries = extractTextEntries(messages);

      if (newEntries.length > 0) {
        // Add to rolling window (keep last 10)
        watcher.entries.push(...newEntries);
        if (watcher.entries.length > 10) {
          watcher.entries = watcher.entries.slice(-10);
        }
        watcher.lastTextTimestamp = Date.now();
        watcher.toolCallsSinceLastText = 0;

        // Emit event
        this.eventBus.emit('session:log_digest', {
          sessionId,
          entries: newEntries,
          state: 'active',
          timestamp: Date.now(),
        });
      } else {
        // Count tool calls for stuck detection
        const toolCalls = messages.filter(m =>
          m.type === 'assistant' && Array.isArray(m.content) &&
          m.content.some(b => b.type === 'tool_use')
        ).length;
        watcher.toolCallsSinceLastText += toolCalls;

        // Stuck detection
        const silentDuration = Date.now() - watcher.lastTextTimestamp;
        if (silentDuration > 30000 && watcher.toolCallsSinceLastText > 5) {
          this.eventBus.emit('session:log_digest', {
            sessionId,
            entries: [{
              timestamp: Date.now(),
              text: `⚠ No text output for ${Math.round(silentDuration/1000)}s (${watcher.toolCallsSinceLastText} tool calls since last text)`,
              source: 'system',
            }],
            state: 'idle',
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  // Start the polling loop
  start(intervalMs = 3000): void {
    this.intervalHandle = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }
}
```

### Auto-Watch: Coordinator Spawns → LogWatcher Starts

When a session is spawned with `spawnSource: 'session'`, the server already knows the parent session ID. The LogWatcherService should auto-start watching the new session:

```typescript
// In sessionRoutes.ts spawn handler, after emitting session:spawn:
logWatcherService.watchSession(session.id);
```

The coordinator doesn't need to manually start watching — spawning a worker automatically begins log tailing.

### Files Modified (Summary)

| File | Change | Status |
|---|---|---|
| `maestro-server/src/infrastructure/LogWatcherService.ts` | **New** — server-side JSONL tailing + text extraction | New file |
| `maestro-server/src/domain/events/DomainEvents.ts` | Add `session:log_digest` event type | 1 new interface + union entry |
| `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` | Add `'session:log_digest'` to events array | 1 line |
| `maestro-server/src/container.ts` | Wire up LogWatcherService | Small |
| `maestro-server/src/api/sessionRoutes.ts` | Add `GET /sessions/:id/log-digest` + `GET /sessions/log-digests` endpoints | ~60 lines |
| `maestro-cli/src/commands/session.ts` | Add `session logs` subcommand | ~80 lines |
| `maestro-cli/src/services/command-permissions.ts` | Add `session:logs` permission | 1 line |

### Phase Adjustment

| Phase | What | Effort |
|---|---|---|
| **1** | LogWatcherService: tail JSONL, extract text blocks only | Small (simpler than before) |
| **2** | REST endpoints for log digests + `maestro session logs` CLI command | Medium |
| **3** | WebSocket push (`session:log_digest`) for live streaming | Small (infrastructure exists) |
| **4** | Auto-watch on spawn + `--my-workers` flag | Small |
| **5** | Prompt context injection (`<session_activity>` in coordinator prompt) | Medium |
| **6** | Stuck detection (no text + high tool count = warning) | Small |

Phases 1-4 together deliver the full CLI experience. Phase 5 makes it automatic for the coordinator (no manual polling needed).

## Summary

**The text-only approach is the right call.** It's simpler to implement, cheaper on tokens, and provides better signal for coordinator decision-making. The agent's own text output is already a high-quality summary of what's happening — we should trust it rather than trying to reconstruct a narrative from tool call metadata.

Key principles:
1. **Text blocks only** from assistant messages — the agent's printed output
2. **User prompts** included for context on what was asked
3. **No tool calls, no thinking, no tool results** — all noise for coordination purposes
4. **Count-based rolling window** (5-10 entries per worker) for predictable token budgets
5. **Stuck detection** as the one exception where tool call *counts* (not contents) matter
6. **~200x cheaper** than raw logs, ~3x cheaper than compacted tool calls
7. **`maestro session logs`** — new CLI command that multiplexes text output from multiple sessions
8. **Server-side LogWatcherService** — tails JSONL files, extracts text, pushes via WebSocket
9. **Auto-watch on spawn** — coordinator doesn't need to manually start watching
