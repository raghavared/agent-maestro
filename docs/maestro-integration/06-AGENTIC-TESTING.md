# 06 - Agentic Testing Strategy

An AI agent (Claude Code) executes maestro CLI commands and server API calls to validate the full integration. This document is the spec you hand to Claude Code — it reads it and runs every test.

---

## How This Works

Instead of writing unit tests or bash scripts, you give this file to a Claude Code session. Claude Code:

1. Reads this spec
2. Ensures prerequisites are met (server running, CLI built)
3. Executes each test suite sequentially using `maestro` CLI commands and `curl` for server API
4. Verifies outputs match expectations
5. Reports pass/fail for each test

**Why agentic testing:** The agent can interpret JSON output, handle dynamic IDs, chain commands that depend on previous outputs, and make judgment calls about whether output is correct — things that are tedious in bash scripts and brittle in hardcoded test suites.

---

## Prerequisites

Before running tests, Claude Code should verify:

```bash
# 1. CLI is built and available
maestro --version

# 2. Server is running
curl -s http://localhost:3000/health | jq .

# 3. Working directory exists
ls -la /tmp/maestro-agentic-test || mkdir -p /tmp/maestro-agentic-test
```

If the server is not running:
```bash
cd maestro-server && npm run dev &
sleep 2
curl -s http://localhost:3000/health
```

Set environment for all tests:
```bash
export MAESTRO_SERVER_URL=http://localhost:3000
```

---

## Test Suite 1: CLI Basics

**Goal:** Verify CLI is functional and `--json` flag produces valid JSON.

### Test 1.1 — Version and help
```bash
maestro --version
# EXPECT: version string, exit 0

maestro --help
# EXPECT: help text listing commands, exit 0
```

### Test 1.2 — JSON output for all list commands
```bash
maestro task list --json
# EXPECT: valid JSON array (may be empty), exit 0

maestro session list --json
# EXPECT: valid JSON array (may be empty), exit 0

maestro skill list --json
# EXPECT: valid JSON array, exit 0

maestro whoami --json
# EXPECT: valid JSON object with serverUrl, projectId fields, exit 0

maestro status --json
# EXPECT: valid JSON object, exit 0
```

**Verification:** Pipe each command through `jq .` — must not error.

### Test 1.3 — Exit codes
```bash
maestro task get nonexistent_task_id --json
# EXPECT: exit code 2 (not found), JSON error output

maestro task update nonexistent_task_id --status done --json
# EXPECT: exit code 2 (not found), JSON error output
```

---

## Test Suite 2: Task CRUD

**Goal:** Create, read, update, and delete tasks through CLI. Verify server has the data.

### Test 2.1 — Create a project (via server API)

Tasks need a project context. Create one via curl:

```bash
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Agentic Test Project", "workingDir": "/tmp/maestro-agentic-test"}' | jq .
# CAPTURE: projectId from response .id
```

Set project context:
```bash
export MAESTRO_PROJECT_ID=<projectId>
```

### Test 2.2 — Create tasks via CLI
```bash
maestro task create "Implement authentication" --desc "Add JWT-based auth to the API" --priority high --json
# EXPECT: JSON with task object, .id starts with "task_", .title matches, .status is "pending", .priority is "high"
# CAPTURE: taskId1

maestro task create "Write unit tests" --desc "Cover auth module with tests" --priority medium --json
# EXPECT: JSON with task object
# CAPTURE: taskId2

maestro task create "Update documentation" --desc "Document the auth endpoints" --priority low --json
# EXPECT: JSON with task object
# CAPTURE: taskId3
```

### Test 2.3 — List tasks
```bash
maestro task list --json
# EXPECT: JSON array containing 3 tasks
# VERIFY: all 3 taskIds present

maestro task list --status pending --json
# EXPECT: all 3 tasks (all are pending)

maestro task list --priority high --json
# EXPECT: 1 task (taskId1)
```

### Test 2.4 — Get task details
```bash
maestro task get <taskId1> --json
# EXPECT: JSON object with full task details
# VERIFY: .id === taskId1, .title === "Implement authentication", .status === "pending"
```

