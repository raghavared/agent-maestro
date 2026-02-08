# 06 - Terminal Spawning Testing

**Goal:** Verify that terminals spawn correctly with the right environment variables, arguments, and context.

## Prerequisites
- Maestro Server running.
- UI App running (Tauri).
- `maestro-cli` installed and available in PATH.

## Test Flows

### 1. Basic Spawning
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Run `maestro session spawn --task <taskId>` | A new terminal tab/window opens in the App. | |
| 1.2 | Check Terminal Title | Title matches Session Name or "Worker for <Task>". | |

### 2. Environment Variables Injection
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | Inside spawned terminal, run `echo $MAESTRO_TASK_IDS` | Output matches the `<taskId>` provided. | |
| 2.2 | Run `echo $MAESTRO_SESSION_ID` | Output matches the session ID visible in UI/CLI. | |
| 2.3 | Run `echo $MAESTRO_PROJECT_ID` | Output matches current project ID. | |
| 2.4 | Run `echo $MAESTRO_API_URL` | Output matches server URL (e.g., `http://localhost:3000`). | |

### 3. Spawning with Arguments & Skills
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | `maestro session spawn --task <id> --skill maestro-orchestrator` | Terminal opens. Skill context is loaded (check via `maestro whoami` or skill prompt). | |
| 3.2 | `maestro session spawn --task <id> --name "Custom Worker"` | Terminal opens with title "Custom Worker". | |

### 4. Context-Aware Prompting
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | Spawn a session | Initial terminal output shows a "Session Brief" or Welcome message with Task Details. | |
| 4.2 | Check Initial Commands | Verify that `maestro whoami` or `maestro task start` ran automatically (if configured). | |

## Success Criteria
- [ ] Terminals spawn reliably via CLI command.
- [ ] All `MAESTRO_*` environment variables are correct.
- [ ] Custom names and skills are respected.
- [ ] Context/Prompts are displayed on startup.
