# Architecture Review: Session Coordination via Logs + Multi-Session Prompt

## Overall Verdict

**The architecture is solid.** Both designs follow clean patterns that fit naturally into Maestro's existing infrastructure. The multi-session prompt implementation is already working and well-integrated. The session log streaming design is thorough and has excellent token economics. Below are specific observations and improvement suggestions.

---

## Multi-Session Prompt (`maestro session prompt`) — Review

### What's Good

1. **Clean data flow**: CLI → REST → Domain Event → WebSocket → UI → PTY. Each layer does one thing. The existing `sendPromptToSession` function is properly reused.

2. **Proper validation**: Server validates session state before forwarding. Good use of 409 Conflict for inactive sessions.

3. **Audit trail**: Timeline events capture cross-session prompts — this is essential for debugging multi-agent workflows.

4. **Minimal diff**: Only ~120 lines across 6 files. Each file gets a focused, single-responsibility change.

### Suggestions for Improvement

#### 1. Source should be `'system'`, not `'user'`

In `useSessionStore.ts`, the `sendPromptToSession` function uses `source: 'user'` when writing to PTY. But when the prompt comes from another agent (via `session:prompt_send`), it's programmatic input. The design doc correctly says to use `source: 'system'`, but the current `sendPromptToSession` always uses `'user'`.

**Fix**: Either pass `source` through from the event handler, or create a separate path for system-originated prompts:

```typescript
// In useMaestroStore.ts handler:
void useSessionStore.getState().sendPromptToSession(
  terminalSession.id,
  { content },
  mode || 'send',
  'system'  // new param: source override
);
```

#### 2. Consider ACK/response event

Right now the flow is fire-and-forget. The sender gets `{ success: true }` from the server, but this only means the event was emitted — not that the PTY actually received the input. A `session:prompt_delivered` event (emitted by UI after successful `write_to_session`) would close the loop.

Not critical for v1, but useful when coordinators need to know if their directive actually landed.

#### 3. Content size limit

There's no max length on `content`. A malformed or buggy agent could send a massive string. Add a server-side limit:

```typescript
const MAX_PROMPT_LENGTH = 10_000; // 10KB should be more than enough
if (content.length > MAX_PROMPT_LENGTH) {
  return res.status(400).json({ error: `content exceeds max length (${MAX_PROMPT_LENGTH})` });
}
```

#### 4. Rate limiting consideration

A looping agent could spam `session prompt` in a tight loop. For v1, a simple in-memory counter (e.g., max 10 prompts/session/minute) would prevent runaway behavior without adding infrastructure.

---

## Compacted Session Log Streaming — Review

### What's Good

1. **Token economics are excellent**: 50-100x compression ratio means a coordinator can watch 5 workers for the cost of a single worker's thinking block. This makes real-time coordination economically viable.

2. **Progressive delivery options**: Pull (CLI) → Inline (prompt) → Visual (WebSocket) is a smart rollout path. Each phase adds value independently.

3. **Reuse of existing infrastructure**: The log parsing code already exists in `maestro-ui/src/utils/claude-log/`. The tailing approach matches what `claude_logs.rs` already does. No new transport needed — WebSocket is already there.

4. **The compaction algorithm is well-thought-out**: Keeping tool names + key args while dropping contents and thinking blocks is exactly the right signal-to-noise tradeoff.

### Suggestions for Improvement

#### 1. Phase 4 (Prompt Integration) is the real unlock — prioritize it

