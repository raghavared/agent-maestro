# Ubiquitous Language & Type System Audit Report

**Date:** 2026-02-23
**Analyst:** Ubiquitous Engineer
**Scope:** maestro-server, maestro-cli, maestro-ui

---

## Executive Summary

12 issues identified across the three packages: 2 CRITICAL, 4 HIGH, 4 MODERATE, 2 LOW. The two most architecturally damaging issues are the timestamp format split (number vs ISO string across entities) and the capability system divergence (snake_case/4 flags in server vs camelCase/12 flags in CLI).

---

## CRITICAL Issues

### 1. Timestamp Format Schizophrenia

The codebase uses **two incompatible timestamp formats** without a clear boundary:

| Entity | Server | CLI | UI | Format |
|--------|--------|-----|----|--------|
| Project | `number` | `number` (storage) | `number` | ms epoch |
| Task | `number` | **`string`** (manifest TaskData) | `number` | **CONFLICT** |
| Session | `number` | — | `number` | ms epoch |
| TeamMember | **`string`** (ISO 8601) | — | **`string`** (ISO 8601) | ISO string |
| Team | **`string`** (ISO 8601) | — | **`string`** (ISO 8601) | ISO string |
| TaskList | `number` | — | `number` | ms epoch |
| DocEntry | `number` | — | `number` | ms epoch |

**Problems:**
- `TeamMember` and `Team` use ISO 8601 strings while every other entity uses epoch numbers. This violates the principle of a single timestamp representation.
- `TaskData` in `maestro-cli/src/types/manifest.ts:269` declares `createdAt: string` while the canonical `Task` in `maestro-server/src/types.ts:240` uses `createdAt: number`. Manifest serialization must silently convert — a hidden contract.

**Affected Files:**
- `maestro-server/src/types.ts` (lines 6, 20-21, 83-84, 129-130, 196-197, 240-243, 280-282, 345, 474)
- `maestro-cli/src/types/manifest.ts` (line 269)
- `maestro-cli/src/types/storage.ts` (lines 11-12, 24-27, 48-50)
- `maestro-ui/src/app/types/maestro.ts` (lines 45-46, 106-107, 226, 238-239, 288-291, 330-332, 402-403)

---

### 2. Capability Naming Convention Split (snake_case vs camelCase)

Two completely different naming systems coexist for the same domain concept:

**Server/UI — snake_case (4 flags):**
```typescript
// maestro-server/src/types.ts:106-111
capabilities?: {
  can_spawn_sessions?: boolean;
  can_edit_tasks?: boolean;
  can_report_task_level?: boolean;
  can_report_session_level?: boolean;
};
```

**CLI — camelCase (12 flags):**
```typescript
// maestro-cli/src/prompting/capability-policy.ts:14-27
export interface CapabilityFlags {
  canSpawnSessions: boolean;
  canManageTasks: boolean;
  canUpdateTaskStatus: boolean;
  canReportProgress: boolean;
  canManageTaskDocs: boolean;
  canManageSessionDocs: boolean;
  canManageProjects: boolean;
  canManageTeamMembers: boolean;
  canManageTeams: boolean;
  canUseMasterCommands: boolean;
  canPromptOtherSessions: boolean;
  canUseModal: boolean;
}
```

**Problems:**
1. **Naming convention collision** — `snake_case` in the data model vs `camelCase` in the runtime policy. No explicit mapping layer exists.
2. **Scope mismatch** — Server defines 4 capabilities, CLI defines 12. The 8 extra CLI capabilities have no representation in the server type system, meaning the server cannot persist or enforce them.
3. **Semantic drift** — Server says `can_edit_tasks`, CLI says `canManageTasks`. "Edit" vs "Manage" implies different scope.

**Affected Files:**
- `maestro-server/src/types.ts` (lines 106-111)
- `maestro-cli/src/prompting/capability-policy.ts` (lines 14-27, 153-183)
- `maestro-ui/src/app/types/maestro.ts` (lines 86-91)
- `maestro-ui/src/components/maestro/TeamMemberModal.tsx` (lines 18-23)

---

## HIGH Issues

### 3. TaskStatus Missing `'archived'` in CLI

| Package | Values |
|---------|--------|
| Server (`types.ts:308`) | `'todo' \| 'in_progress' \| 'in_review' \| 'completed' \| 'cancelled' \| 'blocked' \| 'archived'` |
| CLI (`manifest.ts:216-222`) | `'todo' \| 'in_progress' \| 'in_review' \| 'completed' \| 'cancelled' \| 'blocked'` — **missing `'archived'`** |
| UI (`maestro.ts:4`) | `'todo' \| 'in_progress' \| 'in_review' \| 'completed' \| 'cancelled' \| 'blocked' \| 'archived'` |

An agent receiving a manifest with an archived task would see an invalid status value with no type-level protection.

---

### 4. TaskSessionStatus Extra `'queued'` in UI

| Package | Values |
|---------|--------|
| Server (`types.ts:309`) | `'working' \| 'blocked' \| 'completed' \| 'failed' \| 'skipped'` |
| UI (`maestro.ts:8`) | `'queued' \| 'working' \| 'blocked' \| 'completed' \| 'failed' \| 'skipped'` |

