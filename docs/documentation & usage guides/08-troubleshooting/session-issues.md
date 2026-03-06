# Session Won't Start

This page covers problems related to spawning and starting Maestro sessions.

---

## Manifest Not Found

**Error:**
```
MAESTRO_MANIFEST_PATH environment variable not set
```
or
```
Manifest file not found or not readable: /path/to/manifest.json
```

**Cause:** The session's manifest was not generated or the `MAESTRO_MANIFEST_PATH` env var points to a missing file. Manifests are written to `~/.maestro/sessions/<session-id>/manifest.json` during spawn.

**Solution:**
```bash
# Check if the manifest exists
ls ~/.maestro/sessions/<session-id>/manifest.json

# Verify the env var is set correctly
echo $MAESTRO_MANIFEST_PATH

# Regenerate the manifest manually
maestro manifest generate \
  --mode worker \
  --project-id <project-id> \
  --task-ids <task-id> \
  --output /tmp/test-manifest.json

# Inspect the output
cat /tmp/test-manifest.json
```

**Prevention:** Ensure the server is running before spawning sessions — the server generates the manifest. Check that the `~/.maestro/sessions/` directory is writable.

---

## Session Stuck in "Spawning"

**Error:** Session status shows `spawning` indefinitely and never transitions to `idle` or `working`.

**Cause:** Multiple possible reasons:
1. The server generated the manifest but the UI/PTY never picked it up
2. The agent tool (Claude, Codex, etc.) failed to start
3. WebSocket connection between UI and server is broken

**Solution:**
```bash
# Check session status
maestro session info <session-id> --json

# Check if the server is running
curl http://localhost:3000/health

# Check server logs for errors
# If running in dev mode, check the terminal output

# Try stopping and re-spawning the session
maestro session prompt <session-id> --message "status check"
```

If the session is stuck, you can delete it and spawn a new one:
```bash
# Check what went wrong
maestro session logs <session-id> --tail 50

# Spawn a fresh session
maestro session spawn --task <task-id> --mode worker
```

**Prevention:** Verify the server is healthy (`curl http://localhost:3000/health`) before spawning. In the desktop app, check the WebSocket indicator in the UI.

---

## Claude Doesn't See My Tasks

**Error:** The agent starts but doesn't mention or work on the tasks you assigned.

**Cause:** The manifest either has no `tasks` array or the task IDs don't match existing tasks.

**Solution:**
```bash
# Inspect what the agent actually receives
maestro debug-prompt --manifest

# Check the manifest's task data
maestro debug-prompt --task-only

# Verify the task exists
maestro task get <task-id>

# Verify the session is linked to the task
maestro session info <session-id> --json
```

If the `tasks` array in the manifest is empty:
```bash
# Re-spawn with explicit task IDs
maestro session spawn --task <task-id> --mode worker
```

**Prevention:** Always specify `--task` or `--tasks` when spawning sessions. Verify task IDs exist before spawning.

---

## Permission Denied on Command

**Error:**
```
Command not allowed: <command-name>
```

**Cause:** The team member's `commandPermissions` restricts which `maestro` CLI commands the agent can run. The manifest encodes these permissions and the CLI enforces them.

**Solution:**
```bash
# Check what commands are allowed
maestro commands

# Check a specific command
maestro commands --check "task create"

# Inspect the full permission config
maestro debug-prompt --manifest
```

To fix, update the team member's permissions:
```bash
# Edit the team member to grant more permissions
maestro team-member edit <team-member-id>
```

Key permission groups:
- `session:spawn` — ability to spawn child sessions
- `task:create` — ability to create new tasks
- `task:edit` — ability to modify tasks
- `session:prompt` — ability to prompt other sessions

**Prevention:** When creating team members, explicitly configure `commandPermissions` to match the agent's required capabilities. Coordinators typically need `session:spawn`; workers usually need `task:report`.

---

## Wrong Model Being Used

**Error:** The session uses a different model than expected (e.g., Sonnet instead of Opus).

**Cause:** The model is determined by the team member configuration. If no model is specified, the agent tool's default is used.

**Solution:**
```bash
# Check what model the team member is configured for
maestro team-member get <team-member-id> --json

# Check the manifest
maestro debug-prompt --manifest | grep model

# Update the team member's model
maestro team-member edit <team-member-id>
# Set the model field (e.g., "claude-sonnet-4-20250514")
```

When spawning directly, specify the model:
```bash
maestro session spawn --task <task-id> --model claude-sonnet-4-20250514
```

**Prevention:** Always set the `model` field explicitly on team members. Don't rely on defaults if a specific model is required.

---

## Session Fails Immediately After Spawn

**Error:** Session status jumps to `failed` right after creation.

**Cause:** The agent tool binary is missing, not in PATH, or the manifest is malformed.

**Solution:**
```bash
# Check session events for the error
maestro session logs <session-id> --tail 20

# Verify the agent tool is installed
which claude    # for Claude Code
which codex     # for Codex
which gemini    # for Gemini

# Test manifest generation independently
maestro manifest generate --mode worker --project-id <project-id> --task-ids <task-id>
```

**Prevention:** Ensure your agent tool is installed and accessible in PATH before spawning sessions. Test with `maestro debug-prompt` to verify the manifest generates cleanly.
