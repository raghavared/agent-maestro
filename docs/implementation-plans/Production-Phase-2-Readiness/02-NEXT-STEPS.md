# Next Steps: Remediation Plan

To prepare for Phase 2, we must execute the following "Phase 1.5" remediation plan.

## Priority 1: Backend Infrastructure (4-6 Hours)

### 1.1 Proper Subtask API
**Objective:** Move subtask logic from CLI to Server.
- [ ] Create `maestro-server/src/api/subtasks.ts`.
- [ ] Implement `POST /api/tasks/:id/subtasks`.
- [ ] Implement `PATCH /api/tasks/:id/subtasks/:subtaskId`.
- [ ] Update `storage.ts` to handle subtask updates atomically (or as atomically as JSON allows).
- [ ] Update CLI `commands/subtask.ts` to use these endpoints.

### 1.2 Skill System
**Objective:** Enable context-aware agents.
- [ ] Create `~/.agents-ui/maestro-skills` directory.
- [ ] Create `maestro-server/src/skills.ts` to read manifests.
- [ ] Implement `loadSkills(skillIds)` in `sessions.ts` spawn logic.
- [ ] Create the default `maestro-worker` skill (prompt).

## Priority 2: Reliability (3-4 Hours)

### 2.1 WebSocket Hardening
**Objective:** Ensure no events are lost.
- [ ] Update frontend `useMaestroWebSocket` to handle reconnections.
- [ ] Add a simple "Message Queue" in `maestro-cli` (for hook events).

### 2.2 Error Handling
**Objective:** meaningful debug info.
- [ ] Create standardized error response helper in Server.
- [ ] Update CLI to display `suggestion` field from errors.

## Priority 3: Verification (2-3 Hours)

### 3.1 Manual "Happy Path" Test
- [ ] 1. Start Server.
- [ ] 2. Create Task (CLI).
- [ ] 3. Add Subtask (CLI - new API).
- [ ] 4. Spawn Session (CLI).
- [ ] 5. **Verify:** Does the new terminal open? Does it have the `maestro-worker` prompt?

---

## After Remediation

Once these steps are complete, proceed to **Production Phase 2 Implementation**:
1.  Implement `POST /api/webhooks`.
2.  Create `.claude/hooks` scripts.
3.  Update UI to visualize the stream.