### Test 2.5 — Update task
```bash
maestro task update <taskId1> --status in_progress --json
# EXPECT: JSON with updated task, .status === "in_progress"
```

**Cross-verify via server API:**
```bash
curl -s http://localhost:3000/api/tasks/<taskId1> | jq .status
# EXPECT: "in_progress"
```

### Test 2.6 — Complete task
```bash
maestro task complete <taskId2> --json
# EXPECT: JSON with .status === "completed" or "done"
```

### Test 2.7 — Block task
```bash
maestro task block <taskId3> --reason "Waiting for auth to be done first" --json
# EXPECT: JSON with .status === "blocked"
```

### Test 2.8 — Verify from server
```bash
curl -s "http://localhost:3000/api/tasks?projectId=<projectId>" | jq '.[] | {id, status}'
# EXPECT: taskId1=in_progress, taskId2=completed/done, taskId3=blocked
```

---

## Test Suite 3: Hierarchical Tasks (Child Tasks)

**Goal:** Create, list, and manage child tasks using the `--parent` flag.

### Test 3.1 — Create child tasks
```bash
maestro task create "Set up JWT library" --desc "Install and configure jsonwebtoken" --parent <taskId1> --json
# EXPECT: JSON with task data, .parentId === taskId1
# CAPTURE: childTaskId1

maestro task create "Create auth middleware" --parent <taskId1> --json
# EXPECT: JSON with .parentId === taskId1
# CAPTURE: childTaskId2

maestro task create "Add login endpoint" --parent <taskId1> --json
# EXPECT: JSON with .parentId === taskId1
# CAPTURE: childTaskId3
```

### Test 3.2 — List child tasks
```bash
maestro task children <taskId1> --json
# EXPECT: JSON array with 3 child tasks
# VERIFY: all have parentId === taskId1
```

### Test 3.3 — Complete child task
```bash
maestro task update <childTaskId1> --status completed --json
# EXPECT: task marked as completed
```

### Test 3.4 — View task tree
```bash
maestro task tree --json
# EXPECT: hierarchical view showing parent-child relationships
# VERIFY: taskId1 shows childTaskId1, childTaskId2, childTaskId3 as children
```

### Test 3.5 — Verify child task state
```bash
maestro task children <taskId1> --json
# EXPECT: 3 child tasks (childTaskId1 completed, others pending)
```

---

## Test Suite 4: Status Update with updateSource Tracking

**Goal:** Verify the unified status update model. Updates include `updateSource: "user" | "session"` for audit tracking.

### Test 4.1 — Update from session context

Simulate being inside a session by setting env:
```bash
export MAESTRO_SESSION_ID=sess_test_agentic_001
```

```bash
maestro task update <taskId1> --status in_progress --json
# EXPECT: JSON with .status === "in_progress"
```

**Verify server recorded updateSource:**
```bash
curl -s http://localhost:3000/api/tasks/<taskId1> | jq .
# VERIFY: most recent timeline entry has updateSource: "session" and sessionId: "sess_test_agentic_001"
```

### Test 4.2 — Update without session context

```bash
unset MAESTRO_SESSION_ID

maestro task update <taskId1> --status blocked --json
# EXPECT: JSON with .status === "blocked"
```

**Verify server recorded updateSource:**
```bash
curl -s http://localhost:3000/api/tasks/<taskId1> | jq .
# VERIFY: most recent timeline entry has updateSource: "user", no sessionId
```

### Test 4.3 — Update via server API (simulating UI)
```bash
curl -s -X PATCH http://localhost:3000/api/tasks/<taskId1> \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "updateSource": "user"}' | jq .
# EXPECT: .status === "in_progress"
```

### Test 4.4 — No restrictions on status values

Both user and session should be able to set any status:

```bash
export MAESTRO_SESSION_ID=sess_test_agentic_001

# Session sets "done" (normally a human-approval status)
maestro task update <taskId2> --status done --json
# EXPECT: success — no restriction

unset MAESTRO_SESSION_ID

# User sets "in_progress"
maestro task update <taskId2> --status in_progress --json
# EXPECT: success — no restriction
```

---

## Test Suite 5: Progress Updates and Timeline

