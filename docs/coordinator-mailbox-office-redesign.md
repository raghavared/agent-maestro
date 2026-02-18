# Coordinator & Mailbox: Real Office Team Redesign

## The Core Problem

The current system treats agents like batch scripts — they get instructions, execute linearly, then report. A real office team operates **continuously and concurrently**: people work, chat, check in, get redirected, help each other, and escalate — all interwoven. The coordinator isn't a cron job that polls every 30 seconds; they're a team lead sitting in the same room, able to tap someone on the shoulder at any moment.

Here's how to close that gap.

---

## Part 1: The Office Team Metaphor — What's Missing

### 1.1 In a Real Office, People Can Talk to Each Other

**Current state**: Workers can technically send mail to any session ID, but they don't know their coworkers' IDs. The workflow never tells them to talk to peers. All communication flows through the coordinator like a bottleneck.

**Real office**: Team members lean over and ask "hey, did you already handle the auth module?" before duplicating work. They share findings. They coordinate on shared files.

**What we need**:
- Workers should know who their siblings are (who else is working on subtasks of the same parent)
- Workers should be able to message siblings by name/role, not by raw session ID
- The execute workflow should include peer communication guidance

### 1.2 In a Real Office, You Don't Ignore Your Boss Mid-Task

**Current state**: Workers execute all tasks sequentially, then check mail in a separate "communicate" phase. If the coordinator sends "STOP — requirements changed" during execution, the worker won't see it until they're done.

**Real office**: If your manager walks up and says "hold on, we need to pivot," you stop and listen.

**What we need**:
- Workers should check mail **between tasks**, not after all tasks
- For long-running single tasks, workers should check mail at natural breakpoints
- Critical/urgent messages should be treated differently from routine status updates

### 1.3 In a Real Office, the Team Lead Doesn't Poll Slack Every 30 Seconds

**Current state**: The coordinator is told to poll `mail inbox` and `task children` every 30-60 seconds in a loop. This is wasteful and slow — it burns context window on empty poll cycles.

**Real office**: The team lead gets **notified** when something happens. They don't stare at Slack refreshing every 30 seconds.

**What we need**:
- Coordinator should use `mail wait` as the primary monitoring mechanism (event-driven, not polling)
- The monitor phase should be restructured around: "wait for events, then react"

### 1.4 In a Real Office, You Know Your Manager

**Current state**: Workers are told to "message your coordinator" but aren't given the coordinator's session ID or a convenient shorthand.

**Real office**: You know who your manager is. You can walk to their desk.

**What we need**:
- `coordinatorSessionId` in the worker manifest
- `maestro mail send --to-coordinator` shorthand
- The init phase should tell workers: "Your coordinator is X — report to them via mail"

### 1.5 In a Real Office, Broadcasts Go to Your Team, Not the Whole Company

**Current state**: `mail broadcast` sends to ALL sessions in the project. If there are multiple coordinators running independent teams, broadcasts leak across boundaries.

**Real office**: "Hey team" means your team, not every team in the building.

**What we need**:
- Scoped broadcasts: `--scope my-workers` (sessions I spawned), `--scope team` (sessions sharing a team member), `--scope all` (project-wide, current behavior)
- Server-side: filter broadcasts by `parentSessionId` or `coordinatorSessionId`

---

## Part 2: Concrete Redesign Proposals

### Proposal 1: Redesign Execute Workflow — Interleave Communication

**Priority: Critical**

The single highest-impact change. Workers must check mail between tasks, not after.

```
EXECUTE_SIMPLE phases:
  1. init — Read tasks. Check inbox for initial coordinator directive.
  2. execute — For each task:
       a. Check mail inbox for new directives (before starting task)
       b. Execute the task
       c. Report completion
       d. If any directive changes priorities, adjust accordingly
  3. complete — Final report

EXECUTE_TREE phases:
  1. analyze — Read tree, check inbox for initial directive
  2. plan — Order tasks
  3. execute — Same as above: check mail before each task
  4. complete — Final report
```

**Key instruction text for the execute phase**:
```
Work through tasks in order. IMPORTANT: Before starting each task, check for new
directives from your coordinator:
  maestro mail inbox
If you receive a directive that changes your priorities or approach, adjust
accordingly before proceeding. After completing each task, report it:
  maestro task report complete <taskId> "<summary>"
```

