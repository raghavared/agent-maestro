# Design: Compacted Session Log Streaming for Coordinators

## Problem Statement

Today, coordinators are **blind between mail messages**. After spawning worker sessions and assigning tasks, a coordinator must wait for explicit `maestro mail send` reports from workers to learn what is happening. This creates several problems:

1. **Latency** — The coordinator only learns about progress when the worker decides to report. If the worker is deep in a multi-step operation, the coordinator gets no signal for minutes.
2. **Missed context** — Workers summarize in their own words. The coordinator never sees *what tools were used*, *what files were read/edited*, or *whether the agent is stuck in a loop*.
3. **Poor error recovery** — If a worker is spinning (retrying a failing test, reading the wrong file repeatedly), the coordinator can't detect and intervene until the worker explicitly reports being blocked.
4. **No real-time coordination** — The coordinator can't make intelligent batching, re-prioritization, or dependency-resolution decisions without knowing the live state of all workers.

## Core Idea

**Stream compacted, token-efficient summaries of each worker's JSONL session log to the coordinator in near-real-time.**

The coordinator doesn't need the full log (which can be megabytes of raw JSONL with tool inputs/outputs, thinking blocks, and system noise). Instead, it needs a **compact activity feed** — a structured digest that captures the *what* and *when* of each session at a fraction of the token cost.

## Architecture

```
Worker Session (Claude Code)
  │
  ├── Writes JSONL log to ~/.claude/projects/{encoded_cwd}/{session}.jsonl
  │
  ▼
maestro-server  (new: LogWatcher service)
  │
  ├── 1. Tails each active worker's JSONL file (byte-offset polling, ~3s interval)
  ├── 2. Parses new lines → classifies → compacts → builds digest
  ├── 3. Stores latest digest per session in memory
  │
  ├── Option A: Coordinator polls via CLI
  │   └── `maestro session watch-logs [--compact]` — pulls digests for all workers
  │
  ├── Option B: Push via mail
  │   └── Server auto-sends compacted digest as mail (type: 'log_digest') every N seconds
  │
  ├── Option C: WebSocket push to UI
  │   └── Emit 'session:log_digest' events → UI renders live activity feed
  │
  ▼
Coordinator Session
  └── Receives compact digests → makes informed decisions
```

## Compaction Strategy

### What to Keep (Signal)

| Category | What Gets Compacted | Example Output |
|---|---|---|
| **Tool calls** | Tool name + key args (file paths, commands) | `Read: src/api.ts` / `Edit: src/config.ts (3 changes)` / `Bash: npm test` |
| **Tool results** | Success/failure + error summary (first 80 chars) | `✓ Read 245 lines` / `✗ Bash: exit 1 "ENOENT: no such file"` |
| **Text output** | First sentence of each AI text block (≤100 chars) | `"I'll start by reading the configuration..."` |
| **Task coordination** | Full details (these are already compact) | `TaskUpdate: task_123 → completed` / `SendMessage → researcher` |
| **File operations** | File path + operation type | `Write: tests/auth.test.ts (new)` / `Edit: src/login.ts (+12 -3)` |
| **Session state** | Active/idle transitions, thinking indicators | `[THINKING]` / `[IDLE since 15s]` / `[ACTIVE: tool_use]` |
| **Errors** | Full error messages (critical signal) | `Error: Cannot find module './missing'` |

### What to Drop (Noise)

- **Thinking block contents** — Only keep `[THINKING]` marker with duration
- **Full file contents** from Read results — Only keep line count
- **Tool input details** — Only keep the key argument (path, command)
- **System reminders** / `<local-command-*>` tags — Already classified as HARD_NOISE
- **Image content** — Drop entirely, note `[IMAGE]`
- **Cache/token metadata** — Aggregate into periodic summary, don't send per-message
- **Duplicate/repeated tool calls** — Collapse consecutive reads of the same file

### Token Budget

Target: **~50-100 tokens per API turn** in the compacted digest (vs. ~2000-10000 tokens raw).

