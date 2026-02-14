# Session Spawn Event Logging - Quick Start Guide

## What's New

Console logging has been added to show complete details when a session spawn event is received and processed.

## How to See the Logs

### 1. Start the Server
```bash
npm start
# or with debug mode
DEBUG=1 npm start
```

### 2. Make a Spawn Request
```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "taskIds": ["my-task"],
    "role": "worker"
  }'
```

### 3. Watch the Server Console
You'll see output like:

```
================================================================================
🚀 SESSION SPAWN EVENT RECEIVED - 2026-02-03T22:30:45.123Z
================================================================================

📋 REQUEST PAYLOAD:
{ ... full request ... }

✅ PARSING REQUEST PARAMETERS:
   • projectId: my-project
   • taskIds: [my-task]
   ...

🔍 VALIDATION PHASE:
   ✓ projectId validated: my-project
   ✓ taskIds validated (1 tasks)
   ...

[... more detailed logging ...]

================================================================================
✅ SESSION SPAWN COMPLETED SUCCESSFULLY
================================================================================
```

## What Gets Logged

✅ **Request Information**
- Full request payload
- All parameters extracted

✅ **Validation Steps**
- Each parameter validated
- Success/failure indicators

✅ **Database Verification**
- Tasks and projects confirmed to exist
- Details displayed

✅ **Session Creation**
- New session ID and name
- Associated tasks listed

✅ **Manifest Generation**
- CLI command construction
- Process output captured
- Success/failure with exit code

✅ **Event Broadcasting**
- Event type
- Connected clients
- Environment variables
- Manifest summary

✅ **Completion Summary**
- All operation details
- Timestamp

## Common Scenarios

### ✅ Successful Spawn
```
🚀 SESSION SPAWN EVENT RECEIVED
✅ PARSING REQUEST PARAMETERS
🔍 VALIDATION PHASE
✓ All checks pass
📝 MANIFEST GENERATION PHASE
✅ Manifest generated successfully
📡 EMITTING SPAWN REQUEST EVENT
✅ SESSION SPAWN COMPLETED SUCCESSFULLY
```

### ❌ Missing Project
```
🚀 SESSION SPAWN EVENT RECEIVED
✅ PARSING REQUEST PARAMETERS
🔍 VALIDATION PHASE
   ❌ FAILED: Project proj-123 not found

❌ PROJECT_NOT_FOUND
```

### ❌ Invalid Task
```
🚀 SESSION SPAWN EVENT RECEIVED
✅ PARSING REQUEST PARAMETERS
🔍 VALIDATION PHASE
📦 VERIFYING TASKS
   ❌ FAILED: Task task-456 not found

❌ TASK_NOT_FOUND
```

### ❌ CLI Not Installed
```
📝 MANIFEST GENERATION PHASE
   🚀 SPAWNING MAESTRO PROCESS...

❌ MANIFEST GENERATION FAILED
   • Error: Failed to spawn maestro CLI: ENOENT

❌ MANIFEST_GENERATION_FAILED
```

## Troubleshooting

### No logs appearing?
1. Check server is running: `npm start`
2. Make sure request is sent to correct endpoint: `POST /api/sessions/spawn`
3. Check network: `curl -I http://localhost:3000`

### Spawn fails with unknown error?
1. Look for ❌ in the logs
2. Find what failed (validation, manifest, etc.)
3. Check specific error message
4. Use troubleshooting guide: `SPAWN-LOGGING-TROUBLESHOOTING.md`

### Want more verbose output?
```bash
DEBUG=1 npm start
```
This enables additional logging throughout the server.

## Log Interpretation

### Stage Indicators
- 🚀 = Important start
- ✅ = Success/passed
- ❌ = Error/failed
- 📋 = Information
- 📝 = Generation
- 📡 = Broadcasting

### Status Meanings
```
✓ = Check passed, step succeeded
❌ = Check failed, step failed
• = Information/detail about current step
```

### Timing Info
```
⏱️  PROCESS COMPLETED:
   • Exit code: 0           ← 0 = success, 1+ = failure
   • Duration: 245ms       ← How long it took
```

