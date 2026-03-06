# Hook System Deep Dive

**Hooks are shell commands that execute automatically in response to lifecycle events during a Maestro session. They're how Maestro tracks session status, monitors file changes, and integrates with external systems.**

---

## How Hooks Work

When a session starts, Maestro loads a plugin directory containing a `hooks.json` file. Claude Code reads this file and fires the defined hooks at specific lifecycle points — session start, tool use, user input, etc.

Each hook is a shell command run via `/bin/sh -c`. Hooks are **non-blocking** — a failed hook never crashes the session. They log warnings and continue.

## Hook Architecture

```
Session spawns → Claude Code loads plugin dir
                      ↓
              reads hooks/hooks.json
                      ↓
        Registers hook handlers for lifecycle events
                      ↓
    ┌─────────────────────────────────────────┐
    │  SessionStart   → maestro session register  │
    │  UserPromptSubmit → maestro session resume   │
    │  PostToolUse    → track-file (Write/Edit)    │
    │  Stop           → maestro session needs-input│
    │  SessionEnd     → maestro session complete   │
    └─────────────────────────────────────────┘
```

## Plugin Directory Structure

Hooks live inside plugin directories, one per agent mode:

```
maestro-cli/plugins/
├── maestro-worker/
│   ├── hooks/
│   │   └── hooks.json          # Worker lifecycle hooks
│   ├── bin/
│   │   └── track-file          # File change tracker
│   └── skills/
└── maestro-orchestrator/
    ├── hooks/
    │   └── hooks.json          # Orchestrator lifecycle hooks
    └── skills/
```

The correct plugin is selected based on the session's mode and passed to Claude via `--plugin-dir`.

## Hook Types

### SessionStart

Fires immediately when the Claude session begins.

| Property | Value |
|----------|-------|
| Default command | `maestro session register` |
| Timeout | 5 seconds |
| Purpose | Register the session with the Maestro server, mark status as `working` |
| Failure behavior | Graceful — session continues if server is unreachable |

### SessionEnd

Fires when the Claude process exits (any exit code).

| Property | Value |
|----------|-------|
| Default command | `maestro session complete` |
| Timeout | 3 seconds |
| Purpose | Mark session as `completed` or `failed` based on exit code |
| Failure behavior | Graceful — session is already over |

### UserPromptSubmit

Fires when the user submits input to the Claude session.

| Property | Value |
|----------|-------|
| Default command | `maestro session resume-working` |
| Timeout | 3 seconds |
| Matcher | `*` (all contexts) |
| Purpose | Resume session status to `working` after user input |

### Stop

Fires when the user manually stops or cancels the session.

| Property | Value |
|----------|-------|
| Default command | `maestro session needs-input` |
| Timeout | 3 seconds |
| Matcher | `*` (all contexts) |
| Purpose | Mark session as needing human attention |

### PostToolUse

Fires after a tool (Write or Edit) executes successfully.

| Property | Value |
|----------|-------|
| Default command (worker) | `${CLAUDE_PLUGIN_ROOT}/bin/track-file` |
| Timeout | 2 seconds |
| Matcher | `Write\|Edit` (regex — only file modification tools) |
| Purpose | Track which files the agent modified |
| Note | Only active for workers — orchestrators don't edit files |

The hook receives JSON input via stdin or the `HOOK_INPUT` environment variable:

```json
{
  "tool_input": {
    "file_path": "/path/to/modified/file.ts"
  }
}
```

### PostToolUseFailure

Fires when a tool execution fails.

| Property | Value |
|----------|-------|
| Default command | `maestro session needs-input` |
| Timeout | 3 seconds |
| Matcher | `*` (all tool failures) |
| Purpose | Flag that the agent may need human help |

### Notification

Fires when Claude generates a notification.

| Property | Value |
|----------|-------|
| Default command | `maestro session needs-input` |
| Timeout | 3 seconds |
| Matcher | `*` |
| Purpose | Handle notification events |

### PermissionRequest

Fires when Claude requests permission for an action.

| Property | Value |
|----------|-------|
| Default command | `maestro session needs-input` |
| Timeout | 3 seconds |
| Matcher | `*` |
| Purpose | Signal that the session is waiting for user approval |

## hooks.json Format

```json
{
  "description": "Maestro worker hooks for session lifecycle",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "maestro session register",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/bin/track-file",
            "timeout": 2
          }
        ]
      }
    ]
  }
}
```

