# End-to-End Coordinator Flow: Logs + Task Status + Intervention

## Overview

The coordinator observes workers through **two channels**: on-demand text-only session log digests and task status polling. When it detects issues, it intervenes directly via `maestro session prompt`. No persistent watchers. No tool call parsing. Pure text observation → decision → action.

**Architecture principle:** The server is **stateless** with respect to log watching. It reads JSONL files **on-demand** when a request comes in — no persistent watchers, no background polling loops, no lifecycle management. The coordinator (or prompt builder) requests digests when it needs them.

```
                    ┌─────────────────────────────────┐
                    │        COORDINATOR AGENT         │
                    │                                  │
                    │  Each turn:                      │
                    │  1. CLI builds prompt             │
                    │  2. Fetches log digests on-demand │  ← GET /sessions/log-digests
                    │  3. Fetches task statuses         │  ← GET /tasks (existing)
                    │  4. Injects <coordinator_context> │
                    │                                  │
                    │  Coordinator reads context, acts: │
                    │  • maestro session prompt <id>   │  → Direct PTY injection
                    │  • maestro task children <id>    │  → Check task tree
                    │  • maestro session logs --last 5 │  → Manual deeper check
                    └──────────┬───────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
        ┌──────────┐   ┌──────────┐      ┌──────────┐
        │ Worker 1 │   │ Worker 2 │      │ Worker N │
        │ (PTY)    │   │ (PTY)    │      │ (PTY)    │
        │ JSONL ↓  │   │ JSONL ↓  │      │ JSONL ↓  │
        └──────────┘   └──────────┘      └──────────┘
              │                │                 │
              └────────────────┼─────────────────┘
                               │
                    ~/.claude/projects/{cwd}/*.jsonl
                               │
                    ┌──────────┴───────────────────┐
                    │     maestro-server            │
                    │                               │
                    │  On request:                  │
                    │  1. Resolve sessionId → JSONL  │
                    │  2. Read tail of file          │
                    │  3. Parse → extract text       │
                    │  4. Return digest              │
                    │                               │
                    │  No persistent state.          │
                    └───────────────────────────────┘
```

---

## Phase 1: Coordinator Spawns Workers

### What Happens Today (Already Working)

1. Coordinator runs: `maestro session spawn --task <id> --subject "Fix auth bug" --message "Focus on the JWT validation in auth.ts"`
2. Server creates session (`status: 'spawning'`), generates manifest with `initialDirective`
3. UI opens terminal, worker starts with directive already in prompt context
4. Coordinator collects session IDs for all spawned workers

No changes needed here. Spawning does not start any watchers — observation is entirely on-demand.

---

## Phase 2: On-Demand Observation via Text-Only Log Digests

### The Core Insight

Workers naturally print text that summarizes their work:
- `"I'll start by reading the authentication config..."`
- `"Tests pass. Fixed the null check in auth.ts."`
- `"I'm blocked — serde module is missing."`

This text output is the **only** thing the coordinator needs. Tool calls (Read, Edit, Bash) are implementation details that the text already summarizes in natural language.

### Why On-Demand (Not Persistent Watchers)

The coordinator is an **LLM agent**, not a human. It processes the world in discrete turns. It can't "watch" a live stream — it reads data at decision time and acts. This means:

- **Persistent watchers** create lifecycle problems: when to start, when to stop, orphan cleanup on crashes, memory leaks from accumulated state
- **On-demand reads** are stateless: request comes in → read file → parse → return → done. No state to manage.
- **Performance is fine:** Reading the tail of 5 JSONL files takes <10ms. The coordinator requests digests once per turn (every 10-30s). Negligible load.

If repeated file scanning ever becomes slow (unlikely), a server-side TTL cache can be added as an optimization — not as core architecture.

### LogDigestService (New Server-Side Utility)

**File:** `maestro-server/src/application/services/LogDigestService.ts`

This is a **stateless utility** — no background loops, no managed watchers, no internal state. It reads files on-demand and returns results.

```typescript
class LogDigestService {
  constructor(
    private sessionService: SessionService,
    private projectRepo: IProjectRepository,
  ) {}

  // Get text digest for a single session (on-demand)
  async getDigest(sessionId: string, options?: { last?: number }): Promise<TextOnlyDigest>

  // Get text digests for multiple sessions at once
  async getDigests(sessionIds: string[], options?: { last?: number }): Promise<TextOnlyDigest[]>

  // Get digests for all active workers under a coordinator
  async getWorkerDigests(coordinatorSessionId: string, options?: { last?: number }): Promise<TextOnlyDigest[]>
}
```