### Proposal 2: Redesign Coordinator Monitor Phase — Event-Driven

**Priority: Critical**

Replace the polling loop with an event-driven wait loop.

```
Current (polling):
  "Check mail inbox and task children every 30-60 seconds"

Proposed (event-driven):
  1. maestro mail wait --timeout 60000   — block until mail arrives or timeout
  2. maestro mail inbox                  — process ALL pending messages
  3. maestro task children <parentId>    — check overall task status
  4. React: send directives, unblock workers, adjust plans
  5. Repeat until all tasks are completed or all workers have reported
```

**Key instruction text**:
```
Monitor workers using an event-driven loop:
  1. maestro mail wait --timeout 60000     — wait for worker messages
  2. maestro mail inbox                    — read all pending messages
  3. maestro task children <parentTaskId>  — check subtask statuses
  4. React to each message:
     - status_update → acknowledge, adjust if needed
     - query → answer via maestro mail reply <mailId> --message "<answer>"
     - blocked → investigate and send a directive to unblock
  5. Repeat until all subtasks are completed
```

### Proposal 3: Add Coordinator Identity to Worker Manifests

**Priority: High**

Workers need to know who their coordinator is and how to reach them.

**Manifest changes** (in `MaestroManifest` type):
```typescript
coordinatorSessionId?: string;   // The session that spawned this worker
```

**Prompt changes** (in `prompt-builder.ts`):
Add a `<coordinator>` block to the task prompt for execute mode:
```xml
<session_context>
  <session_id>sess_abc</session_id>
  <coordinator_session_id>sess_xyz</coordinator_session_id>
  <project_id>proj_123</project_id>
  <mode>execute</mode>
</session_context>
```

**CLI changes**:
- `maestro mail send --to-coordinator` — sends to `coordinatorSessionId` from env
- Set `MAESTRO_COORDINATOR_SESSION_ID` env var when spawning workers

### Proposal 4: Add Sibling Discovery for Workers

**Priority: High**

Workers should be able to find and communicate with their peers.

**Option A — Server-side endpoint**:
```
GET /api/sessions?parentSessionId=<coordId>&status=working
```
Returns sibling sessions spawned by the same coordinator.

**Option B — CLI command**:
```
maestro session list --siblings
```
Uses `MAESTRO_COORDINATOR_SESSION_ID` to find sessions spawned by the same parent.

**Option C — Include in manifest**:
When spawning workers, the coordinator could include sibling info in the task description or manifest context. But this is static — doesn't reflect workers that spawn later.

**Recommendation**: Option A + B combined. The server already has all the data. Add a query filter and a CLI shorthand.

### Proposal 5: Scoped Broadcasts

**Priority: Medium**

Add a `--scope` option to `mail broadcast`:

```
maestro mail broadcast --scope my-workers --type directive --subject "Pivot" --message "New requirements..."
maestro mail broadcast --scope all --type notification --subject "Heads up" --message "..."
```

**Server-side changes**:
- When `scope=my-workers`, server filters sessions where `parentSessionId === fromSessionId`
- This requires adding `parentSessionId` to the Session type (set when spawned)

**Alternative — simpler approach**:
Since the coordinator already collects session IDs during the spawn phase, they can just use `mail send <id1>,<id2>,<id3>` to message multiple workers. This already works. The broadcast scoping is a nice-to-have for ergonomics.

### Proposal 6: Add Mail Priority / Urgency

**Priority: Medium**

Not all messages are equal. A "requirements changed, stop work" directive is not the same as a "status check" query.

**MailMessage type change**:
```typescript
export interface MailMessage {
  // ... existing fields ...
  priority?: 'critical' | 'high' | 'normal' | 'low';  // NEW
}
```

**Behavioral impact**:
- `mail wait` should return immediately for `critical` priority messages
- `mail inbox` should sort by priority by default
- Workers checking mail should prioritize `critical` and `high` messages

**Workflow impact**:
Workers instructed to check mail should be told: "If you receive a critical directive, pause current work and address it immediately."

### Proposal 7: Include Initial Directive in Manifest Context

**Priority: Medium**

When a coordinator spawns with `--subject` and `--message`, the directive currently arrives as mail that the worker might check late (or never, if they finish fast).

**Fix**: Include the initial directive directly in the manifest:

```typescript
// In MaestroManifest:
initialDirective?: {
  subject: string;
  message: string;
  fromSessionId: string;
};
```

**Prompt rendering**:
```xml
<coordinator_directive>
  <subject>Implement the user authentication module</subject>
  <message>Use JWT tokens, integrate with the existing user service, add rate limiting...</message>
</coordinator_directive>
```

**The init phase** should explicitly mention: "If a coordinator_directive is present, read it carefully — it contains your coordinator's specific instructions for this task."

---

## Part 3: What a Real Office Flow Looks Like (End to End)

Here's how the redesigned system would work for a typical coordination scenario:

### Coordinator Flow:
```
1. ANALYZE: Read tasks, understand requirements
2. DECOMPOSE: Break into 3 subtasks (auth, API, frontend)
3. SPAWN: Spawn 3 workers in parallel, each with a directive:
   - Worker A gets "Implement JWT auth" with detailed instructions
   - Worker B gets "Build REST API endpoints"
   - Worker C gets "Create React login form"
4. MONITOR (event-driven loop):
   - mail wait --timeout 60000
   - Worker B sends: "query — should the API use REST or GraphQL?"
   - Reply: "REST, follow the existing pattern in /api/"
   - mail wait --timeout 60000
   - Worker A sends: "status_update — auth module done, JWT working"
   - task children shows: auth=completed, API=in_progress, frontend=in_progress
   - mail wait --timeout 60000
   - Worker C sends: "blocked — need the auth token format from Worker A"
   - React: mail send <workerA_session> asking for token format
   - OR: Reply to Worker C with the token format directly (coordinator knows it from the status update)
   - Continue until all done
5. VERIFY: task children shows all completed
6. COMPLETE: Report summary
```

### Worker Flow:
```
1. INIT: Read task. Read coordinator directive in manifest. Know coordinator session ID.
2. EXECUTE:
   - Check mail inbox (might have late-arriving context from coordinator)
   - Start Task 1
   - Complete Task 1, report it
   - Check mail inbox (any new directives? priority changes?)
   - Start Task 2
   - Hit a blocker: mail send --to-coordinator "I need X to proceed"
   - Check mail inbox — coordinator replied with the answer
   - Continue work
   - Complete Task 2, report it
3. COMPLETE: Session report complete
```

### Peer Communication (When Enabled):
```
Worker A finishes auth module.
Worker C needs the auth token format.
Worker C runs: maestro session list --siblings → sees Worker A
Worker C sends: maestro mail send <workerA> --type query --subject "Token format?" --message "What's the JWT payload structure?"
Worker A (in their next mail check): sees query, replies with the format
Worker C continues work without needing coordinator intervention
```

---

## Part 4: Implementation Priority

### Phase 1 — High Impact, Low Effort (Do First)
1. **Restructure execute workflow** to check mail between tasks (template change only)
2. **Restructure coordinator monitor** to use `mail wait` (template change only)
3. **Add `coordinatorSessionId`** to manifest + prompt + env var
4. **Include initial directive in manifest** context

### Phase 2 — Medium Effort, High Value
5. **Add `--to-coordinator` mail shorthand** (CLI change)
6. **Add sibling discovery** (`/api/sessions?parentSessionId=X` + CLI command)
7. **Add mail priority field** (server + CLI + workflow guidance)
8. **Add scoped broadcasts** (server-side parentSessionId tracking)

### Phase 3 — Larger Effort, Nice to Have
9. **Mail threading** (threadId field, thread endpoint, inbox grouping)
10. **Read receipts** (status field, mark-on-read, delivery events)
11. **Pipeline/collaborative workflow templates**
12. **Session health monitoring** (liveness checks, crash detection)

---

## Part 5: Key Design Principles

1. **Communication is continuous, not batched** — Workers check mail between tasks, not after all tasks.
2. **Events over polling** — Use `mail wait` for blocking event-driven loops, not timed polling cycles.
3. **Identity is known** — Workers know their coordinator. Coordinators know their workers. Peers can discover each other.
4. **Broadcasts are scoped** — "Hey team" means your team, not everyone.
5. **Urgency matters** — Critical directives interrupt; routine updates wait for the next check.
6. **Context is upfront** — Initial directives are in the manifest, not in a race-condition-prone mailbox delivery.
7. **Minimal token waste** — Event-driven monitoring avoids empty poll cycles that burn LLM context window on noise.
