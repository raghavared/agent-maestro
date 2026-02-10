# CLI Commands & Report System Review

## 1. Overview

The Maestro CLI (`maestro-cli/src/index.ts`) is built with **Commander.js** and provides the primary interface for agents (workers, orchestrators) and humans to interact with the Maestro server. All HTTP communication goes through a single `APIClient` class (`maestro-cli/src/api.ts`) that wraps `node-fetch` with retry logic.

### Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output results as JSON |
| `--server <url>` | Override Maestro Server URL |
| `--project <id>` | Override Project ID |

### Configuration (from `config.ts`)

Configuration is resolved from environment variables with fallbacks:

| Env Variable | Config Key | Default |
|---|---|---|
| `MAESTRO_SERVER_URL` / `MAESTRO_API_URL` | `apiUrl` | `http://localhost:3000` (or auto-discovered from `DATA_DIR/server-url`) |
| `MAESTRO_PROJECT_ID` | `projectId` | undefined |
| `MAESTRO_SESSION_ID` | `sessionId` | undefined |
| `MAESTRO_TASK_IDS` | `taskIds` | `[]` (comma-separated) |
| `MAESTRO_STRATEGY` | `strategy` | `'simple'` |
| `MAESTRO_RETRIES` | `retries` | `3` |
| `MAESTRO_RETRY_DELAY` | `retryDelay` | `1000` ms |
| `MAESTRO_DEBUG` | `debug` | `false` |
| `MAESTRO_ORCHESTRATOR_STRATEGY` | `orchestratorStrategy` | `'default'` |

---

## 2. API Client (`api.ts`)

The `APIClient` class provides `get`, `post`, `patch`, `delete` methods. Key behaviors:

- **Retry logic**: Retries up to `config.retries` times (default 3) with exponential backoff
- **Retry conditions**: 5xx errors and network errors (`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`)
- **No retry**: 4xx client errors are thrown immediately
- **204 responses**: Returned as empty object `{}`
- **Base URL normalization**: Strips trailing slash, ensures endpoint starts with `/`

---

## 3. Complete Command Inventory

### 3.1 Top-level Commands (defined in `index.ts`)

| Command | Description | API Calls |
|---------|-------------|-----------|
| `maestro whoami` | Print current context (server, project, session, tasks, strategy) | None (reads env/manifest) |
| `maestro commands` | Show available commands based on manifest permissions | None (reads manifest) |
| `maestro commands --check <cmd>` | Check if a specific command is allowed | None |
| `maestro status` | Show project summary (tasks by status/priority, active sessions) | `GET /api/tasks?projectId=X`, `GET /api/sessions?projectId=X` |
| `maestro track-file <path>` | Track file modification (PostToolUse hook) | `POST /api/sessions/{id}/events` |

### 3.2 Project Commands (`project.ts`)

| Command | Args/Options | API Call |
|---------|-------------|----------|
| `maestro project list` | - | `GET /api/projects` |
| `maestro project create <name>` | `-d, --dir <workingDir>` (default: cwd), `--desc <description>` | `POST /api/projects` |
| `maestro project get <id>` | - | `GET /api/projects/{id}` |
| `maestro project delete <id>` | - | `DELETE /api/projects/{id}` |

### 3.3 Task Commands (`task.ts`)

| Command | Args/Options | API Call |
|---------|-------------|----------|
| `maestro task list [taskId]` | `--status <status>`, `--priority <priority>`, `--all` | `GET /api/tasks?projectId=X` or `GET /api/tasks/{id}` + `GET /api/tasks/{id}/children` |
| `maestro task create [title]` | `-t, --title`, `-d, --desc`, `--priority` (default: medium), `--parent <parentId>` | `POST /api/tasks` |
| `maestro task get [id]` | Falls back to `config.taskIds[0]` if single task | `GET /api/tasks/{id}` |
| `maestro task update <id>` | `--status`, `--priority`, `--title` | `PATCH /api/tasks/{id}`, optionally `POST /api/sessions/{sid}/timeline` |
| `maestro task complete <id>` | - | `PATCH /api/tasks/{id}` (status: completed), `POST /api/sessions/{sid}/timeline` |
| `maestro task block <id>` | `--reason <reason>` (required) | `PATCH /api/tasks/{id}` (status: blocked), `POST /api/sessions/{sid}/timeline` |
| `maestro task children <taskId>` | `--recursive` | `GET /api/tasks/{id}/children` (recursive fetches descendants) |
| `maestro task tree` | `--root <taskId>`, `--depth <n>`, `--status <status>` | `GET /api/tasks?projectId=X`, then recursive `GET /api/tasks/{id}` + `GET /api/tasks/{id}/children` |