### How It Works Per Request

```
1. Receive request for session sess_abc123
2. Look up session → project → project.workingDir
3. Encode cwd: "/Users/user/project" → "-Users-user-project"
4. Scan ~/.claude/projects/-Users-user-project/*.jsonl
5. Read first 8KB of each file looking for <session_id>sess_abc123</session_id>
6. Cache the sessionId → filePath mapping (LRU, refreshed on miss)
7. Seek to end of file minus buffer (e.g., last 100KB)
8. Read tail bytes, split into JSONL lines, parse
9. Extract text entries, apply count limit (last N)
10. Return TextOnlyDigest
```

### File Path Resolution + Caching

The expensive part is step 4-5 (scanning directory for matching JSONL). This is cached:

```typescript
// Simple in-memory LRU cache: sessionId → filePath
// Refreshed on cache miss (new session) or file-not-found (session restarted)
private filePathCache = new Map<string, { path: string; resolvedAt: number }>();

private async resolveLogFile(sessionId: string): Promise<string | null> {
  const cached = this.filePathCache.get(sessionId);
  if (cached && Date.now() - cached.resolvedAt < 60_000) {
    // Verify file still exists
    if (existsSync(cached.path)) return cached.path;
  }
  // Full scan + match
  const path = await this.scanForSessionLog(sessionId);
  if (path) this.filePathCache.set(sessionId, { path, resolvedAt: Date.now() });
  return path;
}
```

Only the file path mapping is cached — not the file contents or parsed entries. Every digest request reads fresh data from disk.

### Text Extraction Logic

```typescript
// From JSONL assistant messages:
// KEEP: { "type": "text", "text": "I'll fix the bug..." }
// DROP: { "type": "thinking", ... }
// DROP: { "type": "tool_use", ... }

// From user messages (non-meta only):
// KEEP: Real prompts, directives from other agents
// DROP: Tool results, system reminders, <local-command> tags

function extractTextEntries(jsonlLines: string[]): TextEntry[] {
  const entries: TextEntry[] = [];

  for (const line of jsonlLines) {
    const msg = JSON.parse(line);

    // Assistant text blocks
    if (msg.type === 'assistant' && Array.isArray(msg.message?.content)) {
      for (const block of msg.message.content) {
        if (block.type !== 'text') continue;
        const text = block.text.trim();
        if (!text || text.length < 10) continue;
        const first = text.split(/(?<=[.!?])\s/)[0];
        const truncated = first.length > 150 ? first.slice(0, 147) + '...' : first;
        entries.push({
          timestamp: msg.timestamp || Date.now(),
          text: truncated,
          source: 'assistant',
        });
      }
    }

    // Real user messages (prompts, directives)
    if (msg.type === 'human' && !msg.isMeta) {
      const text = typeof msg.message?.content === 'string'
        ? msg.message.content
        : '';
      const trimmed = text.trim();
      if (trimmed && trimmed.length >= 5
        && !trimmed.startsWith('<local-command')
        && !trimmed.startsWith('<system-reminder')) {
        const truncated = trimmed.length > 200 ? trimmed.slice(0, 197) + '...' : trimmed;
        entries.push({
          timestamp: msg.timestamp || Date.now(),
          text: `[PROMPT] ${truncated}`,
          source: 'user',
        });
      }
    }
  }

  return entries;
}
```

### Stuck Detection (Computed On-Demand)

Instead of tracking stuck state persistently, compute it from the tail of the file at request time:

