# Testing Guide: Maestro Spawn Event Consolidation

## Quick Start

### Terminal 1: Start the Server
```bash
cd maestro-server
npm run dev
```

Expected logs:
```
✅ Storage initialized
✅ WebSocket server initialized
Server listening on http://localhost:3000
```

### Terminal 2: Create a Test Session
```bash
# First, create a project and task via API or UI
PROJECT_ID="proj_..." # Use existing project ID
TASK_ID="task_..."    # Use existing task ID

# Spawn a session
curl -X POST http://localhost:3000/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "taskIds": ["'$TASK_ID'"],
    "spawnSource": "manual",
    "role": "worker"
  }'
```

## Server-Side Verification

### Check 1: Event Emission
In server logs, look for:
```
================================================================================
🚀 SESSION SPAWN EVENT RECEIVED
================================================================================
...
💾 CREATING SESSION:
   ✓ Session created: sess_...
   ✓ Name: Worker for task_...
   ✓ Status: spawning
   ✓ Environment variables configured for session

⚙️  PREPARING SPAWN DATA:
   ✓ MAESTRO_SESSION_ID = sess_...
   ✓ MAESTRO_MANIFEST_PATH = /Users/.../manifest.json
   ✓ MAESTRO_SERVER_URL = http://localhost:3000

📡 EMITTING CONSOLIDATED SESSION:CREATED EVENT:
   ✓ Event: session:created (with spawn data)
   ✓ Session ID: sess_...
   ✓ Role: worker
   ✓ Spawn Data Included: YES
   ✓ Consolidated session:created event emitted with spawn data
```

### Check 2: No Spawn Request Events
Search logs for:
```
❌ "session:spawn_request" - SHOULD NOT APPEAR
✅ Only "session:created" events should appear
```

### Check 3: Persisted Session
Verify session was saved with env vars:
```bash
# Find the session file
ls ~/.maestro/data/sessions/

# View session content
cat ~/.maestro/data/sessions/sess_*.json | jq '.env'
```

Expected output:
```json
{
  "MAESTRO_SESSION_ID": "sess_...",
  "MAESTRO_MANIFEST_PATH": "/Users/.../manifest.json",
  "MAESTRO_SERVER_URL": "http://localhost:3000"
}
```

## WebSocket Verification

### Check 1: Browser DevTools
1. Open browser → DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Click on the connection to see messages
4. Create a Maestro session via UI
5. Look for messages:

Expected: ONE message per spawn
```json
{
  "type": "session:created",
  "event": "session:created",
  "data": {
    "session": {
      "id": "sess_...",
      "name": "Worker for task_...",
      "env": {
        "MAESTRO_SESSION_ID": "sess_...",
        "MAESTRO_MANIFEST_PATH": "/path/to/manifest.json",
        "MAESTRO_SERVER_URL": "http://localhost:3000"
      }
    },
    "command": "maestro worker init",
    "cwd": "/project/working/dir",
    "envVars": { ... },
    "projectId": "proj_...",
    "taskIds": ["task_..."],
    "_isSpawnCreated": true
  }
}
```

NOT expected: `session:spawn_request` event

## Client-Side Verification

### Check 1: MaestroContext Logs
In browser console, look for:
```
[MaestroContext] WebSocket: Session created sess_...
[MaestroContext] Maestro spawn session detected - spawning terminal
[MaestroContext] Calling onSpawnTerminalSession callback...
[MaestroContext] Command: maestro worker init
[MaestroContext] Env vars: ["MAESTRO_SESSION_ID", "MAESTRO_MANIFEST_PATH", "MAESTRO_SERVER_URL"]
[MaestroContext] Session spawned successfully
```

### Check 2: Terminal Spawning
- Verify terminal appears in UI
- Verify terminal status shows "running"
- Terminal window should open

## Terminal Process Verification