**Note**: `task update`, `task complete`, and `task block` all post timeline events to the session if `MAESTRO_SESSION_ID` is set. These update the **task.status** field (not `sessionStatus`).

### 3.4 Session Commands (`session.ts`)

| Command | Args/Options | API Call |
|---------|-------------|----------|
| `maestro session list` | `--task <taskId>` | `GET /api/sessions?taskId=X&projectId=Y` |
| `maestro session info` | - | `GET /api/sessions/{sessionId}` |
| `maestro session spawn` | `--task <id>` (required), `--skill <skill>` (default: maestro-worker), `--name`, `--reason`, `--include-related`, `--orchestrator-strategy` | `GET /api/tasks/{id}`, `POST /api/sessions/spawn` |
| `maestro session register` | - (called by SessionStart hook) | `GET /api/sessions/{id}` (check exists), then `PATCH` (status: running) or `POST /api/sessions` (create new) |
| `maestro session complete` | - (called by SessionEnd hook) | `PATCH /api/sessions/{id}` (status: completed, completedAt) |
| `maestro session needs-input` | - (called by Stop hook) | `PATCH /api/sessions/{id}` (status: needs-user-input + timeline event) |
| `maestro session resume-working` | - (called by UserPromptSubmit hook) | `PATCH /api/sessions/{id}` (status: working) |

**Session spawn details**: Builds a context object with primary task, related tasks (if `--include-related`), workflow steps (role-specific), and initial commands. The `spawnSource` is set to `'session'` and the parent `sessionId` is included.

### 3.5 Report Commands (`report.ts`) -- DEEP DIVE

The report system is the **primary mechanism for agents to communicate status back** to the server. It operates on two levels:

1. **Task-level**: Updates `sessionStatus` on targeted tasks + posts timeline events per task
2. **Session-level**: Posts a timeline event to the session (no task changes)

#### Report Subcommand Definitions

| Subcommand | Session Status | Timeline Event Type | Special Behavior |
|------------|---------------|-------------------|-----------------|
| `progress` | `working` | `progress` | - |
| `complete` | `completed` | `task_completed` | Without `--task`, also marks **session** as completed |
| `blocked` | `blocked` | `task_blocked` | - |
| `error` | `failed` | `error` | - |
| `needs-input` | `needs_input` | `needs_input` | - |

#### Command Signatures

All report subcommands follow the same pattern:

```
maestro report <subcommand> <message> [--task <comma-separated-ids>]
```

| Command | Example |
|---------|---------|
| `maestro report progress "Working on auth module"` | Session-only timeline event |
| `maestro report progress "Auth done" --task task-123,task-456` | Updates sessionStatus on both tasks + timeline per task |
| `maestro report complete "All done"` | Posts timeline + marks **session** as completed |
| `maestro report complete "Task done" --task task-123` | Updates task sessionStatus to completed + timeline, does NOT mark session completed |
| `maestro report blocked "Waiting for API key"` | Posts timeline event |
| `maestro report error "Build failed"` | Posts timeline event |
| `maestro report needs-input "Which database?"` | Posts timeline event |

#### API Calls Made by Report

**With `--task` option** (per task):
1. `PATCH /api/tasks/{taskId}` with `{ sessionStatus, updateSource: 'session', sessionId }`
2. `POST /api/sessions/{sessionId}/timeline` with `{ type, message, taskId }`

**Without `--task` option**:
1. `POST /api/sessions/{sessionId}/timeline` with `{ type, message }`
2. If `complete`: Also `PATCH /api/sessions/{sessionId}` with `{ status: 'completed' }`