The most impactful phase is Phase 4 (injecting `<live_session_activity>` into the coordinator's prompt). CLI polling requires the coordinator to spend tool calls to check on workers. Phase 4 gives the coordinator **passive awareness** — it just sees what workers are doing as part of its context, with zero tool call overhead.

**Recommendation**: Build Phase 1 (compaction engine) + Phase 4 (prompt injection) first. The CLI log command (Phase 2) is a nice-to-have that can come later.

This pairs naturally with the `session prompt` feature: the coordinator reads the live activity from its prompt context, then uses `maestro session prompt` to send directives. No polling — just read context → act.

#### 2. Combine both features into a single coordinator loop

The two features together enable a powerful pattern:

```
Coordinator Prompt Context:
  <live_session_activity>   ← from log streaming (passive, read-only)
    [Worker 1] Edit: src/api.ts (+5 -2) → Bash: npm test ✓
    [Worker 2] Bash: cargo build ✗ (3 errors) → [THINKING 15s] ⚠
  </live_session_activity>

Coordinator Action:
  maestro session prompt <worker2> --message "Try adding the missing import for serde"
```

The key properties of this approach:
- **Observation** is passive (log streaming → prompt injection, no tool calls)
- **Action** is direct (session prompt → PTY)
- **The coordinator never polls** — it reads its context and acts

#### 3. Server-side compaction: share the code properly

The design recommends option (b) — porting ~200 lines to the server. This is fine for Phase 1, but both UI and server will diverge over time. A cleaner approach:

**Option (c): Extract to a shared `maestro-shared/` package**

Since the project already has `maestro-cli`, `maestro-server`, and `maestro-ui` as separate packages, a `maestro-shared` package for common TypeScript utilities is natural. The log parsing code (~6 files, ~500 lines) is a perfect candidate.

```
maestro-shared/
  src/
    claude-log/
      types.ts
      parseJsonl.ts
      messageClassifier.ts
      compactDigest.ts     ← new, the compaction logic
```

Both `maestro-server` and `maestro-ui` import from `maestro-shared`. This prevents drift and makes the compaction logic testable in isolation.

If this feels heavy, even symlinking or using TypeScript project references would work. The key is single source of truth for parsing/classification.

#### 4. Rolling window: use event count, not time

The design suggests a 30-second rolling window. But agent turns vary wildly — some turns have 10 tool calls in 5 seconds, others have one thinking block for 30 seconds. A count-based window (e.g., "last 20 entries per worker") provides more consistent digest sizes and more predictable token usage:

```typescript
interface CompactDigest {
  // ...
  entries: CompactEntry[];  // Max 20, FIFO eviction
  totalEntryCount: number;  // How many entries were produced since start
}
```

This guarantees the coordinator's context never bloats regardless of how fast a worker is operating.

#### 5. Error escalation: don't just mark, route

The design shows errors in digests as `✗` markers. Go further: when a worker hits consecutive errors (e.g., 3 failed Bash commands in a row), the LogWatcherService should automatically:

1. Elevate the session state to `needs_attention`
2. Send an immediate digest (bypass the interval)
3. Emit a `session:needs_attention` domain event for the coordinator to observe

This turns the log watcher from a passive reporter into an active coordinator assistant.

---

## Architectural Cleanups for the Combined System

### 1. Naming consistency

- The domain event is `session:prompt_send` but the timeline event is `prompt_received`. Pick one perspective. Suggestion: keep the domain event as `session:prompt` (the action) and the timeline event as `prompt_received` (from the receiver's POV). Drop the `_send` suffix — it's implied by the event being emitted.

### 2. Unify the coordinator's observation channels

A coordinator has two ways to learn about workers:
- **Session logs** (proposed) — compacted activity streams
- **Task list** (`maestro task list`) — task status changes

These should converge into a single `<coordinator_context>` block in the prompt:

```xml
<coordinator_context>
  <task_board>
    <!-- Current task statuses -->
  </task_board>
  <live_activity>
    <!-- Compacted log digests per worker -->
  </live_activity>
</coordinator_context>
```

This gives the coordinator everything it needs in one glance, at a predictable token budget.

### 3. The `sendPromptToSession` source tracking

For recording/replay, it's important to distinguish:
- Human typed input (`source: 'user'`)
- Cross-agent prompt (`source: 'system'` or new `source: 'agent'`)
- UI automation (`source: 'ui'`)

Consider adding `source: 'agent'` as a distinct category, with metadata about the sender session. This makes session recordings reproducible and debuggable.

---

## Implementation Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Multi-session prompt (already done!) | Done | High — enables direct coordination |
| **P1** | Log compaction engine (Phase 1) | Medium | Foundation for all log streaming |
| **P1** | Prompt context injection (Phase 4) | Medium | Highest coordinator impact |
| **P2** | Content size limit + source fix | Small | Safety/correctness |
| **P2** | CLI log command (Phase 2) | Small | Developer debugging |
| **P3** | Shared package extraction | Medium | Code health |
| **P4** | WebSocket UI dashboard (Phase 5) | Large | Visual, but not needed for agents |

---

## Summary

The architecture is good — clean separation, proper event-driven patterns, excellent token economics. The biggest win is combining both features into a **passive observation + direct action** loop for coordinators:

1. **Log streaming → prompt injection** gives the coordinator eyes (passive, cheap)
2. **`session prompt`** gives the coordinator hands (direct, instant delivery)

Together, this eliminates the bottleneck where coordinators are blind between explicit worker reports. The coordinator becomes proactive instead of reactive.