A coordinator watching 5 workers for 10 minutes (~30 turns each) would consume:
- **Compacted:** 5 × 30 × 75 tokens = **~11,250 tokens** (trivial)
- **Raw:** 5 × 30 × 5,000 tokens = **~750,000 tokens** (prohibitive)

This is a **~67x compression ratio**.

## Compact Digest Format

Each digest covers a time window (e.g., last 5 seconds of activity) for one session:

```
[sess_abc123 | Worker: "Frontend Dev" | task_456]
  14:32:05  Read: src/components/Login.tsx (312 lines)
  14:32:06  [THINKING 2.1s]
  14:32:08  Edit: src/components/Login.tsx (+8 -2) — added validation
  14:32:09  Read: src/utils/auth.ts (89 lines)
  14:32:10  Bash: npm test -- --testPathPattern=Login ✓ (4 passed)
  14:32:12  "Login validation is now working. Moving to the signup form..."
  tokens: 1.2k in / 0.4k out | cache: 89%
```

For the coordinator's context, this is ~60 tokens and tells the full story.

### Structured Format (for programmatic consumption)

```typescript
interface CompactDigest {
  sessionId: string;
  sessionName: string;
  teamMemberName?: string;
  taskIds: string[];
  windowStart: number;      // epoch ms
  windowEnd: number;
  state: 'active' | 'idle' | 'thinking' | 'needs_input';

  entries: CompactEntry[];

  // Aggregated metrics for the window
  metrics: {
    inputTokens: number;
    outputTokens: number;
    cacheHitPct: number;
    toolCallCount: number;
    errorCount: number;
  };
}

interface CompactEntry {
  timestamp: number;
  type: 'tool' | 'text' | 'thinking' | 'error' | 'state' | 'coordination';
  summary: string;          // ≤120 chars, the compact one-liner
  toolName?: string;        // For tool entries
  isError?: boolean;
}
```

## Implementation Plan

### Phase 1: Server-Side Log Tailing + Compaction (Backend)

**New file:** `maestro-server/src/infrastructure/LogWatcherService.ts`

This service runs server-side and:

1. **Discovers log files** — For each active session, resolves the JSONL path from `~/.claude/projects/{encoded_cwd}/{filename}.jsonl`. The session's `cwd` is available from the session metadata, and the filename can be found by matching `maestroSessionId` in the first 8KB (same logic as the Rust `extract_maestro_session_id`).

2. **Tails with byte offset** — Maintains a `Map<sessionId, { filePath, offset }>`. Every 3 seconds, reads new bytes from each file, splits into JSONL lines, parses.

3. **Classifies and compacts** — Port the TypeScript classifier/grouper logic (already exists in `maestro-ui/src/utils/claude-log/`) to the server:
   - Reuse `messageClassifier.ts` logic to drop HARD_NOISE
   - Reuse `contextTracker.ts` logic for token aggregation
   - Apply the compaction rules above to produce `CompactEntry[]`

4. **Stores in memory** — `Map<sessionId, CompactDigest>` with a rolling window (last 60 seconds of entries, older entries archived into a cumulative summary).

**Key insight:** The parsing/classification code already exists in the UI codebase (`maestro-ui/src/utils/claude-log/`). We can either:
- **(a)** Extract it into a shared package (ideal but more work), or
- **(b)** Port the key functions (~200 lines) to the server. The logic is straightforward (JSONL parse, regex classification, tool name extraction).

Recommendation: **(b)** for Phase 1 — keep it simple, port just the compaction logic.

### Phase 2: CLI Command for Coordinator Polling

**New CLI command:** `maestro session logs <sessionId> [--compact] [--follow]`

```bash
# One-shot: get compact digest of a worker's recent activity
maestro session logs sess_abc123 --compact

# Follow mode: stream compact digests as they arrive (like tail -f)
maestro session logs sess_abc123 --compact --follow

# All workers: show compact digests for all sessions under current coordinator
maestro session logs --all --compact
```

