# Coordinator & Mailbox System: Key Issues and Improvement Recommendations

## Executive Summary

After a deep analysis of the entire coordinator flow, mailbox system, workflow templates, prompt builder, command permissions, and server-side infrastructure, I've identified **14 key issues** across 5 categories that limit the system's power, flexibility, and ability to support autonomous multi-agent coordination.

---

## Category 1: Mailbox System Limitations

### Issue 1: No Read Receipts / Delivery Confirmation
**Severity: High**

When a coordinator sends a directive to a worker, there is no mechanism to confirm the worker actually received and read the mail. The `MailMessage` type has no `readAt`, `deliveredAt`, or `status` field. This means:
- Coordinator cannot distinguish "worker hasn't checked mail yet" from "worker is ignoring the directive"
- The monitor phase tells the coordinator to "send a status query if a worker goes silent" — but the coordinator has no way to know if even the status query was received
- No way to implement reliable message delivery guarantees

**Recommendation:** Add `status` field to MailMessage (`sent` → `delivered` → `read`) and automatically mark as `read` when fetched via `mail inbox`. Add a `mail:read` event so the coordinator can subscribe to delivery confirmations.

### Issue 2: No Threaded Conversations / Conversation Context
**Severity: High**

The `replyToMailId` field exists but there is no server-side support for:
- Fetching a full conversation thread
- Querying "all messages related to task X"
- Understanding conversation context when replying

Workers and coordinators see flat inboxes with no threading. When a coordinator sends a directive, gets a question back, and replies, there's no way to see this as a cohesive conversation. This is especially problematic when managing 5+ workers simultaneously — the inbox becomes an undifferentiated stream.

**Recommendation:** Add `GET /api/mail/thread/:mailId` endpoint that returns the full reply chain. Add `threadId` field to MailMessage (set to the root message ID). Add `--thread` flag to `mail inbox` to group messages by thread.

### Issue 3: No Priority / Urgency System for Mail
**Severity: Medium**

All mail is treated equally. A critical blocker notification looks the same as a routine status update in the inbox. The `type` field (`assignment`, `status_update`, `query`, `response`, `directive`, `notification`) provides some semantic categorization, but there's no urgency/priority mechanism.

**Recommendation:** Add `priority` field to MailMessage (`critical`, `high`, `normal`, `low`). Critical mail should interrupt `mail wait` immediately. Sort inbox by priority by default.

### Issue 4: Mail Wait Returns Only 1 Message Then Exits
**Severity: Medium**

`waitForMail()` resolves on the first `mail:received` event that matches, returning just that single message. If 3 messages arrive in rapid succession (e.g., 3 workers reporting completion simultaneously), only the first is caught by the wait. The worker must then call `mail inbox` to see the rest.

This means the "polling loop" pattern in the coordinator workflow is fragile — `mail wait` + `mail inbox` is essentially required as a pair, but the workflow templates only mention `mail inbox`.

**Recommendation:** Have `waitForMail()` collect messages over a short debounce window (e.g., 500ms after first message) before resolving. Or add a `--count` option to wait for N messages.

### Issue 5: Broadcast Delivery Is Unscoped
**Severity: Medium**

`mail broadcast` sends to ALL sessions in the project (`toSessionId: null`). The `findInbox` query matches on `toSessionId === null` (broadcast) OR `toSessionId === sessionId`. This means:
- A coordinator's broadcast goes to ALL sessions including itself
- There's no way to broadcast to "all my workers" vs "all sessions in the project"
- If there are multiple coordinators (nested coordination), broadcasts bleed across coordination boundaries

**Recommendation:** Add `scope` to broadcast: `all`, `my-workers` (sessions spawned by this coordinator), `team` (sessions with matching teamMemberId). Filter by `parentSessionId` on the server.

---

## Category 2: Coordinator Workflow Deficiencies

### Issue 6: No Worker-to-Worker Communication Path
**Severity: High**

Workers can only communicate with their coordinator. The execute workflow says "message your coordinator" for blockers. There is no workflow guidance or mechanism for peer-to-peer collaboration between workers.