The UI adds `'queued'` which doesn't exist in the server. The UI can represent a state the server never produces, or send it back without runtime type checking.

---

### 5. WorkerStrategy Value Drift

| Package | Values |
|---------|--------|
| Server (`types.ts:38`) | `'simple' \| 'tree'` |
| UI (`maestro.ts:25`) | `'simple' \| 'queue'` |

`'tree'` vs `'queue'` — completely different concepts under the same type name.

---

### 6. Event System Gaps

1. **`notify:task_in_review`** — Interface defined in `DomainEvents.ts:114` and emitted by `TaskService.ts:160`, but **missing from `TypedEventMap`**. No compile-time guarantee for this event's payload shape.

2. **WebSocketBridge not subscribing to 8+ event types:**
   - `task_list:created`, `task_list:updated`, `task_list:deleted`, `task_list:reordered`
   - `team:created`, `team:updated`, `team:deleted`, `team:archived`
   - `notify:task_in_review`

   These events are all emitted by services but never bridged to WebSocket clients. The UI will never receive realtime task list or team change events.

**Affected Files:**
- `maestro-server/src/domain/events/DomainEvents.ts` (lines 114, 289-355)
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` (lines 81-115)
- `maestro-server/src/application/services/TaskService.ts` (line 160)

---

## MODERATE Issues

### 7. Entity Naming Inconsistency Across Packages

| Domain Concept | Server | CLI | UI |
|----------------|--------|-----|----|
| Project | `Project` | `MasterProjectInfo` | `MaestroProject` |
| Task | `Task` | `TaskData` | `MaestroTask` |
| Session | `Session` | — (no mirror) | `MaestroSession` |
| Session Event | `SessionEvent` | — | `MaestroSessionEvent` |
| Session Status | `SessionStatus` | — | `MaestroSessionStatus` |

The CLI's `TaskData` also has fields the server doesn't have (like `acceptanceCriteria: string[]`), further blurring what a "Task" means across bounded contexts.

---

### 8. TeamMember.identity — Optional vs Required

| Package | Optionality |
|---------|-------------|
| Server (`types.ts:95`) | `identity?: string` (optional) |
| CLI `TeamMemberData` (`manifest.ts:189`) | `identity: string` (required) |
| CLI `TeamMemberProfile` (`manifest.ts:163`) | `identity: string` (required) |
| UI (`maestro.ts:74`) | `identity: string` (required) |

Manifest generation must handle `undefined` → some default, which is an implicit contract not reflected in types.

---

### 9. Team.parentTeamId — Nullable Inconsistency

| Package | Type |
|---------|------|
| Server (`types.ts:193`) | `parentTeamId?: string \| null` |
| UI (`maestro.ts:43`) | `parentTeamId?: string` |

The server allows explicit `null` (meaning "detached from parent"), while the UI only allows `undefined` or `string`.

---

### 10. Task.priority — 3 vs 4 Levels

| Package | Values |
|---------|--------|
| Server (`types.ts:310`) | `'low' \| 'medium' \| 'high'` |
| CLI `TaskData` (`manifest.ts:263`) | `'low' \| 'medium' \| 'high' \| 'critical'` |
| UI (`maestro.ts:5`) | `'low' \| 'medium' \| 'high'` |

The CLI introduces `'critical'` priority that doesn't exist in the server or UI.

---

## LOW Issues

### 11. Stale Comment in TeamMember.mode

`maestro-server/src/types.ts:99`:
```typescript
mode?: AgentMode;  // "execute" or "coordinate"
```
The comment says `"execute" or "coordinate"` (legacy names) but the type is the four-mode model.

---

### 12. Missing `'prompt_received'` Timeline Event in UI

| Package | Includes `prompt_received`? |
|---------|---------------------------|
| Server (`types.ts:327`) | Yes |
| UI (`maestro.ts:183`) | **No** |

If a session timeline includes this event, the UI's type system won't recognize it.

---

## Recommendations

### Quick Wins (Low Risk)
1. Add `'archived'` to CLI's `TaskStatus` (issue #3)
2. Add `'prompt_received'` to UI's `SessionTimelineEventType` (issue #12)
3. Fix stale mode comment in server `TeamMember` (issue #11)
4. Add `notify:task_in_review` to `TypedEventMap` (issue #6a)
5. Subscribe to `task_list:*` and `team:*` events in `WebSocketBridge` (issue #6b)

### Medium Effort (Requires Coordination)
6. Align `WorkerStrategy` values between server and UI (issue #5)
7. Add `'queued'` to server `TaskSessionStatus` or remove from UI (issue #4)
8. Decide on `'critical'` priority — add to server/UI or remove from CLI (issue #10)
9. Align `parentTeamId` nullability across server and UI (issue #9)
10. Make `TeamMember.identity` consistently optional or required (issue #8)

### Architectural (Requires Design Decision)
11. Standardize all timestamps to one format (recommend: epoch `number` everywhere) (issue #1)
12. Unify capability system — single naming convention, single source of truth with full 12-flag model in server (issue #2)
13. Establish naming convention policy for cross-package type mirrors (issue #7)