**Server endpoint:** `GET /api/sessions/:id/log-digest`
- Returns the latest `CompactDigest` for the session
- Query params: `?since=<epochMs>` for incremental fetches

**Server endpoint:** `GET /api/sessions/log-digests?projectId=X&parentSessionId=Y`
- Returns digests for all active worker sessions under a coordinator
- This is the "dashboard" endpoint

### Phase 3: Auto-Push Digests to Coordinator (Mail Integration)

Add a configuration option to the coordinator's workflow:

```yaml
logStreaming:
  enabled: true
  interval: 10000        # Push digest every 10 seconds
  compactLevel: 'normal' # 'minimal' | 'normal' | 'verbose'
  onError: 'immediate'   # Push errors immediately, don't wait for interval
```

When enabled, the `LogWatcherService` automatically sends a `log_digest` mail message to the coordinator session every `interval` ms:

```bash
# Auto-sent by server, appears in coordinator's inbox
maestro mail inbox
# → [log_digest] from sess_worker1: "Read src/api.ts, Edit src/api.ts (+5 -2), Bash: npm test ✓"
# → [log_digest] from sess_worker2: "Bash: npm install ✗ (EACCES), [BLOCKED since 12s]"
```

The coordinator can then react: send a directive to the blocked worker, re-assign the task, or just continue waiting.

### Phase 4: Coordinator Prompt Integration

Update the coordinator's system prompt (via `prompt-builder.ts`) to include a `<live_session_activity>` section:

```xml
<live_session_activity>
  <session id="sess_abc123" worker="Frontend Dev" task="task_456" state="active">
    14:32:05 Read: src/components/Login.tsx (312 lines)
    14:32:08 Edit: src/components/Login.tsx (+8 -2)
    14:32:10 Bash: npm test ✓ (4 passed)
    14:32:12 "Moving to signup form..."
  </session>
  <session id="sess_def789" worker="Backend Dev" task="task_457" state="idle_12s">
    14:31:58 Bash: cargo build ✗ (3 errors)
    14:32:02 Read: src/lib.rs (540 lines)
    14:32:04 [THINKING 8.2s]
    ⚠ No activity for 12 seconds after thinking block
  </session>
</live_session_activity>
```

This gives the coordinator **inline visibility** without needing to poll mail or run commands.

### Phase 5: WebSocket Push to UI (Visual Dashboard)

Emit `session:log_digest` events via WebSocket → UI renders a real-time activity feed panel showing all workers' compacted activity side-by-side. This enhances the existing `SessionLogStrip` and `SessionLogModal` components.

## Compaction Algorithm (Detailed)