```typescript
function computeStuckSignal(jsonlLines: string[]): StuckSignal | null {
  let lastTextTimestamp = 0;
  let toolCallsSinceLastText = 0;

  for (const line of jsonlLines) {
    const msg = JSON.parse(line);
    const ts = msg.timestamp || 0;

    if (msg.type === 'assistant' && Array.isArray(msg.message?.content)) {
      const hasText = msg.message.content.some(
        (b: any) => b.type === 'text' && b.text?.trim()?.length > 10
      );
      const hasToolUse = msg.message.content.some(
        (b: any) => b.type === 'tool_use'
      );

      if (hasText) {
        lastTextTimestamp = ts;
        toolCallsSinceLastText = 0;
      }
      if (hasToolUse) {
        toolCallsSinceLastText++;
      }
    }
  }

  const silentDuration = Date.now() - lastTextTimestamp;
  if (silentDuration > 30_000 && toolCallsSinceLastText > 5) {
    return {
      silentDurationMs: silentDuration,
      toolCallsSinceLastText,
      warning: `No text output for ${Math.round(silentDuration / 1000)}s (${toolCallsSinceLastText} tool calls since last text)`,
    };
  }
  return null;
}
```

### Data Structures

```typescript
interface TextEntry {
  timestamp: number;
  text: string;           // Max ~150 chars, first sentence
  source: 'assistant' | 'user' | 'system';
}

interface StuckSignal {
  silentDurationMs: number;
  toolCallsSinceLastText: number;
  warning: string;
}

interface TextOnlyDigest {
  sessionId: string;
  workerName?: string;
  taskIds: string[];
  state: 'active' | 'idle' | 'needs_input';
  entries: TextEntry[];           // Last N entries (default 5)
  stuck: StuckSignal | null;     // Computed on-demand from tail
  lastActivityTimestamp: number;
}
```

### Token Economics

| Approach | Tokens per turn | 5 workers × 40 turns |
|---|---|---|
| Raw JSONL | ~5,000 | 1,000,000 |
| Compacted (tool calls) | ~50-100 | 15,000 |
| **Text-only** | ~15-30 | **4,500** |

Text-only is ~200x cheaper than raw and ~3x cheaper than tool-call compaction.

---

## Phase 3: Task Status as the Second Observation Channel

### How It Works

The coordinator polls task statuses to get definitive state transitions:

```bash
# Check all child tasks under the coordinator's parent task
maestro task children <parentTaskId>
```

This returns structured status info: `pending`, `in_progress`, `completed`, `blocked`, `error`.

### Why Both Logs AND Task Status?

| Signal | Source | What It Tells the Coordinator |
|---|---|---|
| Text logs | JSONL file reading | What the worker is **thinking/doing** right now |
| Task status | Task database | What the worker has **accomplished** or is **stuck on** |

Text logs are **continuous** (narrative flow). Task statuses are **discrete** (state transitions). Together they give the coordinator full situational awareness.

### Combining in Coordinator's Prompt Context

Both channels merge into a single `<coordinator_context>` block injected into the coordinator's prompt:

```xml
<coordinator_context>
  <task_board>
    <task id="task_456" title="Fix login validation" assignee="Frontend Dev" status="in_progress" />
    <task id="task_457" title="User deletion API" assignee="Backend Dev" status="blocked"
          blocked_reason="Missing serde dependency" />
    <task id="task_458" title="Write auth tests" assignee="unassigned" status="pending" />
  </task_board>

  <session_activity>
    <session id="sess_abc123" worker="Frontend Dev" task="task_456" state="active">
      [14:32:05] "I'll start by reading the login component to understand the current validation..."
      [14:32:12] "Found the issue — email regex doesn't handle plus signs. Fixing now."
      [14:32:18] "Login validation is fixed. All 12 tests pass. Moving to signup form."
    </session>
    <session id="sess_def789" worker="Backend Dev" task="task_457" state="idle_15s" stuck="true">
      [14:31:55] "Starting the database migration. I'll update the schema first."
      [14:32:02] "Hit a build error — missing serde_json dependency."
      [14:32:10] "Build error persists. The issue might be deeper — investigating workspace config."
      ⚠ No text output for 45s (8 tool calls since last text)
    </session>
  </session_activity>
</coordinator_context>
```

**Token cost:** ~200-300 tokens for 2-3 workers. Negligible.

---

## Phase 4: Intervention via `maestro session prompt`

### When the Coordinator Intervenes

Based on logs + task status, the coordinator detects:

| Signal | What It Means | Coordinator Action |
|---|---|---|
| Worker text says "stuck" or "blocked" | Worker needs help | Send directive with solution |
| Task status = `blocked` for >60s | Worker reported blocker | Send unblock instructions or reassign |
| Stuck signal in digest | Worker in a loop | Send "try a different approach" |
| Worker completed task | Ready for next work | Assign next task via prompt |
| Worker going wrong direction | Misunderstood requirements | Correct course via prompt |