**Goal:** Test the `update:*` family of commands that log progress to task timeline.

### Test 5.1 — Setup session context
```bash
export MAESTRO_SESSION_ID=sess_test_agentic_001
export MAESTRO_TASK_IDS=<taskId1>
```

### Test 5.2 — Progress update
```bash
maestro update:progress "Finished setting up JWT configuration"
# EXPECT: success, exit 0
```

### Test 5.3 — Blocked update
```bash
maestro update:blocked "Need API key from team lead"
# EXPECT: success, exit 0
# SIDE EFFECT: task status may change to blocked
```

### Test 5.4 — Needs input
```bash
maestro update:needs-input "Should we use RS256 or HS256 for JWT signing?"
# EXPECT: success, exit 0
```

### Test 5.5 — Completion update
```bash
maestro update:complete "Authentication module fully implemented and tested"
# EXPECT: success, exit 0
```

### Test 5.6 — Error update
```bash
maestro update:error "Failed to connect to external OAuth provider"
# EXPECT: success, exit 0
```

### Test 5.7 — Verify timeline on server
```bash
curl -s http://localhost:3000/api/tasks/<taskId1> | jq '.timeline'
# EXPECT: array of timeline events with messages matching the updates above
# VERIFY: each event has timestamp, type, and message fields
```

---

## Test Suite 6: Manifest Generation

**Goal:** Verify manifest generate command produces valid manifests from CLI's own storage.

### Test 6.1 — Generate worker manifest
```bash
maestro manifest generate \
  --role worker \
  --project-id <projectId> \
  --task-ids <taskId1> \
  --skills maestro-worker \
  --output /tmp/maestro-agentic-test/manifest-worker.json \
  --json
# EXPECT: JSON output with success: true, manifestPath field
# EXPECT: exit 0
```

**Verify manifest file:**
```bash
cat /tmp/maestro-agentic-test/manifest-worker.json | jq .
# VERIFY: .manifestVersion === "1.0"
# VERIFY: .role === "worker"
# VERIFY: .tasks is array with 1 element
# VERIFY: .tasks[0].id === taskId1
# VERIFY: .tasks[0].title === "Implement authentication"
# VERIFY: .session exists with .model field
# VERIFY: .skills contains "maestro-worker"
```

### Test 6.2 — Generate orchestrator manifest with multiple tasks
```bash
maestro manifest generate \
  --role orchestrator \
  --project-id <projectId> \
  --task-ids <taskId1>,<taskId2>,<taskId3> \
  --skills maestro-worker \
  --output /tmp/maestro-agentic-test/manifest-orch.json \
  --json
# EXPECT: success
```

**Verify:**
```bash
cat /tmp/maestro-agentic-test/manifest-orch.json | jq '.tasks | length'
# EXPECT: 3

cat /tmp/maestro-agentic-test/manifest-orch.json | jq '.role'
# EXPECT: "orchestrator"
```

### Test 6.3 — Generate with nonexistent project
```bash
maestro manifest generate \
  --role worker \
  --project-id proj_nonexistent \
  --task-ids task_fake \
  --output /tmp/maestro-agentic-test/manifest-fail.json \
  --json
# EXPECT: exit code 2 (not found), JSON error output
# VERIFY: /tmp/maestro-agentic-test/manifest-fail.json does NOT exist or is empty
```

### Test 6.4 — Manifest schema validation
Read the generated worker manifest and verify every required field:

```bash
cat /tmp/maestro-agentic-test/manifest-worker.json | jq '{
  hasVersion: (.manifestVersion != null),
  hasRole: (.role != null),
  hasTasks: (.tasks != null and (.tasks | length) > 0),
  hasSession: (.session != null),
  taskHasId: (.tasks[0].id != null),
  taskHasTitle: (.tasks[0].title != null),
  taskHasStatus: (.tasks[0].status != null),
  taskHasProjectId: (.tasks[0].projectId != null)
}'
# EXPECT: all values true
```

---

## Test Suite 7: Session Lifecycle

**Goal:** Test session registration, info retrieval, and completion reporting.

