# Debugging Environment Variables Flow

## Problem
MAESTRO_MANIFEST_PATH environment variable is not reaching the spawned maestro process.

## Solution: Comprehensive Logging Added

I've added detailed logging at every stage of the environment variables flow:

### 1. **Server Side** (maestro-server/src/api/sessions.ts)
Server creates the spawn_request with envVars including MAESTRO_MANIFEST_PATH.

**Check server logs for:**
```
⚙️  PREPARING SPAWN DATA:
   • Environment variables:
     - MAESTRO_SESSION_ID=sess_...
     - MAESTRO_MANIFEST_PATH=/tmp/...
     - MAESTRO_SERVER_URL=...

📡 EMITTING SPAWN REQUEST EVENT:
   ✓ Spawn request event emitted
```

### 2. **WebSocket Broadcast** (maestro-server/src/websocket.ts)
WebSocket broadcasts spawn_request to all connected UI clients.

**Check server logs for:**
```
📡 SESSION SPAWN REQUEST EVENT BROADCAST
   • Event: session:spawn_request
   • Session ID: sess_...
   ✓ Sent to N connected client(s)
```

### 3. **MaestroContext Receives** (maestro-ui/src/contexts/MaestroContext.tsx) ✨ NEW LOGGING
MaestroContext receives spawn_request WebSocket event and passes envVars to callback.

**Check browser console for:**
```
[MaestroContext] Env vars received from server: {
  keys: ["MAESTRO_SESSION_ID", "MAESTRO_MANIFEST_PATH", "MAESTRO_SERVER_URL"],
  hasMaestroManifestPath: true,
  maestroManifestPath: "/Users/subhang/.maestro/sessions/sess_.../manifest.json",
  fullEnvVars: {...}
}
```

**If you see:**
- `hasMaestroManifestPath: false` → Server didn't send it
- `keys: []` → WebSocket didn't broadcast envVars properly
- Missing in fullEnvVars → Server response incomplete

### 4. **App.tsx Passes to Tauri** (maestro-ui/src/App.tsx) ✨ NEW LOGGING
App.tsx invokes Tauri create_session with env_vars parameter.

**Check browser console for:**
```
[App] ℹ️  Passing env_vars to Tauri: {
  hasEnvVars: true,
  envVarKeys: ["MAESTRO_SESSION_ID", "MAESTRO_MANIFEST_PATH", "MAESTRO_SERVER_URL"],
  hasMaestroManifestPath: "YES",
  manifestPathValue: "/Users/subhang/.maestro/sessions/sess_.../man..."
}
```

**If you see:**
- `hasEnvVars: false` → envVars not received from MaestroContext
- `hasMaestroManifestPath: "NO"` → envVars missing the path
- Empty envVarKeys → No environment variables at all

### 5. **Tauri Backend Receives** (maestro-ui/src-tauri/src/pty.rs) ✨ NEW LOGGING
Tauri backend (Rust) receives env_vars HashMap and applies to spawned process.

**Check Tauri stderr for** (visible in app logs/console):
```
[PTY] Creating session: id=123, command='zsh -lc maestro worker init', cwd=Some("/project")
[PTY] Received 3 custom env vars
[PTY] Env: MAESTRO_SESSION_ID=sess_...
[PTY] Env: MAESTRO_MANIFEST_PATH=/tmp/manifest.json
[PTY] Env: MAESTRO_SERVER_URL=http://localhost:3000
[PTY] ✅ Setting env: MAESTRO_SESSION_ID (value len=XX)
[PTY] ✅ Setting env: MAESTRO_MANIFEST_PATH (value len=XX)
[PTY] ✅ Setting env: MAESTRO_SERVER_URL (value len=XX)
[PTY] ✅ Finished setting environment variables
```

**If you see:**
- `[PTY] Received 0 custom env vars` → Tauri didn't receive the HashMap
- `[PTY] ⚠️  No env_vars provided` → env_vars is None
- `[PTY] ⚠️  Skipping invalid env key: 'MAESTRO_...'` → Environment variable name is invalid
- Missing MAESTRO_MANIFEST_PATH in the list → Not passed from App.tsx