**Key fields:**

- `matcher` — A regex pattern that determines when the hook fires. `"*"` matches everything. `"Write|Edit"` matches only those tools.
- `type` — Currently only `"command"` is supported (shell command execution).
- `command` — The shell command to run. Supports `${CLAUDE_PLUGIN_ROOT}` for paths relative to the plugin directory.
- `timeout` — Maximum execution time in seconds. Hook is killed with SIGTERM after this.

## HookExecutor

The `HookExecutor` service handles all shell command execution for hooks.

```typescript
interface HookResult {
  success: boolean;       // Whether exit code was 0
  exitCode: number;       // Numeric exit code
  stdout: string;         // Standard output
  stderr: string;         // Standard error
  error?: string;         // Error message (timeout, failure reason)
}

interface HookOptions {
  cwd?: string;                     // Working directory
  env?: Record<string, string>;     // Additional environment variables
  timeout?: number;                 // Timeout in milliseconds
  stopOnError?: boolean;            // Halt sequence on first failure
}
```

**Execution guarantees:**

- Spawns `/bin/sh -c` with the command as a single argument (prevents injection)
- Captures stdout, stderr, and exit code
- Sends SIGTERM on timeout
- Never blocks or crashes the session — all failures are logged and swallowed
- Supports sequential execution of multiple hooks with optional `stopOnError`

## Environment Variables Available in Hooks

Every hook has access to the full Maestro environment:

| Variable | Description |
|----------|-------------|
| `MAESTRO_SESSION_ID` | Current session identifier |
| `MAESTRO_PROJECT_ID` | Project context |
| `MAESTRO_TASK_IDS` | Comma-separated assigned task IDs |
| `MAESTRO_MODE` | Agent mode (`worker`, `coordinator`, `coordinated-worker`, `coordinated-coordinator`) |
| `MAESTRO_API_URL` | Server API URL |
| `MAESTRO_TASK_TITLE` | Primary task title |
| `MAESTRO_TASK_PRIORITY` | Primary task priority |
| `MAESTRO_MANIFEST_PATH` | Path to the session's manifest.json |
| `CLAUDE_PLUGIN_ROOT` | Path to the plugin directory |
| `HOOK_INPUT` | JSON input from Claude Code (for PostToolUse hooks) |

## Worker vs Orchestrator Hooks

Both modes share most hooks, with one key difference:

| Hook | Worker | Orchestrator |
|------|--------|-------------|
| SessionStart | ✅ | ✅ |
| SessionEnd | ✅ | ✅ |
| UserPromptSubmit | ✅ | ✅ |
| Stop | ✅ | ✅ |
| PostToolUse | ✅ (track-file) | ❌ |
| PostToolUseFailure | ✅ | ✅ |
| Notification | ✅ | ✅ |
| PermissionRequest | ✅ | ✅ |

Orchestrators don't track file changes because they coordinate — they don't edit files directly.

## The track-file Script

The `track-file` utility in `maestro-worker/bin/` reads hook input and records file modifications:

```bash
#!/bin/bash
set -euo pipefail

# Read hook input from stdin or environment
INPUT="${HOOK_INPUT:-$(cat)}"

# Extract file path
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

# Track it
if [ -n "$FILE_PATH" ]; then
  maestro track-file "$FILE_PATH" 2>/dev/null || true
fi

exit 0
```

This runs after every Write or Edit tool call, building a record of which files the session touched.

## Writing Custom Hooks

To add custom hooks, create or modify the `hooks.json` in your plugin directory:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "maestro session complete",
            "timeout": 3
          },
          {
            "type": "command",
            "command": "curl -X POST https://your-webhook.com/session-done -d '{\"session\": \"'$MAESTRO_SESSION_ID'\"}'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Multiple hooks can fire for the same event — they execute sequentially within a matcher group.

## Error Handling

Hooks are designed to fail silently. The guarantees:

1. **Server unreachable** → Hook logs a warning, session continues normally.
2. **Command not found** → Hook logs an error, session continues.
3. **Timeout exceeded** → Hook receives SIGTERM, error flag is set, session continues.
4. **Non-zero exit code** → Error message logged, session continues.
5. **Malformed input** → Hook handles gracefully or skips.

No hook failure will ever stop a running session.