### How Intervention Works (Already Implemented)

```bash
maestro session prompt sess_def789 --message "Try: cargo add serde_json -p api-service"
```

Flow:
1. CLI POSTs to `POST /api/sessions/:id/prompt`
2. Server emits `session:prompt_send` domain event
3. WebSocketBridge pushes to UI
4. UI finds the target terminal (by maestro session ID → PTY mapping)
5. `sendPromptToSession()` writes text to PTY stdin + sends Enter
6. Worker receives it as a user message and processes it

The message appears in the worker's context as if a human typed it. The worker adjusts its approach accordingly.

### Intervention Patterns

**Direct fix suggestion:**
```bash
maestro session prompt <id> --message "The build error is because serde_json is not in your workspace Cargo.toml. Run: cargo add serde_json -p api-service"
```

**Course correction:**
```bash
maestro session prompt <id> --message "You're modifying the wrong file. The auth logic moved to src/auth/middleware.ts in the last refactor. Check there instead."
```

**Task reassignment:**
```bash
maestro session prompt <id> --message "Stop working on the API endpoint. Worker 2 already completed it. Instead, focus on writing integration tests for the /users endpoint."
```

**Priority change:**
```bash
maestro session prompt <id> --message "Pause your current work. There's a critical bug in production — the payment webhook is failing. Switch to debugging src/webhooks/payment.ts immediately."
```

---

## Phase 5: The Coordinator's Complete Workflow

### Coordinator Prompt Phases

The coordinator operates in phases. Here's how logs + task status + intervention integrate into each:

#### Phase: Spawn
```
1. Decompose parent task into subtasks
2. For each subtask, spawn a worker:
   maestro session spawn --task <id> --subject "..." --message "..."
3. Collect all spawned session IDs
4. No watcher setup needed — observation is on-demand
```

#### Phase: Monitor (The Core Loop)
```
LOOP (each coordinator turn):
  1. Prompt builder auto-fetches log digests + task statuses
     → Injects <coordinator_context> into prompt

  2. Coordinator reads context, assesses each worker:
     - Is it making progress? (fresh text entries, state = active)
     - Is it stuck? (stuck signal present, no text for >30s)
     - Has it completed its task? (task status = completed)
     - Is it going in the wrong direction? (text suggests misunderstanding)

  3. Intervene if needed:
     maestro session prompt <id> --message "<directive>"

  4. If a worker's task is complete, assign next:
     maestro session prompt <id> --message "Your next task is task_459: ..."

  5. If all tasks complete → exit loop → Phase: Verify

  6. If more detail needed on a worker:
     maestro session logs <id> --last 10
```

#### Phase: Recover
```
When a worker is stuck for >2 minutes:
  1. Fetch deeper logs: maestro session logs <id> --last 10
  2. Diagnose the issue from their text output
  3. Send help: maestro session prompt <id> --message "..."
  4. If still stuck after intervention, consider re-spawning
```

#### Phase: Verify
```
1. Check all tasks are completed: maestro task children <parentId>
2. Optionally verify quality by reading worker output
3. Report completion: maestro session report complete "All N tasks completed."
```

### The "Passive Read → Active Write" Pattern

The coordinator's primary loop is:

```
PASSIVE: Read logs + task status from prompt context (zero tool calls)
ACTIVE:  Send directive via session prompt (one tool call per intervention)
```

The prompt builder fetches fresh data from the server on each turn. The coordinator never needs to poll — observation is automatic and free.

---

## Implementation Plan

### Component Inventory

| Component | File | Status | Effort |
|---|---|---|---|
| LogDigestService | `maestro-server/src/application/services/LogDigestService.ts` | **New** | Medium |
| REST: `GET /sessions/:id/log-digest` | `maestro-server/src/api/sessionRoutes.ts` | New endpoint | Small |
| REST: `GET /sessions/log-digests` | `maestro-server/src/api/sessionRoutes.ts` | New endpoint | Small |
| Container wiring | `maestro-server/src/container.ts` | Wire service | Small |
| CLI: `maestro session logs` | `maestro-cli/src/commands/session.ts` | New command | Medium |
| CLI permission | `maestro-cli/src/services/command-permissions.ts` | 1-line add | Tiny |
| Prompt context injection | `maestro-cli/src/services/prompt-builder.ts` | New method | Medium |
| Coordinator workflow update | `maestro-cli/src/prompts/workflow-phases.ts` | Update phases | Small |