```typescript
function compactMessage(msg: ParsedMessage): CompactEntry | null {
  // 1. Skip noise
  if (isHardNoiseMessage(msg)) return null;

  // 2. Handle assistant messages
  if (msg.type === 'assistant' && Array.isArray(msg.content)) {
    const entries: CompactEntry[] = [];

    for (const block of msg.content) {
      if (block.type === 'thinking') {
        // Collapse thinking to duration marker
        const duration = estimateThinkingDuration(block.thinking);
        entries.push({
          type: 'thinking',
          summary: `[THINKING ${duration}s]`,
          timestamp: msg.timestamp.getTime()
        });
      }
      else if (block.type === 'text' && block.text.trim()) {
        // First sentence, max 100 chars
        const summary = block.text.trim().split(/[.\n]/)[0].slice(0, 100);
        entries.push({
          type: 'text',
          summary: `"${summary}${summary.length >= 100 ? '...' : ''}"`,
          timestamp: msg.timestamp.getTime()
        });
      }
      else if (block.type === 'tool_use') {
        entries.push(compactToolCall(block, msg.timestamp));
      }
    }
    return mergeEntries(entries);
  }

  // 3. Handle tool results (user messages with isMeta)
  if (msg.type === 'user' && msg.isMeta) {
    for (const tr of msg.toolResults) {
      return compactToolResult(tr, msg.timestamp);
    }
  }

  return null;
}

function compactToolCall(block: ToolUseContent, timestamp: Date): CompactEntry {
  const name = block.name;
  const input = block.input;

  // Extract the key argument based on tool type
  let summary: string;
  switch (name) {
    case 'Read':
      summary = `Read: ${shortPath(input.file_path)}`;
      break;
    case 'Edit':
      summary = `Edit: ${shortPath(input.file_path)}`;
      break;
    case 'Write':
      summary = `Write: ${shortPath(input.file_path)}`;
      break;
    case 'Bash':
      summary = `Bash: ${String(input.command).slice(0, 60)}`;
      break;
    case 'Glob':
      summary = `Glob: ${input.pattern}`;
      break;
    case 'Grep':
      summary = `Grep: "${input.pattern}" ${input.path || ''}`;
      break;
    case 'Task':
      summary = `Task(${input.subagent_type}): ${String(input.description).slice(0, 50)}`;
      break;
    // Task coordination tools — keep full detail
    case 'SendMessage':
    case 'TaskCreate':
    case 'TaskUpdate':
    case 'TaskList':
      summary = `${name}: ${JSON.stringify(input).slice(0, 80)}`;
      break;
    default:
      summary = `${name}: ${JSON.stringify(input).slice(0, 60)}`;
  }

  return { type: 'tool', toolName: name, summary, timestamp: timestamp.getTime() };
}

function shortPath(p: unknown): string {
  const s = String(p || '');
  // Keep last 2 path segments: "src/components/Login.tsx"
  const parts = s.split('/');
  return parts.length > 2 ? parts.slice(-2).join('/') : s;
}
```

### Deduplication Rules

To further compress, consecutive identical operations get collapsed:

```
// Before dedup:
Read: src/api.ts
Read: src/api.ts
Read: src/api.ts

// After dedup:
Read: src/api.ts (×3)
```

```
// Before dedup:
Grep: "handleAuth" in src/
Grep: "handleAuth" in tests/
Grep: "validateToken" in src/

// After dedup (same tool, different args — no collapse, but compact):
Grep: "handleAuth" src/ → "handleAuth" tests/ → "validateToken" src/
```

## Token Cost Analysis

### Per-Turn Compaction

| Raw Element | Raw Tokens | Compacted Tokens | Ratio |
|---|---|---|---|
| Thinking block (2000 chars) | ~500 | 3 (`[THINKING 2.1s]`) | 167x |
| Read result (file contents) | ~1000 | 8 (`Read: src/api.ts (312 lines)`) | 125x |
| Bash output (test results) | ~400 | 10 (`Bash: npm test ✓ (4 passed)`) | 40x |
| Edit input (old/new strings) | ~200 | 10 (`Edit: src/api.ts (+8 -2)`) | 20x |
| AI text output (paragraph) | ~100 | 25 (first sentence) | 4x |
| Tool result error | ~80 | 15 (truncated error) | 5x |
| System reminder | ~200 | 0 (dropped) | ∞ |

**Average compaction: ~50-100x** depending on the mix of operations.

### Coordinator Budget (Realistic Scenario)

- 5 workers, 20-minute session, ~40 turns each
- Raw: 5 × 40 × 5,000 = 1,000,000 tokens
- Compacted: 5 × 40 × 75 = 15,000 tokens
- **With rolling window (last 60s):** Even less — only ~5 entries per worker visible at any time = ~1,875 tokens total for the live view

## Integration with Existing Infrastructure

### Reusing Existing Code

| Existing Module | Reuse In |
|---|---|
| `claude_logs.rs` (tail_claude_session_log) | LogWatcherService uses same byte-offset tailing approach |
| `messageClassifier.ts` | Port `isHardNoiseMessage()` to server for filtering |
| `contextTracker.ts` | Port `estimateTokens()` for budget tracking |
| `parseJsonl.ts` | Port `parseJsonlText()` for server-side parsing |
| `sessionState.ts` | Port `checkMessagesOngoing()` for state detection |
| `groupMessages.ts` | Optional — grouping is nice-to-have for server compaction |