#### Key Distinction: `task.status` vs `task.sessionStatus`

- **`task.status`**: The "ground truth" task lifecycle status (`todo`, `in_progress`, `completed`, `blocked`, `cancelled`). Updated by `maestro task update/complete/block`.
- **`task.sessionStatus`**: The session-reported status (`working`, `completed`, `blocked`, `failed`, `needs_input`). Updated by `maestro report` commands. This represents what the **agent session** thinks the status is.

This dual-status design allows orchestrators to override task status independently of what workers report.

### 3.6 Queue Commands (`queue.ts`)

Queue commands are for sessions using the `queue` strategy (FIFO task processing).

| Command | Args/Options | API Call |
|---------|-------------|----------|
| `maestro queue top` | - | `GET /api/sessions/{sid}/queue/top` |
| `maestro queue start` | `--poll-interval <seconds>` (default: 10), `--poll-timeout <minutes>` (default: 30) | `POST /api/sessions/{sid}/queue/start`, polls `GET .../queue/top` when empty |
| `maestro queue complete` | - | `POST /api/sessions/{sid}/queue/complete` |
| `maestro queue fail` | `--reason <reason>` | `POST /api/sessions/{sid}/queue/fail` |
| `maestro queue skip` | - | `POST /api/sessions/{sid}/queue/skip` |
| `maestro queue list` | - | `GET /api/sessions/{sid}/queue/items` |
| `maestro queue push <taskId>` | - | `POST /api/sessions/{sid}/queue/push` |
| `maestro queue status` | - | `GET /api/sessions/{sid}/queue` |

**`queue start` behavior**: If the queue is empty, it enters a polling loop (default: every 10s, timeout: 30min). It handles SIGINT/SIGTERM for graceful shutdown. On timeout, it exits with code 1 and suggests running `maestro report complete`.

### 3.7 Worker Commands (`worker.ts` + `worker-init.ts`)

| Command | Description |
|---------|-------------|
| `maestro worker init` | Initialize worker session from manifest |

**Worker Init Flow** (7 steps):
1. Read manifest from `MAESTRO_MANIFEST_PATH` env var
2. Parse and validate manifest (must have `role: 'worker'`)
3. Validate worker role
4. Load command permissions from manifest (what commands the worker can run)
5. Resolve session ID (from `MAESTRO_SESSION_ID` env or generate new)
6. Register session with server: `PATCH /api/sessions/{id}` (status: running) + `PATCH /api/tasks/{id}` (sessionStatus: working) per task
7. Spawn Claude Code process via `ClaudeSpawner` (interactive mode)

### 3.8 Orchestrator Commands (`orchestrator.ts` + `orchestrator-init.ts`)

| Command | Description |
|---------|-------------|
| `maestro orchestrator init` | Initialize orchestrator session from manifest |

**Orchestrator Init Flow** (6 steps):
1. Read manifest from `MAESTRO_MANIFEST_PATH`
2. Parse and validate (must have `role: 'orchestrator'`)
3. Show task info
4. Resolve session ID
5. Auto-update session status: `PATCH /api/tasks/{id}` (sessionStatus: working) per task -- NOTE: does NOT update session status to 'running' unlike worker init
6. Spawn Claude Code process

**Key difference from Worker Init**: The orchestrator init does NOT call `PATCH /api/sessions/{id}` to update session status to 'running'. It only updates task sessionStatus. The worker init does both.

### 3.9 Coordinate Commands (`coordinate.ts`)

| Command | Args/Options | Description |
|---------|-------------|-------------|
| `maestro coordinate shared-session <session-name>` | - | Create a shared tmux session |
| `maestro coordinate spawn-pane` | `-s, --session <name>` (required), `-v, --vertical`, `--cwd <path>` | Spawn agent in new tmux pane |

These commands use `exec` to run tmux commands. `spawn-pane` reads the manifest from env, creates a pane via `tmux split-window`, then uses `ClaudeSpawner` to spawn Claude in the new pane.

### 3.10 Skill Commands (`skill.ts`)