### Test 7.1 — Create a session via server spawn endpoint
```bash
curl -s -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<projectId>",
    "taskIds": ["<taskId1>"],
    "role": "worker",
    "spawnSource": "ui"
  }' | jq .
# EXPECT: .success === true
# CAPTURE: sessionId from .sessionId
# CAPTURE: manifestPath from .manifestPath
# VERIFY: .envVars.MAESTRO_SESSION_ID === sessionId
# VERIFY: .envVars.MAESTRO_MANIFEST_PATH === manifestPath
# VERIFY: .initialCommand === "maestro worker init"
```

### Test 7.2 — Verify manifest was generated
```bash
cat <manifestPath> | jq .manifestVersion
# EXPECT: "1.0"
```

### Test 7.3 — Register session (simulating CLI SessionStart hook)
```bash
export MAESTRO_SESSION_ID=<sessionId>
export MAESTRO_PROJECT_ID=<projectId>

maestro session register --json
# EXPECT: success response
```

**Verify session status on server:**
```bash
curl -s http://localhost:3000/api/sessions/<sessionId> | jq .status
# EXPECT: "running"
```

### Test 7.4 — Get session info
```bash
maestro session info --json
# EXPECT: JSON with session details, .id === sessionId, .status === "running"
```

### Test 7.5 — List sessions
```bash
maestro session list --json
# EXPECT: JSON array containing the session we created
# VERIFY: at least one session with id === sessionId
```

### Test 7.6 — Complete session (simulating CLI SessionEnd hook)
```bash
maestro session complete --json
# EXPECT: success response
```

**Verify on server:**
```bash
curl -s http://localhost:3000/api/sessions/<sessionId> | jq '{status, completedAt}'
# EXPECT: status === "completed", completedAt is a timestamp string
```

---

## Test Suite 8: Spawn Flow — Agent-Initiated

**Goal:** Verify that agent-initiated spawns emit WebSocket events.

### Test 8.1 — Connect WebSocket listener

Open a WebSocket listener in the background:
```bash
# Using websocat, wscat, or a small node script:
npx wscat -c ws://localhost:3000 --wait 30 > /tmp/maestro-agentic-test/ws-events.log &
WS_PID=$!
sleep 1
```

### Test 8.2 — Session-initiated spawn (agent spawning another session)
```bash
curl -s -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<projectId>",
    "taskIds": ["<taskId2>"],
    "role": "worker",
    "spawnSource": "session",
    "sessionId": "<sessionId>"
  }' | jq .
# EXPECT: .success === true
# CAPTURE: spawnedSessionId from .sessionId
```

### Test 8.3 — Verify WebSocket event received
```bash
sleep 2
kill $WS_PID 2>/dev/null
cat /tmp/maestro-agentic-test/ws-events.log | jq .
# EXPECT: event with type "session:spawn"
# VERIFY: .data.session.id === spawnedSessionId
# VERIFY: .data.envVars.MAESTRO_SESSION_ID === spawnedSessionId
# VERIFY: .data.command contains "worker init"
```

### Test 8.4 — UI-initiated spawn (no WebSocket event)

Restart WebSocket listener:
```bash
npx wscat -c ws://localhost:3000 --wait 10 > /tmp/maestro-agentic-test/ws-events-ui.log &
WS_PID=$!
sleep 1
```

```bash
curl -s -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<projectId>",
    "taskIds": ["<taskId3>"],
    "role": "worker",
    "spawnSource": "ui"
  }' | jq .
# EXPECT: .success === true
```

```bash
sleep 2
kill $WS_PID 2>/dev/null
cat /tmp/maestro-agentic-test/ws-events-ui.log
# EXPECT: NO "session:spawn" event (may see "session:created" CRUD event, but NOT "session:spawn")
```

---

## Test Suite 9: Session Spawn from CLI (Orchestrator Flow)

**Goal:** Test spawning worker sessions from within an orchestrator session using the CLI.

### Test 9.1 — Setup orchestrator context
```bash
export MAESTRO_SESSION_ID=sess_orchestrator_test
export MAESTRO_PROJECT_ID=<projectId>
export MAESTRO_SERVER_URL=http://localhost:3000
```

