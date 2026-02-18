# Maestro Coordination Improvements — Implementation Plan

## Context

The current Maestro coordinator and mailbox system treats agents like batch scripts: they get instructions, execute linearly, then report. Communication is an afterthought — workers check mail after all tasks, coordinators poll on timers, workers don't know their coordinator's session ID, and broadcasts leak across team boundaries. This redesign makes the system work like a real office team where communication is continuous, event-driven, and scoped.

Two prior analysis docs identified 15+ issues. This plan provides the concrete implementation across 4 sprints.

---

## Sprint 1: Workflow Template Improvements (No Code Changes — Template Text Only)

**Files to modify:**
- `maestro-cli/src/services/workflow-templates.ts` (all 6 templates)
- `maestro-cli/src/services/prompt-builder.ts` (default workflow phases in `getWorkflowPhases()`)

### 1.1 Restructure EXECUTE_SIMPLE

Update the phases to interleave communication with execution:

**init phase** — Add: "If a `<coordinator_directive>` is present, read it carefully. Check `maestro mail inbox` for any initial messages from your coordinator."

**execute phase** — Change from "work through each task" to: "Before starting each task, check `maestro mail inbox` for new directives. If you receive a directive that changes priorities, adjust accordingly. If blocked, notify your coordinator via `maestro mail send --to-coordinator --type query --subject '<what you need>' --message '<details>'` then wait for response via `maestro mail wait --timeout 30000`. After completing each task, report it."

**complete phase** — No change.

### 1.2 Restructure EXECUTE_TREE

Same pattern: add mail checking to the analyze phase (check inbox for initial directive) and execute phase (check mail before each task).

### 1.3 Restructure COORDINATE_DEFAULT

**monitor phase** — Replace polling instructions with event-driven loop:
```
1. maestro mail wait --timeout 60000   — block until worker message arrives
2. maestro mail inbox                  — read ALL pending messages
3. maestro task children <parentTaskId> — check subtask statuses
4. React to each message type:
   - status_update → acknowledge
   - query → reply via maestro mail reply <mailId> --message "<answer>"
   - blocked → send directive to unblock
5. Repeat until all subtasks completed
```

### 1.4 Restructure COORDINATE_BATCHING and COORDINATE_DAG

Same monitor pattern: replace polling instructions with `mail wait` loop in execute_batch and execute_wave phases.

### 1.5 Update default workflow phases in prompt-builder.ts

The `getWorkflowPhases()` method (line 504-607) has duplicate default workflows that must be updated to match the templates.

---

## Sprint 2: Server + CLI — parentSessionId & Coordinator Identity

### 2.1 Add `parentSessionId` to Session type

**File:** `maestro-server/src/types.ts`
- Add `parentSessionId?: string | null` to `Session` interface (after line 211)
- Add `parentSessionId?: string | null` to `CreateSessionPayload` (around line 308)

### 2.2 Set `parentSessionId` during spawn

**File:** `maestro-server/src/api/sessionRoutes.ts`
- In the spawn route (line 683-698), add `parentSessionId: sessionId || null` to the `createSession` call

### 2.3 Add `parentSessionId` query filter to session list

**File:** `maestro-server/src/api/sessionRoutes.ts`
- In `GET /sessions` handler (line 201-228), add: `if (req.query.parentSessionId) filter.parentSessionId = req.query.parentSessionId`

**File:** `maestro-server/src/domain/repositories/ISessionRepository.ts`
- Add `parentSessionId?: string` to `SessionFilter`

**File:** `maestro-server/src/infrastructure/FileSystemSessionRepository.ts`
- Add parentSessionId filtering logic to `findAll()`

### 2.4 Pass `MAESTRO_COORDINATOR_SESSION_ID` env var

**File:** `maestro-server/src/api/sessionRoutes.ts`
- In the spawn route finalEnvVars (line 785-795), add: `MAESTRO_COORDINATOR_SESSION_ID: sessionId || ''`

**File:** `maestro-cli/src/config.ts`
- Add `coordinatorSessionId` field that reads `MAESTRO_COORDINATOR_SESSION_ID`

### 2.5 Add `--to-coordinator` flag to `mail send`

**File:** `maestro-cli/src/commands/mail.ts`
- Add `.option('--to-coordinator', 'Send to the coordinator that spawned this session')` to the send command
- When set, resolve `toSessionId` from `config.coordinatorSessionId`

### 2.6 Add `--siblings` and `--my-workers` to `session list`

**File:** `maestro-cli/src/commands/session.ts`
- Add `--siblings` option: queries `GET /api/sessions?parentSessionId=<coordinatorSessionId>&active=true`
- Add `--my-workers` option: queries `GET /api/sessions?parentSessionId=<sessionId>&active=true`

---

## Sprint 3: Manifest & Prompt — Coordinator Directive + Session Context

### 3.1 Add fields to MaestroManifest type

**File:** `maestro-cli/src/types/manifest.ts`
- Add `coordinatorSessionId?: string` to `MaestroManifest`
- Add `initialDirective?: { subject: string; message: string; fromSessionId: string }` to `MaestroManifest`

### 3.2 Populate new fields during manifest generation

**File:** `maestro-cli/src/commands/manifest-generator.ts`
- Pass `coordinatorSessionId` from env/args into the manifest
- Pass `initialDirective` if provided in spawn request

