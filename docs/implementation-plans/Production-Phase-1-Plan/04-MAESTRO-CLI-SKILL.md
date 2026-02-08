# Maestro CLI Skill (`maestro-cli`)

This skill is the foundational reference for all agents. It defines the modular command structure for interacting with the Maestro system.

## Default Assignment Logic
- **Every Session:** Receives `maestro-cli` by default.
- **Orchestrator Sessions:** Receive `maestro-cli` + `maestro-orchestrator`.
- **Worker Sessions:** Receive `maestro-cli` + `maestro-worker`.

## Modular Command Reference

### Task Execution (Workers)
- `maestro task start [id]`: Mark a task as in-progress. If no ID provided, uses current context.
- `maestro task log "<message>"`: Add a progress log/update to the task timeline.
- `maestro task complete [id]`: Mark a task as completed.
- `maestro task block [id] --reason "<reason>"`: Mark a task as blocked and log the reason.

### Task Management (Orchestrators)
- `maestro task list`: List all tasks in the project.
- `maestro task get <id>`: Fetch full details, subtasks, and timeline for a task.
- `maestro task create <title>`: Create a new top-level task.
- `maestro task update <id> [--priority <p>] [--status <s>]`: Update task metadata.

### Subtask Management
- `maestro subtask create <taskId> "<title>"`: Break a task down into subtasks.
- `maestro subtask complete <taskId> <subtaskId>`: Mark a specific subtask as finished.

### Session Management
- `maestro session spawn --task <id>`: Spawn a new worker terminal for a specific task.
- `maestro session list`: List all active worker sessions.