### Test 9.2 — Create child tasks
```bash
maestro task create "Auth: JWT token generation" --priority high --json
# CAPTURE: childTaskId1

maestro task create "Auth: Token validation middleware" --priority high --json
# CAPTURE: childTaskId2
```

### Test 9.3 — Spawn worker session from CLI
```bash
maestro session spawn --task <childTaskId1> --skill maestro-worker --name "JWT Worker" --reason "Delegating JWT implementation" --json
# EXPECT: JSON with success confirmation
# VERIFY: response contains session info for the spawned worker
# CAPTURE: workerSessionId
```

### Test 9.4 — Verify spawned session on server
```bash
curl -s http://localhost:3000/api/sessions/<workerSessionId> | jq '{id, status, metadata}'
# EXPECT: status is "spawning" or "running"
# VERIFY: metadata.spawnSource === "session"
# VERIFY: metadata.spawnedBy === "sess_orchestrator_test"
```

### Test 9.5 — Spawn with --include-related
```bash
maestro session spawn --task <childTaskId2> --include-related --json
# EXPECT: success, spawned session includes related task context
```

---

## Test Suite 10: Skill Management

**Goal:** Verify skill listing and info commands.

### Test 10.1 — List skills
```bash
maestro skill list --json
# EXPECT: JSON array of skill objects
# VERIFY: each has name, description fields
```

### Test 10.2 — Skill info
```bash
# Pick first skill name from the list above
maestro skill info maestro-worker --json
# EXPECT: JSON with skill details (or error if skill doesn't exist — that's OK, note it)
```

### Test 10.3 — Validate skills
```bash
maestro skill validate
# EXPECT: validation output showing valid/invalid counts
```

---

## Test Suite 11: Server API Direct Verification

**Goal:** Verify server API endpoints match the integration contract using curl.

### Test 11.1 — Project CRUD
```bash
# Create
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "API Test Project", "workingDir": "/tmp/api-test"}' | jq .
# CAPTURE: apiProjectId

# Get
curl -s http://localhost:3000/api/projects/<apiProjectId> | jq .
# VERIFY: .name === "API Test Project"

# Update
curl -s -X PATCH http://localhost:3000/api/projects/<apiProjectId> \
  -H "Content-Type: application/json" \
  -d '{"name": "Renamed Project"}' | jq .
# VERIFY: .name === "Renamed Project"

# List
curl -s http://localhost:3000/api/projects | jq '. | length'
# EXPECT: at least 2 (from our tests)

# Delete
curl -s -X DELETE http://localhost:3000/api/projects/<apiProjectId> | jq .
# EXPECT: success
```

### Test 11.2 — Task filtering
```bash
# By project
curl -s "http://localhost:3000/api/tasks?projectId=<projectId>" | jq '. | length'
# EXPECT: number of tasks we created

# By status
curl -s "http://localhost:3000/api/tasks?projectId=<projectId>&status=pending" | jq '. | length'

# By priority
curl -s "http://localhost:3000/api/tasks?projectId=<projectId>&priority=high" | jq '. | length'
```

### Test 11.3 — Task children
```bash
# If we created child tasks with --parent flag:
curl -s http://localhost:3000/api/tasks/<taskId1>/children | jq .
# EXPECT: array of child tasks (may be empty if no parent relationship set)
```

### Test 11.4 — Task timeline
```bash
curl -s -X POST http://localhost:3000/api/tasks/<taskId1>/timeline \
  -H "Content-Type: application/json" \
  -d '{"message": "Agentic test timeline event", "type": "progress", "sessionId": "sess_test_agentic_001"}' | jq .
# EXPECT: success

curl -s http://localhost:3000/api/tasks/<taskId1> | jq '.timeline[-1]'
# VERIFY: .message === "Agentic test timeline event"
```

### Test 11.5 — Session filtering
```bash
curl -s "http://localhost:3000/api/sessions?projectId=<projectId>" | jq '. | length'
# EXPECT: multiple sessions from our tests

curl -s "http://localhost:3000/api/sessions?projectId=<projectId>&status=completed" | jq '. | length'
```