In practice, workers CAN use `mail send <sessionId>` to message any session, and the team_members roster in the prompt includes `mail_id` for peers. But:
- Workers don't know other workers' session IDs (they only see team member mail_ids, not actual session IDs)
- The `--to-team-member` flag resolves to active sessions, but workers don't have a list of which team members are currently working
- The workflow templates never mention peer communication
- There's no discovery mechanism for workers to find siblings

**Recommendation:**
1. Add `maestro session list --siblings` for workers to discover other sessions spawned by their parent coordinator
2. Add peer communication guidance to the execute workflow templates
3. Include sibling session info in the worker's prompt (other workers on the same parent task)

### Issue 7: Coordinator Has No Event-Driven Monitoring
**Severity: High**

The coordinate workflow instructs the coordinator to "poll every 30-60 seconds" via `mail inbox` and `task children`. This is pure polling — wasteful and slow. The system HAS event infrastructure (`mail:received` events, WebSocket bridge, `mail wait` with long-polling), but the coordinator workflow doesn't use it.

The `mail wait` command exists and would be much better for monitoring, but it's never mentioned in any coordinate workflow template. The coordinator is told to poll in a loop instead of using `mail wait` to block until something interesting happens.

**Recommendation:** Restructure the monitor phase to use `mail wait` as the primary mechanism:
```
1. maestro mail wait --timeout 60000    — block until mail or timeout
2. maestro mail inbox                   — process all pending messages
3. maestro task children <parentTaskId> — check overall status
4. Repeat until all tasks complete
```

### Issue 8: No Session Status Awareness in Coordinator
**Severity: Medium**

The coordinator monitors task statuses but has limited visibility into session health. Key gaps:
- `session:list` shows sessions but doesn't indicate if a session is `idle`, `working`, `stopped`, or `failed`
- No `session watch` equivalent that blocks until a session status changes
- The coordinator can't detect if a worker's session crashed without the worker explicitly reporting an error
- `needsInput` status (worker hit a permission prompt) isn't surfaced in coordinator workflow

**Recommendation:**
1. Add `maestro session list --active --status` to show detailed session states
2. Add `session:status_changed` events that the coordinator can subscribe to
3. Add a `maestro session wait <sessionIds> --until <completed|any-change>` command for event-driven monitoring
4. Surface `needsInput` state in coordinator monitoring guidance

### Issue 9: No Coordinator Heartbeat or Liveness Check
**Severity: Medium**

If the coordinator session crashes or becomes unresponsive, workers have no way to detect this. They continue working and reporting to a dead coordinator. There's no:
- Heartbeat mechanism between coordinator and workers
- Escalation path for "my coordinator isn't responding"
- Supervisor/parent coordinator failover

**Recommendation:** Implement coordinator heartbeat: coordinator periodically broadcasts a heartbeat, workers check heartbeat freshness. If stale, workers can escalate to a parent session or report the issue.

---

## Category 3: Workflow Template Gaps

### Issue 10: Execute Workflow Treats Communication as Post-Completion
**Severity: High**

In EXECUTE_SIMPLE and EXECUTE_TREE, the "communicate" phase is phase 3 (after execute) or phase 4. This means:
- Workers execute first, then check mail afterward
- If the coordinator sends an urgent directive DURING execution (e.g., "stop, requirements changed"), the worker won't see it until after completing the current task
- There's no interleaving of work and communication

The phases are presented as sequential steps, not as concurrent activities. An LLM following these instructions will literally complete all work, then check mail.

**Recommendation:** Restructure execute workflow to interleave communication:
- Merge communicate into the execute phase: "After each task (or every 5 minutes of work), check `maestro mail inbox` for new directives before continuing"
- Or add explicit instruction: "Communication is continuous — check mail between tasks, not just after all tasks"

### Issue 11: No Workflow Template for Peer Coordination
**Severity: Medium**

All coordinate templates follow a strict hierarchy: coordinator decomposes → spawns workers → monitors. There's no template for:
- Collaborative workflows where multiple agents work on shared artifacts
- Swarm-style coordination where workers can self-organize
- Handoff patterns where one worker's output is another's input
- Pipeline coordination (A → B → C)

