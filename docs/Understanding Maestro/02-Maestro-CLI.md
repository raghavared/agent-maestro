# Maestro CLI Design

## Purpose
The **Maestro CLI** (`maestro`) is the primary communication bridge between the LLM Agents (running in terminal sessions) and the Maestro Server. It allows agents to read task details, report progress, and manage their lifecycle without needing complex API integrations in their prompts.

## Architecture
- **Binary Name**: `maestro`
- **Distribution**: Bundled with the Agents UI / Maestro environment.
- **Configuration**: Auto-configured via Environment Variables injected at session start.

## Environment Variables
The CLI relies on these variables to know "who" and "where" it is:

| Variable | Description |
| :--- | :--- |
| `MAESTRO_API_URL` | URL of the Maestro Server (e.g., `http://localhost:3000`). |
| `MAESTRO_TASK_ID` | The ID of the generic task/subtask group assigned to this session. |
| `MAESTRO_SESSION_ID` | Unique ID for the current terminal session. |
| `MAESTRO_AUTH_TOKEN` | (Optional) Token for secure communication if needed. |

## Command Reference

### 1. Information Retrieval

#### `maestro info`
Displays current session context.
```bash
$ maestro info
Session: sess_123
Current Task: task_456 (Backend API Implementation)
Assigned Subtasks:
- [ ] st_1: Create User Model
- [ ] st_2: Create Auth Controller
```

#### `maestro task get [id]`
Fetches details of a specific task. If no ID provided, fetches the *current* assigned task.
```json
// Output (JSON)
{
  "id": "task_456",
  "title": "Backend API Implementation",
  "description": "...",
  "subtasks": [...]
}
```

### 2. Progress Reporting

#### `maestro update "<message>"`
Sends a progress update log to the server. This appears in the UI timeline.
```bash
$ maestro update "Implemented User schema, running migrations now."
```

#### `maestro subtask list`
Lists all subtasks assigned to the current session with their status.

#### `maestro subtask complete <subtask_id>`
Marks a specific subtask as COMPLETED.
```bash
$ maestro subtask complete st_1
Success: Subtask 'st_1' marked as completed.
```

#### `maestro subtask fail <subtask_id> "<reason>"`
Marks a subtask as FAILED.

### 3. Lifecycle Management

#### `maestro complete`
Signals that **ALL** assigned work for this session is finished. Orchestrator will be notified to review or close the session.
```bash
$ maestro complete
```

#### `maestro blocked "<reason>"`
Signals that the agent is blocked and needs human intervention or Orchestrator help.
```bash
$ maestro blocked "Missing AWS credentials in environment."
```

### 4. Advanced Features

#### `maestro agent run <agent_name>`
(Future/Advanced) Triggers a specialized sub-agent flow.
```bash
$ maestro agent run security-scanner
```

## Implementation Notes
- The CLI should return **JSON** by default or when `--json` is passed, to make it easier for LLMs to parse (though LLMs read text fine, JSON is safer for programmatic skills).
- It should handle network errors gracefully (retry logic).
- It acts as a wrapper around the Maestro REST/GraphQL API.