### Test 11.6 — Health check
```bash
curl -s http://localhost:3000/health | jq .
# VERIFY: .status === "ok"
# VERIFY: .uptime is a number > 0
```

### Test 11.7 — Error responses
```bash
# 404 — nonexistent resource
curl -s http://localhost:3000/api/tasks/task_nonexistent | jq .
# VERIFY: has .error === true, .code field, .message field

# 404 — unknown route
curl -s http://localhost:3000/api/nonexistent_route | jq .
# VERIFY: 404 response with error format

# 400 — bad request
curl -s -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# VERIFY: 400 with .code === "missing_project_id" or similar
```

---

## Test Suite 12: Offline Mode

**Goal:** Verify CLI works without server.

### Test 12.1 — Stop server (or use unreachable URL)
```bash
export MAESTRO_SERVER_URL=http://localhost:9999
unset MAESTRO_API_URL
```

### Test 12.2 — Commands that should work offline

These commands read from CLI's own storage, not server:
```bash
maestro skill list --json
# EXPECT: still works (reads from ~/.skills/)

maestro whoami --json
# EXPECT: works, shows env context
```

### Test 12.3 — Commands that degrade gracefully
```bash
maestro task list --json
# EXPECT: either works from local storage, or returns empty/error without crashing
# MUST NOT: hang or crash

maestro session list --json
# EXPECT: same — graceful degradation
```

### Test 12.4 — Worker init with manifest (offline)

Create a test manifest manually:
```bash
mkdir -p /tmp/maestro-agentic-test/offline-session
cat > /tmp/maestro-agentic-test/offline-session/manifest.json << 'EOF'
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [
    {
      "id": "task_offline_001",
      "title": "Offline test task",
      "description": "Testing offline mode",
      "status": "pending",
      "priority": "medium",
      "subtasks": [],
      "acceptanceCriteria": ["Works offline"],
      "projectId": "proj_offline",
      "parentId": null,
      "dependencies": [],
      "createdAt": "2026-02-05T00:00:00Z"
    }
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  },
  "skills": ["maestro-worker"],
  "context": {
    "projectName": "Offline Test",
    "workingDir": "/tmp/maestro-agentic-test"
  }
}
EOF
```

```bash
export MAESTRO_MANIFEST_PATH=/tmp/maestro-agentic-test/offline-session/manifest.json
export MAESTRO_SESSION_ID=sess_offline_test
export MAESTRO_PROJECT_ID=proj_offline
export MAESTRO_DEBUG=true  # Prevent actual Claude spawn

maestro worker init
# EXPECT: CLI starts, reads manifest, shows session brief
# MUST NOT: crash or hang due to server unreachable
# EXPECT: warning message about server unavailability (stderr)
```

### Test 12.5 — Restore server connection
```bash
export MAESTRO_SERVER_URL=http://localhost:3000
unset MAESTRO_DEBUG
```

---

## Test Suite 13: Concurrent Sessions

**Goal:** Verify multiple sessions can operate independently.

### Test 13.1 — Create two independent task contexts
```bash
maestro task create "Session A task" --priority high --json
# CAPTURE: sessionATaskId

maestro task create "Session B task" --priority high --json
# CAPTURE: sessionBTaskId
```

### Test 13.2 — Simulate two concurrent sessions

**Session A:**
```bash
MAESTRO_SESSION_ID=sess_concurrent_A maestro task update <sessionATaskId> --status in_progress --json
# EXPECT: success, updateSource: "session", sessionId: "sess_concurrent_A"
```

**Session B:**
```bash
MAESTRO_SESSION_ID=sess_concurrent_B maestro task update <sessionBTaskId> --status in_progress --json
# EXPECT: success, updateSource: "session", sessionId: "sess_concurrent_B"
```

### Test 13.3 — Verify no cross-contamination
```bash
curl -s http://localhost:3000/api/tasks/<sessionATaskId> | jq '.timeline[-1].sessionId'
# EXPECT: "sess_concurrent_A" (NOT sess_concurrent_B)

curl -s http://localhost:3000/api/tasks/<sessionBTaskId> | jq '.timeline[-1].sessionId'
# EXPECT: "sess_concurrent_B"
```

