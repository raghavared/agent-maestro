# 02 - Maestro CLI Testing

**Goal:** Verify the functionality of the Maestro Command Line Interface, including installation, configuration, and core commands.

## Prerequisites
- Maestro Server running (`npm run dev` in `maestro-server`).
- Terminal open at `maestro-cli/` or CLI installed globally.

## Test Flows

### 1. Installation & Help
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Run `maestro --version` | Prints valid version number (e.g., `1.0.0`). | |
| 1.2 | Run `maestro --help` | Lists available commands: `task`, `session`, `subtask`, `config`, etc. | |
| 1.3 | Run `maestro task --help` | Shows subcommands: `list`, `create`, `get`, `update`, `block`. | |

### 2. Configuration & Context
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | Run `maestro whoami` | Shows "Not in a session context" or current context if env vars are set. | |
| 2.2 | Set env var `MAESTRO_PROJECT_ID=test-p1` and run `maestro whoami` | Output shows Project ID: `test-p1`. | |
| 2.3 | Run `maestro config --list` | Shows current configuration (API URL, retries, etc.). | |
| 2.4 | Run `maestro config --set retries=5` | Updates config file. | |
| 2.5 | Verify with `maestro config --get retries` | Output: `5`. | |

### 3. Core Commands
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | `maestro task create "CLI Test Task" --priority high` | Returns Success. Output includes new Task ID (e.g., `t-123`). | |
| 3.2 | `maestro task list` | Lists "CLI Test Task" with High priority. | |
| 3.3 | `maestro task get t-123` | Shows details: Title, Status (pending), Priority (high). | |
| 3.4 | `maestro task update t-123 --status in_progress` | Output confirms update. | |
| 3.5 | `maestro task block t-123 --reason "Testing block"` | Task status changes to `blocked`. Reason is recorded. | |
| 3.6 | `maestro task complete t-123` | Task status changes to `completed`. | |

### 4. Error Handling & JSON Output
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | `maestro task get t-999` (Non-existent) | Error message: "Task 't-999' does not exist". Suggestion provided. | |
| 4.2 | `maestro task get t-999 --json` | JSON output: `{"success": false, "error": "resource_not_found", ...}`. | |
| 4.3 | Run command with server stopped | Error message: "Connection refused" / "Network error". | |
| 4.4 | `maestro task list --json` | Valid JSON array of tasks. | |

## Success Criteria
- [ ] CLI installs and runs.
- [ ] Help commands provide accurate info.
- [ ] Configuration persists.
- [ ] CRUD operations for Tasks work via CLI.
- [ ] Error messages are friendly and structured.
- [ ] `--json` flag always returns parseable JSON.