**Removed from previous plan:** No `session:log_digest` domain event, no WebSocketBridge changes, no auto-watch on spawn, no background polling loop.

### Implementation Phases (Ordered)

#### Phase A: LogDigestService (Foundation)

Create a **stateless** service that reads JSONL files on-demand.

**File:** `maestro-server/src/application/services/LogDigestService.ts`

1. **JSONL file discovery:**
   - Resolve session → project → `workingDir`
   - Encode cwd to directory name
   - Scan `~/.claude/projects/{encoded_cwd}/*.jsonl`
   - Match by `<session_id>` tag in first 8KB
   - Cache `sessionId → filePath` mapping (LRU with 60s TTL, refreshed on miss)

2. **Tail reading:**
   - Seek to end of file minus buffer (configurable, default 100KB)
   - Read tail bytes, split into complete JSONL lines
   - For `--last N`, read enough data to find N text entries (expand buffer if needed)

3. **Text extraction:**
   - `extractTextEntries()` — assistant `type: 'text'` blocks only
   - `extractUserPrompts()` — real user messages (not meta/tool-results)
   - `computeStuckSignal()` — no text + high tool call count = warning
   - All from the same tail read — single pass through the data

4. **Return `TextOnlyDigest`:**
   - Last N text entries (default 5)
   - Session state (from session service)
   - Stuck signal (computed from tail)
   - Last activity timestamp

**Key property:** After the request completes, no server state remains. The next request re-reads from disk.

#### Phase B: REST Endpoints

Add two endpoints to `maestro-server/src/api/sessionRoutes.ts`:

**`GET /api/sessions/:id/log-digest`**

Single session digest. Used by `maestro session logs` CLI command.

```typescript
router.get('/sessions/:id/log-digest', async (req, res) => {
  const last = parseInt(req.query.last as string) || 5;
  const digest = await logDigestService.getDigest(req.params.id, { last });
  res.json(digest);
});
```

Query params:
- `?last=N` — number of text entries to return (default: 5)

**`GET /api/sessions/log-digests`**

Multi-session digests. Used by prompt builder for `<coordinator_context>`.

```typescript
router.get('/sessions/log-digests', async (req, res) => {
  const last = parseInt(req.query.last as string) || 5;

  if (req.query.parentSessionId) {
    const digests = await logDigestService.getWorkerDigests(
      req.query.parentSessionId as string, { last }
    );
    return res.json(digests);
  }

  if (req.query.sessionIds) {
    const ids = (req.query.sessionIds as string).split(',').map(s => s.trim());
    const digests = await logDigestService.getDigests(ids, { last });
    return res.json(digests);
  }

  res.status(400).json({ error: 'Provide parentSessionId or sessionIds' });
});
```

Query params:
- `?parentSessionId=<id>` — all active workers under this coordinator
- `?sessionIds=<csv>` — specific sessions
- `?last=N` — entries per session (default: 5)

#### Phase C: CLI Command — `maestro session logs`

**File:** `maestro-cli/src/commands/session.ts`

```bash
# Last 5 text entries from a specific worker
maestro session logs sess_abc123 --last 5

# All workers under this coordinator
maestro session logs --my-workers --last 5

# Multiple workers
maestro session logs sess_abc,sess_def --last 10

# JSON output for programmatic use
maestro session logs --my-workers --json
```

Implementation:
```typescript
session.command('logs [sessionIds]')
  .description('Get text output from worker sessions')
  .option('--my-workers', 'All worker sessions spawned by this coordinator')
  .option('--last <n>', 'Number of text entries per session (default: 5)', parseInt)
  .option('--json', 'Output as JSON')
  .action(async (sessionIds, cmdOpts) => {
    await guardCommand('session:logs');

    let ids: string[];
    if (cmdOpts.myWorkers) {
      const myId = config.sessionId;
      const sessions = await api.get(`/api/sessions?parentSessionId=${myId}&active=true`);
      ids = sessions.map((s: any) => s.id);
    } else if (sessionIds) {
      ids = sessionIds.split(',').map((s: string) => s.trim());
    } else {
      console.error('Provide session IDs or use --my-workers');
      process.exit(1);
    }

    const last = cmdOpts.last || 5;

    if (ids.length === 1) {
      const digest = await api.get(`/api/sessions/${ids[0]}/log-digest?last=${last}`);
      printDigest(digest, cmdOpts.json);
    } else {
      const digests = await api.get(
        `/api/sessions/log-digests?sessionIds=${ids.join(',')}&last=${last}`
      );
      for (const d of digests) printDigest(d, cmdOpts.json);
    }
  });
```