### Fitting Into Existing Patterns

- **Mail system** — Log digests use the existing mail infrastructure (`type: 'log_digest'`). No new transport needed.
- **Timeline events** — Key events (errors, state changes) also get written to the session timeline for persistence.
- **WebSocket events** — `session:log_digest` follows the same pattern as `session:spawn`, `task:updated`, etc.
- **CLI commands** — `maestro session logs` follows the existing `maestro session {info|watch|...}` pattern.

## Coordinator Workflow: Before vs. After

### Before (Current)

```
Coordinator spawns 3 workers
  → Waits...
  → Worker 1 sends mail: "task complete"     (3 minutes later)
  → Worker 2 sends mail: "blocked on X"      (5 minutes later)
  → Worker 3: silence...                       (is it stuck? working? dead?)
  → Coordinator: "maestro mail inbox" → only sees 2 messages
  → Has no idea what Worker 3 is doing
```

### After (With Compacted Log Streaming)

```
Coordinator spawns 3 workers
  → Every 10s, receives compact digests:

  [Worker 1] Read config.ts → Edit config.ts (+3 -1) → Bash: npm test ✓
  [Worker 2] Bash: cargo build ✗ (3 errors) → Read lib.rs → [THINKING 12s] ⚠
  [Worker 3] Grep: "authMiddleware" → Read: auth.ts → Edit: auth.ts → Bash: npm test ✓

  → Coordinator sees Worker 2 struggling, sends directive immediately
  → Coordinator sees Worker 1 and 3 progressing, adjusts next task assignments
  → Total token cost: ~200 tokens for this update across all 3 workers
```

## Open Questions & Trade-offs

### 1. Pull vs. Push

| Approach | Pros | Cons |
|---|---|---|
| **Pull (CLI polling)** | Simple, coordinator controls when to look | Adds tool calls to coordinator's context; coordinator must remember to poll |
| **Push (mail auto-send)** | Zero-effort for coordinator; always up-to-date | Can add noise if coordinator doesn't need it; consumes mail bandwidth |
| **Push (prompt injection)** | Directly in coordinator's context; most natural | Requires the `session prompt` feature; could interrupt coordinator's thinking |

**Recommendation:** Start with **Pull (Phase 2)** + **Push via mail (Phase 3)** as opt-in. The coordinator's workflow template can include instructions to periodically check logs, or enable auto-push for hands-free monitoring.

### 2. Server-Side vs. CLI-Side Compaction

| Approach | Pros | Cons |
|---|---|---|
| **Server-side** (LogWatcherService) | Single source of truth; UI and CLI both benefit; persistent | Server must access log files (co-located or shared filesystem) |
| **CLI-side** (coordinator runs compaction) | No server changes; works with existing tail command | Each coordinator re-parses independently; duplicated work |

**Recommendation:** **Server-side** — the server already has the paradigm of watching files (sessions are co-located), and centralized compaction benefits both the CLI and UI consumers.

### 3. Rolling Window Size

- **10 seconds** — Very responsive but frequent updates
- **30 seconds** — Good balance
- **60 seconds** — Less noise, but coordinator sees less live detail

**Recommendation:** Default **30 seconds**, configurable. Error events bypass the window and push immediately.

## Summary

This feature gives coordinators **real-time, token-efficient visibility** into worker sessions by:

1. Tailing JSONL logs server-side (reusing existing parsing infrastructure)
2. Applying aggressive compaction (~50-100x token reduction)
3. Delivering digests via CLI polling, mail push, or WebSocket
4. Integrating into the coordinator's prompt for inline awareness

The result: coordinators can make **faster, better-informed decisions** about task assignment, error recovery, and workflow orchestration — without waiting for workers to self-report.
