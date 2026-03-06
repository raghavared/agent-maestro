# Environment Variables

Maestro uses environment variables for configuration and session context. These are set automatically when sessions are spawned, but can be manually configured for development and debugging.

## Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAESTRO_API_URL` | `http://localhost:3000` | Maestro server URL. Set in `~/.maestro/config`. Production default is `http://localhost:2357`. |

## Session Context

These variables are automatically set when a session is spawned via `maestro session spawn` or the Maestro UI.

| Variable | Default | Description |
|----------|---------|-------------|
| `MAESTRO_PROJECT_ID` | — | Current project ID. Required for most commands. |
| `MAESTRO_SESSION_ID` | — | Current session ID. Required for report and session lifecycle commands. |
| `MAESTRO_TASK_IDS` | — | Comma-separated task IDs assigned to this session. |
| `MAESTRO_MANIFEST_PATH` | — | Path to the session's manifest JSON file (e.g., `~/.maestro/sessions/<session-id>/manifest.json`). |

## Agent Mode

| Variable | Default | Description |
|----------|---------|-------------|
| `MAESTRO_ROLE` | — | Legacy role identifier: `worker` or `orchestrator`. |
| `MAESTRO_MODE` | — | Agent mode: `worker`, `coordinator`, `coordinated-worker`, or `coordinated-coordinator`. |
| `MAESTRO_STRATEGY` | — | Workflow strategy for the session (e.g., `execute-simple`, `coordinate-default`). |

## Coordination

| Variable | Default | Description |
|----------|---------|-------------|
| `MAESTRO_COORDINATOR_SESSION_ID` | — | Session ID of the parent coordinator. Set when spawned by a coordinator session. Used to auto-derive coordinated mode. |
| `MAESTRO_IS_MASTER` | — | Set to `true` when running as a master session. Enables cross-project commands and embeds all project data in the manifest. |

## Session Directory

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_DIR` | `~/.maestro/sessions` | Base directory for session data (manifests, modals, etc.). |
| `DATA_DIR` | `~/.maestro/data` | Base directory for Maestro data files (projects, tasks, sessions JSON). |

## Manifest Generation

These variables are read by `maestro manifest generate` during the spawn flow:

| Variable | Default | Description |
|----------|---------|-------------|
| `MAESTRO_INITIAL_DIRECTIVE` | — | JSON string with initial directive: `{"subject": "...", "message": "...", "fromSessionId": "..."}`. Embedded in manifest for guaranteed delivery to the spawned agent. |
| `MAESTRO_PERMISSION_MODE` | — | Override session permission mode: `acceptEdits`, `interactive`, `readOnly`, or `bypassPermissions`. |
| `MAESTRO_MEMBER_OVERRIDES` | — | JSON string of per-member launch overrides. Keys are member IDs, values are objects with optional `agentTool`, `model`, `permissionMode`, `skillIds`, `commandPermissions`. |

## Debugging

| Variable | Default | Description |
|----------|---------|-------------|
| `MAESTRO_DEBUG` | — | Set to `true` for verbose debug output. Shows detailed hook execution, API calls, and error stack traces. |

## Usage Examples

### Manual session setup (development)

```bash
export MAESTRO_API_URL=http://localhost:3000
export MAESTRO_PROJECT_ID=proj_1770533548982_3bgiz
export MAESTRO_SESSION_ID=sess_dev_001
export MAESTRO_TASK_IDS=task_abc123

maestro whoami
maestro task get
maestro report progress "Working on the task"
```

### Override server for remote access

```bash
export MAESTRO_API_URL=http://192.168.1.100:2357
maestro project list
```

### Debug prompt composition

```bash
export MAESTRO_DEBUG=true
export MAESTRO_MANIFEST_PATH=~/.maestro/sessions/sess_abc/manifest.json
maestro debug-prompt --system-only
```

### Master session context

```bash
export MAESTRO_IS_MASTER=true
export MAESTRO_PROJECT_ID=proj_master_001
maestro master context
```

## Configuration File

In addition to environment variables, the Maestro API URL can be set in the config file:

```
~/.maestro/config
```

This file contains the server URL (e.g., `http://localhost:3000`). Environment variables take precedence over the config file.

## Data Storage Paths

```
~/.maestro/
├── config                          # MAESTRO_API_URL
├── bin/                            # CLI + server binaries
│   ├── maestro                     # CLI binary
│   └── maestro-server              # Server binary
├── data/                           # JSON data storage
│   ├── projects/<id>.json
│   ├── tasks/<id>.json
│   ├── sessions/<id>.json
│   ├── task-lists/<id>.json
│   ├── team-members/<projectId>.json
│   ├── teams/<projectId>.json
│   └── orderings/
└── sessions/<id>/                  # Per-session data
    └── manifest.json               # Session manifest
```
