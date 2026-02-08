# Gap Analysis: Phase 1 vs. Reality

This document compares the *intended* Production Phase 1 state (as described in documentation) with the *actual* codebase state.

## 1. Subtask Persistence

| Requirement | Doc Status | Code Status | Gap Severity |
|-------------|------------|-------------|--------------|
| **Dedicated API** | `POST /api/tasks/:id/subtasks` | **MISSING**. Logic is in CLI (`commands/subtask.ts`). | 🔴 Critical |
| **Atomic Updates** | PATCH individual subtask | **MISSING**. Updates require overwriting entire task. | 🔴 Critical |
| **DB Schema** | Separate `Subtask` entity | **MISSING**. Stored as `task.subtasks` array. | 🟠 High |
| **Race Conditions** | Handled by server | **UNHANDLED**. Concurrent CLI/UI updates will overwrite each other. | 🔴 Critical |

**Impact on Phase 2:** High-frequency updates from hooks (e.g., "Reading file X") will likely cause data loss if they try to update the task status concurrently with other events.

## 2. Skill System

| Requirement | Doc Status | Code Status | Gap Severity |
|-------------|------------|-------------|--------------|
| **Directory** | `~/.agents-ui/maestro-skills` | **MISSING**. | 🔴 Critical |
| **Manifests** | `manifest.json` for skills | **MISSING**. | 🔴 Critical |
| **Loader** | `loadSkill()` in server | **MISSING**. | 🔴 Critical |
| **Injection** | Auto-inject into prompt | **MISSING**. | 🔴 Critical |

**Impact on Phase 2:** Spawned sessions will be "dumb" terminals without the specific instructions (`maestro-worker` skill) needed to report status back to the Orchestrator.

## 3. Session Spawning

| Requirement | Doc Status | Code Status | Gap Severity |
|-------------|------------|-------------|--------------|
| **CLI Command** | `maestro session spawn` | **IMPLEMENTED**. | 🟢 Ready |
| **Server Endpoint** | `POST /sessions/spawn` | **IMPLEMENTED**. | 🟢 Ready |
| **Event Broadcast** | `session:spawn_request` | **IMPLEMENTED** (in `sessions.ts`). | 🟢 Ready |
| **Tauri Listener** | Opens new terminal tab | **UNKNOWN/MISSING**. Frontend integration likely incomplete. | 🟠 High |

**Impact on Phase 2:** The mechanism exists, but without the Skill System, the spawned session won't know what to do.

## 4. WebSocket Reliability

| Requirement | Doc Status | Code Status | Gap Severity |
|-------------|------------|-------------|--------------|
| **Reconnection** | Auto-reconnect w/ backoff | **MISSING**. Basic WebSocket only. | 🟠 High |
| **Queueing** | Buffer offline messages | **MISSING**. Events lost if offline. | 🟠 High |
| **Visuals** | Connection Status Badge | **MISSING**. | 🟡 Medium |

**Impact on Phase 2:** Hook events are fire-and-forget. Without reliability, the "Real-time Observability" promise of Phase 2 fails on any network blip.

## 5. Testing

| Requirement | Doc Status | Code Status | Gap Severity |
|-------------|------------|-------------|--------------|
| **Unit Tests** | CLI & Server tests | **MISSING**. No test files found in glob. | 🔴 Critical |
| **Integration** | API & Flow tests | **MISSING**. | 🔴 Critical |
| **CI/CD** | Github Actions | **MISSING**. | 🟡 Medium |

**Impact on Phase 2:** Adding complex hook logic on top of untested code is high-risk.

---

## Summary of Missing Files

The following files are described in docs but **do not exist** in the codebase:

1.  `maestro-server/src/api/subtasks.ts`
2.  `maestro-server/src/skills.ts`
3.  `maestro-cli/src/utils/errors.ts` (Structured error handling)
4.  `src/components/maestro/ConnectionStatus.tsx`
5.  `src-tauri/src/websocket.rs` (Likely missing or basic)
