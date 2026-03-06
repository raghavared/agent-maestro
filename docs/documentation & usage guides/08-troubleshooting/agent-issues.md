# Agent Not Working Correctly

This page covers problems where sessions start successfully but the AI agent doesn't behave as expected.

---

## Claude Ignores the Task Description

**Symptom:** The agent starts and produces output, but doesn't follow the task description or works on something unrelated.

**Cause:** The task data in the manifest may be incomplete, malformed, or the system prompt is too large and the task context gets pushed down.

**Solution:**
```bash
# Inspect exactly what the agent sees
maestro debug-prompt

# Check just the task section
maestro debug-prompt --task-only

# Check the raw manifest
maestro debug-prompt --manifest
```

Verify the task has a meaningful description:
```bash
maestro task get <task-id> --json
```

If the description is empty or vague, update it:
```bash
maestro task edit <task-id>
# Add a clear, actionable description
```

**Prevention:** Write specific, actionable task descriptions. Include acceptance criteria and explicit deliverables. Vague tasks like "fix the bug" give the agent too much latitude.

---

## Orchestrator Not Spawning Workers

**Symptom:** A coordinator session starts but never creates child sessions.

**Cause:** The coordinator doesn't have `session:spawn` permission, or it can't reach the server to make API calls.

**Solution:**
```bash
# Check the coordinator's permissions
maestro commands

# Specifically check spawn permission
maestro commands --check "session spawn"

# Check the team member configuration
maestro team-member get <team-member-id> --json
```

The team member needs `session:spawn` in its `commandPermissions`:
```bash
# Edit the team member to add spawn capability
maestro team-member edit <team-member-id>
# Ensure commandPermissions includes: { "groups": { "session:spawn": true } }
```

Also verify the coordinator can reach the API:
```bash
# From within the session context
maestro status
```

**Prevention:** When creating coordinator team members, always grant `session:spawn` permission. Set the `mode` to `coordinator` or `coordinated-coordinator`.

---

## Workers Can't Communicate

**Symptom:** Worker sessions can't send messages to each other or to their coordinator.

**Cause:** Workers may not know about their siblings, or `session:prompt` permission is missing.

**Solution:**
```bash
# Check if the worker can see its siblings
maestro session siblings

# Check prompt permission
maestro commands --check "session prompt"

# Try prompting manually
maestro session prompt <target-session-id> --message "ping"
```

If `session siblings` returns empty:
- The worker may not have a `parentSessionId` set
- The coordinator may not have spawned them properly

```bash
# Check session details
maestro session info <session-id> --json
# Look for parentSessionId and rootSessionId fields
```

**Prevention:** Use `maestro session spawn` from the coordinator to create workers — this automatically sets parent/child relationships and team boundaries. Don't create sessions manually if they need to communicate.

---

## Progress Not Showing in UI

**Symptom:** The agent reports progress via `maestro task report progress` or `maestro session report progress`, but the UI doesn't show it.

**Cause:** Multiple possible issues:
1. The session ID in the report doesn't match the UI's watched session
2. The WebSocket connection is broken (see [WebSocket Issues](./websocket-issues.md))
3. The timeline event was created but the UI isn't subscribed

**Solution:**
```bash
# Verify the report was recorded
maestro session info <session-id> --json
# Check the timeline array

# Check via API directly
curl http://localhost:3000/api/sessions/<session-id>/timeline

# Verify the session ID matches
echo $MAESTRO_SESSION_ID
```

If reports aren't being recorded at all:
```bash
# Test reporting manually
maestro session report progress "test message"

# Check if the server is receiving it
curl http://localhost:3000/health
```

**Prevention:** Ensure `MAESTRO_SESSION_ID` is set correctly in the session environment. The spawn flow sets this automatically, but custom setups may miss it.

---

## Agent Uses Wrong Agent Tool

**Symptom:** You expected Claude Code but the session launched with Codex, or vice versa.

**Cause:** The `agentTool` field in the team member or spawn command determines which agent binary is used.

**Solution:**
```bash
# Check team member config
maestro team-member get <team-member-id> --json | grep agentTool

# Check the manifest
maestro debug-prompt --manifest | grep agentTool
```

Update the team member:
```bash
maestro team-member edit <team-member-id>
# Set agentTool to: claude-code, codex, or gemini
```

Or specify when spawning:
```bash
maestro session spawn --task <task-id> --agent-tool claude-code
```

**Prevention:** Explicitly set `agentTool` on every team member. Valid values: `claude-code`, `codex`, `gemini`.

---

## Agent Runs Out of Context

**Symptom:** The agent stops mid-task or produces incomplete results, sometimes with errors about context length.

**Cause:** The system prompt (manifest + task data + skills) is very large, leaving less context for the agent's actual work.

**Solution:**
```bash
# Check the total prompt size
maestro debug-prompt --raw | wc -c

# Check which parts are largest
maestro debug-prompt --system-only | wc -c
maestro debug-prompt --task-only | wc -c
```

Reduce prompt size by:
- Shortening task descriptions to essentials
- Removing unnecessary skills from the team member
- Splitting large tasks into smaller subtasks

**Prevention:** Keep task descriptions concise but specific. Don't attach more skills than needed. Use subtasks to break large work into manageable pieces.
