# Phase I Implementation Plan: Production Readiness

This plan outlines the steps required to bridge the gap between the current prototype and the "Production Phase 1" success criteria.

## Phase 1.1: Skill System & CLI Hardening (Estimated: 8-12 hours)

### 1. Skill System Implementation
- [ ] Create `maestro-server/src/skills.ts` to manage skill manifests and instructions.
- [ ] Implement `scripts/setup-skills.sh` to initialize the `~/.agents-ui/maestro-skills` directory.
- [ ] Populate default skills: `maestro-cli`, `maestro-worker`, `maestro-orchestrator`.

### 2. CLI Enhancements
- [ ] Implement `maestro task block <id> --reason "<reason>"`.
- [ ] Implement `maestro status` for project overview.
- [ ] Refactor `maestro-cli/src/api.ts` to include automatic retries with exponential backoff.
- [ ] Add centralized error handling and structured JSON errors.

## Phase 1.2: Session Spawning & Terminal Automation (Estimated: 10-14 hours)

### 1. Tauri Terminal Spawning
- [ ] Map the WebSocket `session:spawn_request` in the React frontend to a Tauri `invoke`.
- [ ] Ensure `src-tauri/src/pty.rs` (or similar) can receive environment variables (TASK_ID, SESSION_ID) and inject them into the spawned process.
- [ ] Implement context-aware prompts: Generate the initial briefing for the spawned agent based on task metadata.

### 2. WebSocket Reliability
- [ ] Implement message queueing in the frontend for "Offline Mutation" support.
- [ ] Add visual "Connection Status" badge to the UI.

## Phase 1.3: Data Persistence & API Refactoring (Estimated: 6-8 hours)

### 1. Dedicated Subtask API
- [ ] Create `maestro-server/src/api/subtasks.ts`.
- [ ] Implement granular CRUD for subtasks to avoid race conditions.
- [ ] Update CLI and UI to use new endpoints.

## Phase 1.4: Deployment & Quality Assurance (Estimated: 10-12 hours)



### 1. Test Coverage
- [ ] Implement integration tests for the full Task -> Spawn -> Complete lifecycle.
- [ ] Achieve >80% coverage on CLI validation and Server API logic.

---

## Success Criteria Checklist
- [ ] Orchestrator can spawn a Worker session via CLI.
- [ ] Worker session receives correct Task context via ENV and initial prompt.
- [ ] Subtasks persist and sync across all clients via dedicated API.
- [ ] CLI remains stable even with transient server disconnections (retries).