**File:** `maestro-server/src/api/sessionRoutes.ts`
- Include `initialDirective` in the manifest generation args when `--subject/--message` are provided in the spawn request
- Still also send as mail for backward compat

### 3.3 Render `<session_context>` with coordinator info

**File:** `maestro-cli/src/services/prompt-builder.ts`
- In `buildTaskXml()`, add a `<session_context>` block with `session_id`, `coordinator_session_id`, `project_id`, `mode`
- Currently this info is injected by the system prompt header, but having it in the task prompt gives redundancy

### 3.4 Render `<coordinator_directive>` in prompt

**File:** `maestro-cli/src/services/prompt-builder.ts`
- In `buildTaskXml()`, if `manifest.initialDirective` exists, render:
```xml
<coordinator_directive>
  <subject>...</subject>
  <message>...</message>
</coordinator_directive>
```
- Place it after `<tasks>` and before `<context>`

---

## Sprint 4: Advanced Mailbox Features

### 4.1 Mail priority field

**File:** `maestro-server/src/types.ts`
- Add `priority?: 'critical' | 'high' | 'normal' | 'low'` to `MailMessage`
- Add `priority?` to `SendMailPayload`

**File:** `maestro-server/src/api/validation.ts`
- Update `sendMailSchema` to accept `priority` field

**File:** `maestro-server/src/application/services/MailService.ts`
- In `waitForMail()`, resolve immediately for `critical` priority messages
- In `getInbox()`, sort by priority by default

**File:** `maestro-cli/src/commands/mail.ts`
- Add `--priority <priority>` option to `mail send` and `mail broadcast`

### 4.2 Scoped broadcasts

**File:** `maestro-server/src/types.ts`
- Add `scope?: 'all' | 'my-workers' | 'team'` to `SendMailPayload`

**File:** `maestro-server/src/application/services/MailService.ts`
- When `scope === 'my-workers'`, filter target sessions by `parentSessionId === fromSessionId`
- When `scope === 'team'`, filter by shared `parentSessionId`

**File:** `maestro-cli/src/commands/mail.ts`
- Add `--scope <scope>` option to `mail broadcast`

### 4.3 Mail threading

**File:** `maestro-server/src/types.ts`
- Add `threadId?: string` to `MailMessage` (set to root message ID)

**File:** `maestro-server/src/application/services/MailService.ts`
- On reply, propagate `threadId` from original message
- On new message, set `threadId` to own `id`

**File:** `maestro-server/src/api/mailRoutes.ts`
- Add `GET /api/mail/thread/:threadId` endpoint

**File:** `maestro-cli/src/commands/mail.ts`
- Add `--thread` flag to `mail inbox` for grouped display

---

## Verification Plan

### Sprint 1 Verification (Template changes)
1. Build the CLI: `cd maestro-cli && npm run build`
2. Spawn a coordinator session from the UI
3. Verify the coordinator prompt includes the new event-driven monitor instructions
4. Spawn a worker from the coordinator
5. Verify the worker prompt includes mail-checking instructions in the execute phase
6. Observe: coordinator should use `mail wait` instead of polling

### Sprint 2 Verification (parentSessionId + CLI)
1. Build server and CLI
2. Spawn a coordinator → coordinator spawns workers
3. Verify `parentSessionId` is set on worker sessions in the JSON files
4. Run `maestro session list --my-workers` from coordinator → should show spawned workers
5. Run `maestro session list --siblings` from a worker → should show peer workers
6. Run `maestro mail send --to-coordinator --type query --subject "test" --message "test"` from worker → should send to coordinator

### Sprint 3 Verification (Manifest + Prompt)
1. Spawn a worker with `--subject "Test directive" --message "Do X"`
2. Read the generated manifest JSON → should contain `initialDirective` and `coordinatorSessionId`
3. Check the worker's system prompt → should contain `<coordinator_directive>` and `<session_context>`

### Sprint 4 Verification (Advanced mail)
1. Send a mail with `--priority critical` → verify it appears in inbox with priority
2. Run `mail broadcast --scope my-workers` → verify only spawned workers receive it
3. Send a mail, reply to it → verify `threadId` is propagated
4. Run `mail inbox --thread` → verify grouped display

---

## Key Files Summary

| File | Sprints | Changes |
|------|---------|---------|
| `maestro-cli/src/services/workflow-templates.ts` | 1 | All 6 template phase instructions |
| `maestro-cli/src/services/prompt-builder.ts` | 1, 3 | Default phases + coordinator_directive + session_context rendering |
| `maestro-server/src/types.ts` | 2, 4 | Session.parentSessionId, MailMessage.priority, MailMessage.threadId |
| `maestro-server/src/api/sessionRoutes.ts` | 2 | parentSessionId in spawn + query filter + env var |
| `maestro-cli/src/commands/mail.ts` | 2, 4 | --to-coordinator, --priority, --scope, --thread |
| `maestro-cli/src/commands/session.ts` | 2 | --siblings, --my-workers |
| `maestro-cli/src/config.ts` | 2 | coordinatorSessionId from env |
| `maestro-cli/src/types/manifest.ts` | 3 | coordinatorSessionId, initialDirective |
| `maestro-server/src/application/services/MailService.ts` | 4 | Priority handling, scoped broadcast, threading |
| `maestro-server/src/api/mailRoutes.ts` | 4 | Thread endpoint |
