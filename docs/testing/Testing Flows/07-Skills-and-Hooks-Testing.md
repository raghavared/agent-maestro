# 07 - Skills & Hooks Testing

**Goal:** Verify that CLI skills (Worker/Orchestrator) function as expected and that hooks execute correctly during the workflow.

## Prerequisites
- Maestro Server running.
- Skill files generated (`npm run generate-skills`).

## Test Flows

### 1. Skill Verification
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Verify Skill Files | Check `~/.agents-ui/maestro-skills/` exists and contains `maestro-cli`, `maestro-worker`, `maestro-orchestrator`. | |
| 1.2 | Check Manifests | Open `manifest.json` for each skill. Ensure valid JSON and correct capabilities. | |

### 2. Worker Skill Flow
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | Spawn session with `maestro-worker` | Terminal opens. Worker prompt displayed. | |
| 2.2 | Perform Worker Actions | Run `maestro task start`, `maestro subtask complete`. Actions succeed. | |
| 2.3 | Attempt Restricted Action (if any) | Verify worker cannot perform Orchestrator-only actions (if restriction implemented). | |

### 3. Orchestrator Skill Flow
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | Spawn session with `maestro-orchestrator` | Terminal opens. Orchestrator prompt displayed. | |
| 3.2 | Delegate Task | Run `maestro session spawn ...`. New worker session spawns. | |
| 3.3 | Monitor Progress | Run `maestro task list --status in_progress`. Shows worker's task. | |

### 4. Hook Execution (If Implemented)
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | Configure a Hook (e.g., `onTaskComplete`) | Set up a simple script (log to file). | |
| 4.2 | Trigger Event | Complete a task via CLI/UI. | |
| 4.3 | Verify Hook | Check log file or output. Hook script executed. | |

## Success Criteria
- [ ] Skills are correctly generated and loaded.
- [ ] Worker and Orchestrator roles have correct context/prompts.
- [ ] Orchestrator can spawn Workers.
- [ ] Hooks execute on defined events (if hooks feature is active).
