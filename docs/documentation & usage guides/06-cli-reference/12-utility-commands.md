# Utility Commands

General-purpose utility commands for inspecting context, debugging, and status.

## maestro whoami

Print the current session context including mode, project, tasks, and permissions.

### Syntax

```
maestro whoami [options]
```

### Arguments

None.

### Flags

Uses global `--json` flag for machine-readable output.

### Example

```bash
maestro whoami
```

```
  Mode:      coordinated-worker
  Session:   sess_17726525_abc12
  Project:   proj_1770533548982_3bgiz
  Task:      Add user authentication (task_abc123) [high]
  Agent:     claude-code
```

### JSON output

```bash
maestro --json whoami
```

```json
{
  "mode": "coordinated-worker",
  "sessionId": "sess_17726525_abc12",
  "projectId": "proj_1770533548982_3bgiz",
  "tasks": [
    {
      "id": "task_abc123",
      "title": "Add user authentication",
      "description": "Implement JWT-based auth",
      "priority": "high",
      "acceptanceCriteria": ["Endpoints return proper auth errors"],
      "status": "in_progress"
    }
  ],
  "permissions": {
    "allowedCommands": ["task:list", "task:get", "session:report:progress"],
    "hiddenCommands": ["project:delete"]
  },
  "context": null
}
```

### Related Commands

- `maestro status` — Project-level overview
- `maestro commands` — View allowed commands

---

## maestro status

Show a summary of the current project state — active sessions, task counts, and overall progress.

### Syntax

```
maestro status
```

### Arguments

None.

### Flags

Uses global `--json` flag.

### Example

```bash
maestro status
```

Outputs a summary of current project state including task and session statistics.

### Related Commands

- `maestro whoami` — Session-level context
- `maestro master context` — Cross-project overview

---

## maestro commands

Show available commands based on current session permissions. Different agent modes and team member configurations have different command access.

### Syntax

```
maestro commands [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--check <command>` | string | — | Check if a specific command is allowed (e.g., `session:spawn`) |

### Example

```bash
maestro commands
```

```
Available Commands:
  task:list        ✅
  task:get         ✅
  task:create      ✅
  task:edit        ❌ (restricted)
  session:spawn    ❌ (restricted)
  report:progress  ✅
  report:complete  ✅
```

### Check a specific command

```bash
maestro commands --check session:spawn
```

```
session:spawn: allowed
```

### Related Commands

- `maestro whoami` — View full session context
- `maestro debug-prompt` — View rendered system prompt

---

## maestro debug-prompt

Show the exact system prompt and task prompt that will be sent to the agent. Useful for debugging prompt composition and verifying manifest content.

### Syntax

```
maestro debug-prompt [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--manifest <path>` | string | — | Path to manifest file (defaults to `MAESTRO_MANIFEST_PATH`) |
| `--session <id>` | string | — | Load manifest for a specific session from the server |
| `--system-only` | boolean | `false` | Show only the system prompt |
| `--task-only` | boolean | `false` | Show only the task prompt |
| `--initial-only` | boolean | `false` | Deprecated alias for `--task-only` |
| `--raw` | boolean | `false` | Output raw text without formatting headers |

### Example

```bash
maestro debug-prompt --session sess_17726525_abc12 --system-only
```

Outputs the full rendered system prompt that would be injected into the agent's context.

```bash
maestro debug-prompt --manifest ~/.maestro/sessions/sess_abc/manifest.json --task-only --raw
```

Outputs only the task prompt XML without formatting headers.

### Related Commands

- `maestro manifest generate` — Generate a manifest to debug
- `maestro whoami` — View current context

---

## maestro show modal

Show an HTML modal in the Maestro UI. Agents can use this to display interactive content to the user.

### Syntax

```
maestro show modal <filePath> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `filePath` | Yes | Path to an HTML file to display in the modal |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--title <title>` | string | `Agent Modal` | Modal title |
| `--id <modalId>` | string | Auto-generated | Custom modal ID |
| `--interactive` | boolean | `false` | Keep process alive and stream user actions as JSONL |
| `--timeout <ms>` | string | `0` | Auto-exit interactive mode after N milliseconds (`0` = no timeout) |

### Example

```bash
maestro show modal ./ui/review-form.html --title "Code Review" --interactive
```

```
✔ Modal sent to UI

Listening for user actions on modal modal_1709abc123...
(Press Ctrl+C to stop)

{"event":"action","modalId":"modal_1709abc123","action":"approve","data":{"comment":"Looks good!"},"timestamp":1709123456789}
{"event":"closed","modalId":"modal_1709abc123","timestamp":1709123460000}
```

### Related Commands

- `maestro modal events` — Listen to events on an existing modal

---

## maestro modal events

Listen for user actions on a previously shown modal. Outputs events as JSONL (one JSON object per line).

### Syntax

```
maestro modal events <modalId> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `modalId` | Yes | Modal ID to listen for events on |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--timeout <ms>` | string | `0` | Auto-exit after N milliseconds (`0` = no timeout) |

### Example

```bash
maestro modal events modal_1709abc123 --timeout 60000
```

```
Listening for user actions on modal modal_1709abc123...
(Press Ctrl+C to stop)

{"event":"action","modalId":"modal_1709abc123","action":"submit","data":{"rating":5},"timestamp":1709123456789}
```

### Related Commands

- `maestro show modal` — Show a modal first