**Recommendation:** Add new workflow templates:
- `coordinate-pipeline`: For sequential handoff workflows
- `coordinate-collaborative`: For shared-artifact workflows where workers communicate directly
- `execute-collaborative`: For workers that need to coordinate with peers

### Issue 12: DAG Dependencies Are Encoded in Description Text
**Severity: Medium**

The COORDINATE_DAG template tells the coordinator to encode dependencies in the task description as free text: `"DEPENDS ON: <taskId1>, <taskId2>"`. This is fragile because:
- It relies on the LLM parsing its own convention reliably
- There's no server-side validation or enforcement of dependency ordering
- The `TaskData.dependencies` field exists in the type system but there's no CLI command to set it
- Task status transitions don't automatically check/enforce dependencies

**Recommendation:**
1. Add `--depends-on <taskId1,taskId2>` flag to `maestro task create`
2. Server-side enforcement: prevent a task from starting if dependencies aren't completed
3. Add `maestro task ready <parentId>` — list tasks whose dependencies are all completed

---

## Category 4: Information Flow & Context Problems

### Issue 13: Workers Don't Know Their Coordinator
**Severity: Medium**

Workers receive team_members in their prompt showing peer names and mail_ids, but they don't receive:
- Their parent coordinator's session ID
- An explicit "your coordinator is X" field
- The coordinator's team member mail_id for easy messaging

The execute workflow says "message your coordinator" but doesn't provide the address. Workers have to infer it from context or use `session report blocked` (which posts to the timeline, not the mailbox).

**Recommendation:**
1. Add `coordinatorSessionId` and `coordinatorTeamMemberId` fields to the execute manifest
2. Include these in the prompt: `<coordinator session_id="..." team_member_id="..." />`
3. Add `maestro mail send --to-coordinator` shorthand

### Issue 14: Session Spawn Initial Directive Is a Separate Mail, Not Part of Manifest Context
**Severity: Medium**

When a coordinator spawns with `--subject` and `--message`, this creates a mail message that arrives in the worker's inbox. But the worker's workflow says "Read your assigned tasks in the <tasks> block" first, not "Check your inbox for initial directives."

The initial directive mail may be read late (in the communicate phase) or not at all if the worker completes quickly. This is a race condition: the directive mail is sent at spawn time, but the worker may start executing before checking mail.

**Recommendation:**
1. Include the initial directive in the manifest itself as a `<coordinator_directive>` block
2. The init phase should explicitly mention: "Check for an initial coordinator directive in the manifest or your inbox"
3. Or: inject the directive into the task description server-side so it's part of the task context

---

## Category 5: Scalability & Resilience

### Issue 15 (Bonus): In-Memory Event Bus Is Single-Process
**Severity: Low (for now)**

The `InMemoryEventBus` + `mail:received` long-poll mechanism works only within a single server process. If the server ever needs to scale horizontally (multiple server instances), the event-driven mail delivery and long-polling will break because events are process-local.

**Recommendation:** This is fine for the current architecture but keep in mind for future: would need Redis pub/sub or similar for multi-process event delivery.

---

## Prioritized Improvement Roadmap

### Phase 1: Critical Communication Fixes (Highest Impact)
1. **Issue 10**: Restructure execute workflow to interleave communication with execution
2. **Issue 7**: Switch coordinator monitoring from polling to `mail wait`-based event-driven loop
3. **Issue 14**: Include initial directives in manifest context, not just mail
4. **Issue 13**: Add coordinator identity to worker manifests

### Phase 2: Mailbox Enhancements
5. **Issue 1**: Add read receipts / delivery status to mail
6. **Issue 2**: Add threaded conversations
7. **Issue 4**: Improve `mail wait` to collect batched messages
8. **Issue 5**: Add scoped broadcast

### Phase 3: Multi-Agent Coordination
9. **Issue 6**: Enable worker-to-worker communication with sibling discovery
10. **Issue 8**: Add session status monitoring for coordinators
11. **Issue 11**: Add new workflow templates for collaborative/pipeline patterns
12. **Issue 12**: Add proper dependency management to task system

### Phase 4: Reliability
13. **Issue 3**: Add priority/urgency to mail
14. **Issue 9**: Add coordinator heartbeat/liveness