### Check 1: Environment Variables
In spawned terminal, run:
```bash
# Check if env vars are set
echo "Session ID: $MAESTRO_SESSION_ID"
echo "Manifest Path: $MAESTRO_MANIFEST_PATH"
echo "Server URL: $MAESTRO_SERVER_URL"
```

All three should be populated with actual values.

### Check 2: Process Environment
```bash
# View all MAESTRO_ env vars in current process
env | grep MAESTRO_
```

Expected:
```
MAESTRO_SESSION_ID=sess_12345_xyz789
MAESTRO_MANIFEST_PATH=/Users/username/.maestro/sessions/sess_12345_xyz789/manifest.json
MAESTRO_SERVER_URL=http://localhost:3000
```

## Regular Session Verification

To ensure regular sessions still work unchanged:

### Via API
```bash
# Create regular session (not spawned)
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "taskIds": ["'$TASK_ID'"],
    "name": "Regular Session"
  }'
```

Expected in logs:
```
💾 CREATING SESSION:
   ✓ Session created: sess_...
   ✓ Name: Regular Session
   # (No spawn data, no env vars setup)

📢 EMITTING SESSION:CREATED EVENT:
   ✓ session:created event emitted
   # (Event has only basic session data, no _isSpawnCreated flag)
```

WebSocket message should NOT include:
- `_isSpawnCreated` flag
- `command` field
- `envVars` field
- Spawn data

## Troubleshooting

### Issue: No env vars in spawned terminal
1. Check server logs for "PREPARING SPAWN DATA" section
2. Verify MAESTRO_* vars are logged
3. Check WebSocket message includes envVars
4. Verify MaestroContext detects spawn session
5. Confirm spawning callback receives envVars

### Issue: Terminal doesn't spawn
1. Check MaestroContext callback available
2. Verify `onSessionCreated` receives spawn data
3. Check browser console for errors
4. Verify `isSpawnCreated` detection logic

### Issue: Session not persisted with env vars
1. Check `storage.updateSession()` is called in sessions.ts
2. Verify finalEnvVars are populated before update
3. Check session file in `~/.maestro/data/sessions/`
4. Verify JSON structure includes env object

### Issue: Still seeing spawn_request events
1. Verify websocket.ts doesn't have spawn_request listener
2. Check sessions.ts doesn't emit spawn_request
3. Clear browser cache and reload
4. Restart server

## Performance Checks

### Verify Single Event
Count events in WebSocket messages:
```
Before: 2 events per spawn (spawn_request + created)
After:  1 event per spawn (created only)

Bandwidth saved: ~50% for spawn events
```

### Check Broadcast Time
In server logs:
```
✓ Sent to 2/2 connected client(s) in 0ms
```

Should be very fast (milliseconds).

## Regression Testing

### Test 1: Create Regular Session
- Via API endpoint
- Via UI (if available)
- Verify it works unchanged

### Test 2: Update Session
```bash
curl -X PATCH http://localhost:3000/sessions/{sessionId} \
  -H "Content-Type: application/json" \
  -d '{"status": "running"}'
```
Should work normally.

### Test 3: Delete Session
```bash
curl -X DELETE http://localhost:3000/sessions/{sessionId}
```
Should work normally.

### Test 4: List Sessions
```bash
curl http://localhost:3000/sessions
```
Should return all sessions with correct structure.

---

## Checklist

- [ ] Server starts without errors
- [ ] Maestro spawn creates single session:created event
- [ ] Event includes command, cwd, envVars
- [ ] _isSpawnCreated flag present
- [ ] Session persisted with populated env vars
- [ ] WebSocket broadcasts single event
- [ ] MaestroContext detects spawn session
- [ ] Terminal spawns successfully
- [ ] Spawned terminal has env vars accessible
- [ ] Regular sessions still work
- [ ] Session updates still work
- [ ] Session deletion still works
- [ ] No spawn_request events in logs
- [ ] No errors in browser console

All checks ✅ = Implementation successful!