Human-readable output:
```
[sess_abc123 | Frontend Dev | active]
  [14:32:05] "I'll start by reading the login component..."
  [14:32:12] "Found the issue — email regex doesn't handle plus signs."
  [14:32:18] "Login validation fixed. All 12 tests pass."

[sess_def789 | Backend Dev | idle_15s] ⚠ STUCK
  [14:31:55] "Starting the database migration."
  [14:32:02] "Hit a build error — missing serde_json dependency."
  [14:32:10] "Build error persists. Investigating workspace config."
  ⚠ No text output for 45s (8 tool calls since last text)
```

Add `session:logs` to command permissions in `command-permissions.ts`.

#### Phase D: Prompt Context Injection (The Big Unlock)

**File:** `maestro-cli/src/services/prompt-builder.ts`

When building the coordinator's prompt, the CLI fetches fresh log digests and task statuses from the server, then injects them as `<coordinator_context>`.

```typescript
// New method in PromptBuilder
private async buildCoordinatorContext(manifest: Manifest): Promise<string> {
  // Only for coordinate mode
  if (manifest.mode !== 'coordinate') return '';

  const sessionId = process.env.MAESTRO_SESSION_ID;
  if (!sessionId) return '';

  const serverUrl = process.env.MAESTRO_SERVER_URL;
  if (!serverUrl) return '';

  try {
    // Fetch log digests for all workers under this coordinator
    const digestsResponse = await fetch(
      `${serverUrl}/api/sessions/log-digests?parentSessionId=${sessionId}&last=5`
    );
    const digests: TextOnlyDigest[] = await digestsResponse.json();

    // Fetch task statuses (child tasks)
    const tasksResponse = await fetch(
      `${serverUrl}/api/tasks?parentSessionId=${sessionId}`
    );
    const tasks = await tasksResponse.json();

    if (digests.length === 0 && tasks.length === 0) return '';

    let xml = '<coordinator_context>\n';

    // Task board
    if (tasks.length > 0) {
      xml += '  <task_board>\n';
      for (const t of tasks) {
        xml += `    <task id="${t.id}" title="${t.title}" status="${t.status}"`;
        if (t.assignee) xml += ` assignee="${t.assignee}"`;
        xml += ' />\n';
      }
      xml += '  </task_board>\n';
    }

    // Session activity
    if (digests.length > 0) {
      xml += '  <session_activity>\n';
      for (const d of digests) {
        const stuckAttr = d.stuck ? ' stuck="true"' : '';
        xml += `    <session id="${d.sessionId}" worker="${d.workerName || 'unknown'}" state="${d.state}"${stuckAttr}>\n`;
        for (const e of d.entries) {
          const time = new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false });
          xml += `      [${time}] ${JSON.stringify(e.text)}\n`;
        }
        if (d.stuck) {
          xml += `      ⚠ ${d.stuck.warning}\n`;
        }
        xml += '    </session>\n';
      }
      xml += '  </session_activity>\n';
    }

    xml += '</coordinator_context>';
    return xml;
  } catch {
    // Server not reachable — return empty (graceful degradation)
    return '';
  }
}
```

This is called during `buildTaskXml()` for coordinators. The coordinator sees fresh worker data on every turn without spending any tool calls.

**When does this context refresh?** Every time the coordinator's prompt is rebuilt — which happens at the start of each turn. So the coordinator always sees the latest state.

#### Phase E: Coordinator Workflow Phase Updates

**File:** `maestro-cli/src/prompts/workflow-phases.ts`

Update the coordinator workflow phases to reference the new observation model:

**COORDINATE_MONITOR_PHASE** — updated instruction:
```
Your prompt contains a <coordinator_context> block with real-time worker visibility:
- <task_board>: current status of all child tasks
- <session_activity>: latest text output from each worker session

This context refreshes automatically each turn. Use it to:
1. Monitor progress — workers with recent text entries are progressing normally
2. Detect stuck workers — look for ⚠ stuck signals or idle sessions with no new text
3. Intervene when needed:
   maestro session prompt <sessionId> --message "<helpful directive>"
4. Assign next tasks when workers complete:
   maestro session prompt <sessionId> --message "Your next task is..."
5. For deeper inspection, fetch more log history:
   maestro session logs <sessionId> --last 10
6. For definitive task status:
   maestro task children <parentTaskId>

Do NOT wait passively. If a worker appears stuck or misdirected, intervene immediately.
```

**COORDINATE_RECOVER_PHASE** — updated to reference `session logs` for diagnosis:
```
When a worker appears stuck (⚠ signal in session_activity, or no progress for multiple turns):
1. Fetch detailed logs: maestro session logs <sessionId> --last 10
2. Diagnose the issue from their text output
3. Send targeted help: maestro session prompt <sessionId> --message "..."
4. If the worker remains stuck after intervention, consider re-spawning the session
```

---

## Key Design Decisions

### 1. On-Demand Stateless Reads (No Persistent Watchers)

**Decision:** The server reads JSONL files only when a request comes in. No background polling, no watcher lifecycle, no managed state.

**Rationale:** Persistent watchers require lifecycle management (start/stop/cleanup/orphan handling). The coordinator is an LLM agent that processes turns discretely — it doesn't benefit from real-time push. On-demand reads are simpler, more reliable, and performant enough (file tail reads take <10ms).

### 2. Text-Only (No Tool Calls in Digest)

**Decision:** Only extract `type: 'text'` blocks from assistant messages.

**Rationale:** The agent's text output already summarizes tool call activity in natural language. Sending tool calls to the coordinator is noise — it tells *what files were touched* but not *why* or *whether progress is being made*. Text output answers the questions a coordinator actually asks: Is the worker progressing? Is it stuck? What did it accomplish?

### 3. Count-Based Entry Limit (Not Time-Based)

**Decision:** Return last N text entries per worker (default 5), not entries from a time window.

**Rationale:** Agent turns vary wildly (some produce 10 entries in 5 seconds, others 1 entry in 30 seconds). Count-based gives predictable token budgets:
- 5 entries × 5 workers × ~35 tokens = ~875 tokens (negligible)

### 4. Prompt Context Injection (Not CLI Polling)

**Decision:** Inject `<coordinator_context>` directly into the coordinator's prompt. The CLI fetches digests during prompt building.

**Rationale:** CLI polling requires the coordinator to spend tool calls to check on workers. Prompt injection gives **passive awareness** — the coordinator just sees what's happening as part of its context. Zero overhead per observation cycle.

### 5. File Path Caching Only

**Decision:** Cache sessionId → JSONL filePath mapping. Do not cache file contents or parsed entries.

**Rationale:** File path resolution (scanning directory + reading 8KB headers) is the slow part (~50ms first time). Actual file tail reads are fast (<10ms). Caching the path mapping avoids repeated directory scans while ensuring digest data is always fresh from disk.

### 6. `session prompt` as the Single Intervention Path

**Decision:** All coordinator → worker communication goes through `maestro session prompt`.

**Rationale:** Direct PTY injection is instant, reliable, and already implemented. The worker receives it as a user message — the most natural input channel for an LLM agent. No indirection, no waiting.

---

## Architecture

### On-Demand Logs + Task Status + Direct Prompt

```
Coordinator spawns 3 workers
  → On each turn, prompt context auto-includes:

  [Worker 1] "Reading the auth config to understand the structure..."
  [Worker 2] "Hit a build error — missing serde_json dependency."
  [Worker 3] "Running grep to find all API endpoints..."

  → Coordinator sees Worker 2 struggling, sends fix IMMEDIATELY:
     maestro session prompt sess_w2 --message "Run: cargo add serde_json"
  → Worker 2 receives the fix in <1 second, applies it, continues
  → Coordinator sees Worker 1 and 3 progressing, does nothing
  → 2 minutes later, Worker 1 completes → task status updates
  → Coordinator assigns next task via session prompt

  Total token cost for observation: ~200 tokens per update cycle
  Server state managed: none (stateless reads)
```

**Improvements:** Real-time visibility. Zero-delay intervention. No worker self-reporting required. Predictable token costs. No server state to manage. Coordinator is proactive, not reactive.