## What to Check First

If spawn fails, check logs in this order:

1. **REQUEST PAYLOAD** - Is the request data correct?
2. **VALIDATION PHASE** - Which check failed?
3. **VERIFYING TASKS** - Does the task exist?
4. **VERIFYING PROJECT** - Does the project exist?
5. **MANIFEST GENERATION** - Did maestro CLI work?
6. **BROADCASTING TO CLIENTS** - Are clients connected?

## Key Information Points

Each successful spawn shows:
- ✅ Session ID (you'll use this to track the session)
- ✅ Manifest path (where the manifest file is stored)
- ✅ Command (what will be executed: `maestro worker init`)
- ✅ Working directory (where the command runs)
- ✅ Skills (what additional capabilities are loaded)
- ✅ Tasks (which tasks are being worked on)

## Important Values to Note

From the spawn logs, you should identify:
```
Session ID: sess-123abc
   ↑ Use this to track the session

Manifest: /home/user/.maestro/sessions/sess-123abc/manifest.json
   ↑ Location of the manifest file

Command: maestro worker init
   ↑ What will execute next

MAESTRO_SESSION_ID=sess-123abc
   ↑ Environment variable passed to worker
```

## Next Steps After Spawn

After successful spawn:
1. Worker should receive manifest via environment
2. Worker spawns Claude with manifest
3. UI should show terminal/session
4. Claude begins working on task

If nothing happens after successful spawn:
1. Check if UI received the spawn event
2. Verify worker init command is available
3. Check Claude can be spawned
4. Look at worker-init logs

## Integration Points

The logging shows data flow:
```
POST /api/sessions/spawn
    ↓
(Request received + logged)
    ↓
(Validation logged)
    ↓
(Manifest generation logged)
    ↓
(Event emission logged)
    ↓
WebSocket broadcast
    ↓
(Broadcast logging shown)
    ↓
UI receives spawn_request
```

## Documentation Reference

For more information, see:

| Document | Purpose |
|----------|---------|
| `SESSION-SPAWN-LOGGING.md` | Complete technical documentation |
| `SPAWN-LOGGING-TROUBLESHOOTING.md` | Troubleshooting and debugging |
| `SPAWN-LOGGING-SUMMARY.md` | Implementation overview |
| `SPAWN-LOGGING-VERIFICATION.md` | Verification checklist |
| `SPAWN-LOGGING-QUICKSTART.md` | This quick start guide |

## Example Full Session Spawn

```bash
# 1. Make request
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "taskIds": ["implement-auth"],
    "role": "worker",
    "spawnSource": "manual"
  }'

# 2. Server logs (see in console):
# 🚀 SESSION SPAWN EVENT RECEIVED - 2026-02-03T22:30:45.123Z
# 📋 REQUEST PAYLOAD: { projectId: 'my-project', taskIds: ['implement-auth'], ... }
# ✅ PARSING REQUEST PARAMETERS: ...
# 🔍 VALIDATION PHASE: ...all pass...
# 📦 VERIFYING TASKS: ...found...
# 🏗️ VERIFYING PROJECT: ...found...
# 💾 CREATING SESSION: ...sess-abc123...
# 📝 MANIFEST GENERATION PHASE: ...success...
# 📡 EMITTING SPAWN REQUEST EVENT: ...emitted...
# ✅ SESSION SPAWN COMPLETED SUCCESSFULLY

# 3. Response:
# {
#   "success": true,
#   "sessionId": "sess-abc123",
#   "manifestPath": "/home/user/.maestro/sessions/sess-abc123/manifest.json",
#   "message": "Spawn request sent to Agent Maestro"
# }

# 4. UI receives spawn event and creates terminal
```

## Quick Test

Quick way to verify logging is working:

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Make spawn request
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test",
    "taskIds": ["test"],
    "role": "worker"
  }' 2>/dev/null

# Terminal 1: Should see logs appear
# Look for: 🚀 SESSION SPAWN EVENT RECEIVED
```

If you see the logs, everything is working! ✅