| Command | Args | Description |
|---------|------|-------------|
| `maestro skill list` | - | List all discovered skills |
| `maestro skill info <name>` | skill name | Get details about a specific skill |
| `maestro skill validate` | - | Validate all skills (checks for skill.md) |

Uses `SkillLoader` service to discover and validate skills. No server API calls.

### 3.11 Manifest Commands (`manifest-generator.ts`)

| Command | Options | Description |
|---------|---------|-------------|
| `maestro manifest generate` | `--role` (required), `--project-id` (required), `--task-ids` (required, comma-separated), `--skills` (default: maestro-worker), `--strategy` (default: simple), `--orchestrator-strategy` (default: default), `--model` (default: sonnet), `--output` (required) | Generate manifest JSON file |

**Manifest Generation Flow**:
1. Fetch tasks from **local storage** (`~/.maestro/data/tasks/`) -- NOT from server API
2. Fetch project from local storage
3. Build session options (model, permissionMode: acceptEdits, thinkingMode: auto, workingDirectory from project)
4. Generate manifest JSON with tasks, session config, skills, strategy
5. Validate manifest against schema
6. Write to output file

**Manifest Contents** (type: `MaestroManifest`):
- `manifestVersion`: '1.0'
- `role`: 'worker' | 'orchestrator'
- `tasks[]`: Array of task data (id, title, description, acceptanceCriteria, projectId, etc.)
- `session`: { model, permissionMode, thinkingMode, maxTurns, timeout, workingDirectory }
- `skills[]`: Loaded skills
- `strategy`: Worker strategy ('simple', 'queue', 'tree')
- `orchestratorStrategy`: Orchestrator strategy ('default', 'intelligent-batching', 'dag')
- `context`: Additional context (codebase, related tasks, project standards)
- `templateId`: Optional server template ID for prompt generation

### 3.12 Legacy/Deprecated Commands (in `index.ts`)

| Deprecated Command | Replacement |
|-------------------|-------------|
| `maestro update <message>` | `maestro report progress` |
| `maestro update:progress <message>` | `maestro report progress` |
| `maestro update:blocked <message>` | `maestro report blocked` |
| `maestro update:needs-input <question>` | `maestro report needs-input` |
| `maestro update:complete <summary>` | `maestro report complete` |
| `maestro update:error <description>` | `maestro report error` |

These delegate to `executeReport()` with a deprecation warning.

---

## 4. Prompt Generation (`prompt-generator.ts`)

The `PromptGenerator` converts manifests into role-specific prompts for Claude sessions.

**Template resolution order** (async):
1. By `templateId` from manifest -> `GET /api/templates/{id}`
2. By role from server -> `GET /api/templates/role/{role}`
3. Fallback to bundled template files (`templates/{role}-{strategy}-prompt.md`)

**Template variable substitution**:
- `${TASK_ID}`, `${TASK_TITLE}`, `${TASK_DESCRIPTION}`, `${TASK_PRIORITY}`
- `${ACCEPTANCE_CRITERIA}` - formatted as numbered list
- `${CODEBASE_CONTEXT}` - recent changes, relevant files, architecture, tech stack
- `${RELATED_TASKS}` - with status emojis and relationship info
- `${PROJECT_STANDARDS}` - coding style, testing, docs, branching, CI/CD
- `${ALL_TASKS}` - multi-task list or tree (supports parentId hierarchy)
- `${TASK_COUNT}`, `${STRATEGY}`, `${STRATEGY_INSTRUCTIONS}`
- `${ORCHESTRATOR_STRATEGY}`, `${ORCHESTRATOR_STRATEGY_INSTRUCTIONS}`

**Strategy-specific instructions**:
- Queue strategy: Instructs agent to use queue commands, not work directly
- Tree strategy: Instructs agent to work through subtasks holistically
- Intelligent-batching orchestrator: Group related tasks for parallel execution
- DAG orchestrator: Respect dependency edges, topological order

---

## 5. Session Brief Generator (`session-brief-generator.ts`)