### Test 13.4 — Both update same task
```bash
MAESTRO_SESSION_ID=sess_concurrent_A maestro task update <sessionATaskId> --status blocked --json
MAESTRO_SESSION_ID=sess_concurrent_B maestro task update <sessionATaskId> --status in_progress --json

curl -s http://localhost:3000/api/tasks/<sessionATaskId> | jq .status
# EXPECT: "in_progress" (last write wins)

curl -s http://localhost:3000/api/tasks/<sessionATaskId> | jq '.timeline | length'
# EXPECT: timeline has entries from both sessions
```

---

## Test Suite 14: ID Format Verification

**Goal:** Verify all generated IDs follow `{prefix}_{timestamp}_{random}` format.

### Test 14.1 — Collect IDs
```bash
# Get a project ID
curl -s http://localhost:3000/api/projects | jq '.[0].id'
# VERIFY: matches pattern ^proj_\d+_[a-z0-9]+$

# Get a task ID
maestro task list --json | jq '.[0].id'
# VERIFY: matches pattern ^task_\d+_[a-z0-9]+$

# Get a session ID
maestro session list --json | jq '.[0].id'
# VERIFY: matches pattern ^sess_\d+_[a-z0-9]+$
```

---

## Cleanup

After all tests, clean up test data:

```bash
# Delete test project (cascades to tasks/sessions on server)
curl -s -X DELETE http://localhost:3000/api/projects/<projectId>

# Clean up temp files
rm -rf /tmp/maestro-agentic-test

# Unset env vars
unset MAESTRO_SESSION_ID
unset MAESTRO_PROJECT_ID
unset MAESTRO_TASK_IDS
unset MAESTRO_MANIFEST_PATH
unset MAESTRO_DEBUG
```

---

## Reporting Format

Claude Code should produce a summary at the end:

```
=== MAESTRO AGENTIC TEST RESULTS ===

Suite 1: CLI Basics              — X/Y passed
Suite 2: Task CRUD               — X/Y passed
Suite 3: Hierarchical Tasks      — X/Y passed
Suite 4: Status updateSource     — X/Y passed
Suite 5: Progress & Timeline     — X/Y passed
Suite 6: Manifest Generation     — X/Y passed
Suite 7: Session Lifecycle       — X/Y passed
Suite 8: Spawn Flow (WS events)  — X/Y passed
Suite 9: Orchestrator Spawn      — X/Y passed
Suite 10: Skill Management       — X/Y passed
Suite 11: Server API Direct      — X/Y passed
Suite 12: Offline Mode           — X/Y passed
Suite 13: Concurrent Sessions    — X/Y passed
Suite 14: ID Format              — X/Y passed

TOTAL: XX/YY passed

FAILURES:
- [Suite X, Test X.Y]: <description of failure>
- ...

NOTES:
- <any observations, warnings, or edge cases discovered>
```

---

## Notes for the Agent

1. **Dynamic IDs:** Every test that creates a resource returns an ID. Capture it and use it in subsequent commands. Never hardcode IDs.

2. **Order matters:** Run suites 1-6 first (they build on each other). Suites 7-14 can be run in any order after that.

3. **Don't skip verification:** After every mutation (create, update, delete), verify the state via a separate read command or API call. The point is to catch inconsistencies between CLI and server.

4. **Interpret errors intelligently:** If a command fails, check whether:
   - The CLI feature isn't implemented yet (note as "NOT IMPLEMENTED")
   - The server endpoint is missing (note as "SERVER MISSING")
   - The output format is wrong (note as "FORMAT MISMATCH")
   - It's an actual bug (note as "BUG")

5. **Env var hygiene:** Always set/unset `MAESTRO_SESSION_ID` explicitly for each test that depends on session context. Leftover env vars will cause incorrect `updateSource` tracking.

6. **Timing:** Some tests (WebSocket events) need `sleep` between commands. If events aren't received, try increasing the wait time before marking as failed.

7. **Offline tests:** Be careful with offline tests (Suite 12) — restore the server URL afterwards or remaining tests will fail.

---

**Last Updated:** 2026-02-05