### 6. **Worker Init Runs** (maestro-cli/src/commands/worker-init.ts)
Worker init reads MAESTRO_MANIFEST_PATH from process.env.

**Check terminal output for:**
```
🔧 Initializing Maestro Worker Session

📋 Reading manifest...
   Manifest: /Users/subhang/.maestro/sessions/sess_.../manifest.json
   Task: My Task (task-123)
   Project: my-project
   Session ID: session-1234567890

🚀 Spawning Claude Code session...
✅ Worker session started successfully!
```

**If you see:**
```
❌ Failed to initialize worker session:
MAESTRO_MANIFEST_PATH environment variable not set.
```

→ Tauri didn't pass the environment variable to the spawned process

---

## Debugging Checklist

Run this test and check logs at each stage:

### Step 1: Start servers
```bash
# Terminal 1: Start maestro server
cd maestro-server && npm start

# Terminal 2: Start maestro UI dev server
cd maestro-ui && npm start
```

### Step 2: Open browser console
Open browser dev tools → Console tab (to see [MaestroContext] and [App] logs)

### Step 3: Request session spawn
- Create a project in UI
- Create a task in the project
- Click "Work on Task" button to request session spawn

### Step 4: Check logs in order

**1. Browser Console**
```
[MaestroContext] Env vars received from server: {...}
[App] ℹ️  Passing env_vars to Tauri: {...}
```

**2. Server Logs**
```
⚙️  PREPARING SPAWN DATA:
📡 EMITTING SPAWN REQUEST EVENT:
📡 SESSION SPAWN REQUEST EVENT BROADCAST
```

**3. Tauri Stderr** (might appear in terminal where app was launched, or in app's internal logs)
```
[PTY] Creating session: ...
[PTY] Received N custom env vars
[PTY] ✅ Setting env: MAESTRO_MANIFEST_PATH ...
[PTY] ✅ Finished setting environment variables
```

**4. Terminal Output** (in the spawned terminal inside the UI)
```
🔧 Initializing Maestro Worker Session
📋 Reading manifest...
   Manifest: /path/to/manifest.json
```

---

## Common Issues and Solutions

### Issue: Terminal exiting after command fails
**Symptom:** Terminal shows error then closes immediately
**Cause:** Shell runs command with `-lc` and exits on error
**Solution:** Wait for the full flow - terminal should stay open if variables are passed correctly

### Issue: "MAESTRO_MANIFEST_PATH environment variable not set"
**Symptom:** Error appears in terminal
**Cause:** One of 5 possible points of failure (see above)
**Solution:** Follow the debugging checklist to find which stage is failing

### Issue: No logs appearing in browser console
**Symptom:** Can't see [MaestroContext] or [App] logs
**Cause:** Browser console not open or logs written before it opened
**Solution:** Open console BEFORE triggering session spawn, then clear console and try again

### Issue: No logs appearing in Tauri stderr
**Symptom:** Can't see [PTY] logs
**Cause:** Stderr not being captured/shown
**Solution:** Check if terminal where Tauri app was launched shows the logs

---

## Logs to Share for Support

If debugging doesn't help, please share:

1. **Browser Console** (full history from start to error)
   - [MaestroContext] logs
   - [App] logs
   - Any error messages

2. **Server Logs** (from maestro-server terminal)
   - PREPARING SPAWN DATA section
   - EMITTING SPAWN REQUEST EVENT section
   - SESSION SPAWN REQUEST EVENT BROADCAST section

3. **Tauri Output** (if visible)
   - [PTY] logs showing environment variable setup

4. **Terminal Output** (from the spawned terminal in UI)
   - All output including errors

5. **Steps to Reproduce**
   - Exact steps you took to trigger session spawn

---

## Next Steps After Debugging

Once you identify where the flow breaks:

1. If MaestroContext not receiving envVars → WebSocket broadcast issue
2. If App not passing to Tauri → MaestroContext callback issue
3. If Tauri receiving but not setting → Rust CommandBuilder issue
4. If envVars set but not reaching worker init → Shell environment inheritance issue

Share the logs with this analysis and we can fix the specific failure point.