Generates a formatted ASCII brief displayed before Claude spawns, containing:
- Task title, ID, priority, description
- Acceptance criteria
- Additional tasks (if multi-task)
- Dependencies
- Loaded skills
- Session configuration (model, permission mode, thinking mode, max turns)
- Strategy info (queue/orchestrator-specific)

---

## 6. Command Permissions System

All commands use `guardCommand('command:subcommand')` which checks against manifest-derived permissions. The `commands` top-level command shows what the current session can access.

This means workers can be restricted from running orchestrator-only commands (like `task:complete` directly -- they should use `report:complete` instead).

---

## 7. Issues, Gaps, and Inconsistencies Found

### 7.1 Orchestrator Init Does Not Update Session Status

**File**: `maestro-cli/src/commands/orchestrator-init.ts:84-101`

The orchestrator's `autoUpdateSessionStatus()` only updates **task sessionStatus** but does NOT update the **session status** from 'spawning' to 'running'. Compare with worker-init which does:
```typescript
await api.patch(`/api/sessions/${sessionId}`, { status: 'running' });
```
The orchestrator init omits this call entirely. This means orchestrator sessions may remain in 'spawning' status on the server until the `session register` hook fires separately.

### 7.2 Manifest Generator Reads from Local Storage, Not Server

**File**: `maestro-cli/src/commands/manifest-generator.ts:47-78`

The `ManifestGeneratorCLICommand.fetchTask()` reads from local file storage (`~/.maestro/data/tasks/`), not from the server API. This creates a potential data consistency issue -- if tasks are modified via the server but local storage hasn't synced, manifests will be generated with stale data.

### 7.3 Report `complete` Without `--task` Has Side Effect

**File**: `maestro-cli/src/commands/report.ts:80-85`

`maestro report complete "message"` (without `--task`) does two things:
1. Posts timeline event
2. Marks the **entire session** as completed

This is a significant side effect that may surprise callers. The session completion is only triggered when no task IDs are specified, which is a non-obvious conditional behavior.

### 7.4 `session needs-input` Sends Timeline in PATCH Body

**File**: `maestro-cli/src/commands/session.ts:382-389`

The `session needs-input` command patches the session with a `timeline` array in the body. This is unusual -- other commands post timeline events via `POST /api/sessions/{id}/timeline`. This suggests the server might accept timeline entries embedded in PATCH payloads, which is a different pattern from the rest of the codebase.

### 7.5 `session register` Creates New Sessions with Sparse Data

**File**: `maestro-cli/src/commands/session.ts:296-306`

When `session register` can't find an existing session, it creates a new one via `POST /api/sessions` with a generated name (`{role}: {sessionId.substring(0,16)}`). This path creates sessions outside the normal spawn flow, which could lead to sessions without proper manifest context.

### 7.6 No Error Recovery in Queue Polling

**File**: `maestro-cli/src/commands/queue.ts:165-170`

When polling encounters a network error, it logs and continues but does NOT reset the timeout clock. This means a session with intermittent connectivity will still time out after 30 minutes even if most of that time was spent failing to connect.

### 7.7 `task tree` Makes N+1 API Calls

**File**: `maestro-cli/src/commands/task.ts:383-394`

The `buildTree` function recursively fetches each task and its children individually. For a project with many tasks, this results in O(N) API calls where a single batch endpoint would be more efficient.

### 7.8 `track-file` Silently Exits on No Session

**File**: `maestro-cli/src/index.ts:267-269`

`track-file` silently exits with code 0 if no session ID is set. This is intentional (hook context) but means file tracking is completely invisible when misconfigured.

### 7.9 `session spawn` Uses Hardcoded `spawnSource: 'session'`

**File**: `maestro-cli/src/commands/session.ts:210`

The spawn source is always `'session'`, which means the server always sees agent-initiated spawns. There is no way to distinguish CLI-manual spawns from agent-initiated spawns through this command.

### 7.10 Deprecated Commands Remain in Codebase

**File**: `maestro-cli/src/index.ts:156-188`

Six deprecated `update:*` commands still exist and delegate to `executeReport()`. These should eventually be removed once all agent prompts/templates have been updated to use `report`.
