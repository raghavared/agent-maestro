# Environment Variables Fix - Summary

## Status: 🔍 DEBUGGING IN PROGRESS

Added comprehensive logging to trace why MAESTRO_MANIFEST_PATH is not reaching the spawned maestro worker process.

## Changes Made

### 1. **maestro-ui/src-tauri/src/pty.rs** (Rust Tauri Backend)

Added detailed logging to show:
- Environment variables received by Tauri
- Which variables are being set on the command
- Validation of environment variable names

**Log Output Examples:**
```
[PTY] Creating session: id=1, command='zsh -lc maestro worker init', cwd=Some("/project")
[PTY] Received 3 custom env vars
[PTY] Env: MAESTRO_MANIFEST_PATH=/tmp/manifest.json
[PTY] ✅ Setting env: MAESTRO_MANIFEST_PATH (value len=XX)
[PTY] ✅ Finished setting environment variables
```

### 2. **maestro-ui/src/contexts/MaestroContext.tsx** (React Context)

Enhanced logging to show:
- Environment variables received from server via WebSocket
- Whether MAESTRO_MANIFEST_PATH is present
- Full envVars object for debugging

**Log Output Example:**
```
[MaestroContext] Env vars received from server: {
  keys: ["MAESTRO_SESSION_ID", "MAESTRO_MANIFEST_PATH", "MAESTRO_SERVER_URL"],
  hasMaestroManifestPath: true,
  maestroManifestPath: "/Users/subhang/.maestro/sessions/sess_.../manifest.json",
  fullEnvVars: {...}
}
```

### 3. **maestro-ui/src/App.tsx** (React App)

Added logging before Tauri invoke to show:
- Environment variables being passed to Tauri
- Whether MAESTRO_MANIFEST_PATH is included
- Value of MAESTRO_MANIFEST_PATH (first 80 chars)

**Log Output Example:**
```
[App] ℹ️  Passing env_vars to Tauri: {
  hasEnvVars: true,
  envVarKeys: ["MAESTRO_SESSION_ID", "MAESTRO_MANIFEST_PATH", "MAESTRO_SERVER_URL"],
  hasMaestroManifestPath: "YES",
  manifestPathValue: "/Users/subhang/.maestro/sessions/sess_.../man..."
}
```

## How to Use the Debugging

### 1. Rebuild the project
```bash
cd maestro-ui

# Build the Tauri app (this compiles the Rust backend with logging)
npm run tauri build

# Or for development with debugging
npm run tauri dev
```

### 2. Follow the debugging flow
See `DEBUG-ENV-VARS.md` for step-by-step debugging instructions.

### 3. Check logs at each stage

**Browser Console:**
- Open Developer Tools (F12)
- Go to Console tab
- Look for [MaestroContext] and [App] logs

**Tauri Output:**
- Logs might appear in terminal where app was launched
- Or in app's system logs

**Server Logs:**
- Check maestro-server terminal for PREPARING SPAWN DATA logs

**Terminal Output:**
- Check the spawned terminal in the UI for maestro worker init output

## What the Logging Shows

The logging traces the complete flow of environment variables:

```
Server                   WebSocket              UI                       Tauri
  |                         |                    |                         |
  |--1. Create envVars---→   |                    |                         |
  |   MAESTRO_MANIFEST_PATH  |                    |                         |
  |                          |                    |                         |
  |--2. Emit spawn_request→  |                    |                         |
  |     with envVars         |                    |                         |
  |                          |--3. Broadcast----→ |                         |
  |                          |                    |                         |
  |                          |--4. MaestroContext-|                         |
  |                          |    receives envVars|                         |
  |                          |                    |                         |
  |                          |--5. App.tsx--------→ [PTY] Receives HashMap
  |                          |    passes to Tauri |
  |                          |                    |
  |                          |                    ↓ [PTY] Sets on process
  |                          |                    ↓ [PTY] Spawns shell
  |                          |                    ↓ Shell inherits envVars
  |                          |                    ↓ maestro worker init
  |                          |                    ↓ Reads MAESTRO_MANIFEST_PATH
```

## Next Steps

1. **Rebuild the project** with the new logging code
2. **Trigger a session spawn** in the UI
3. **Check logs** at each stage using the guide in `DEBUG-ENV-VARS.md`
4. **Identify the failure point** where envVars stops being passed
5. **Share the logs** so we can fix the specific issue

## Possible Outcomes

### ✅ Outcome 1: Logs show variables being passed correctly
- Check if shell environment inheritance issue
- Variables might not be visible in child processes
- May need to debug how shell spawns subprocess

### ❌ Outcome 2: Logs show variables stopping at MaestroContext
- WebSocket might not be broadcasting envVars properly
- Server might not be including them in spawn_request event
- Check WebSocket event data structure

### ❌ Outcome 3: Logs show variables stopping at App.tsx
- MaestroContext not passing to callback properly
- Check if sessionInfo.envVars is being populated
- Might be a TypeScript/JavaScript issue

### ❌ Outcome 4: Logs show variables stopping at Tauri
- Env_vars not being received by Tauri backend
- Serialization issue from TypeScript to Rust
- HashMap<String, String> type mismatch

## Building & Testing

```bash
# In maestro-ui directory

# Development mode with live reload
npm run tauri dev

# Production build
npm run tauri build

# Check for Rust compilation errors
npm run tauri build 2>&1 | grep error
```

## Files Modified

- `maestro-ui/src-tauri/src/pty.rs` - Added [PTY] logging (Rust)
- `maestro-ui/src/contexts/MaestroContext.tsx` - Enhanced [MaestroContext] logging
- `maestro-ui/src/App.tsx` - Added [App] logging

## Rollback if Needed

If the logging causes issues, these are simple additions that can be reverted:
- Remove eprintln! calls from pty.rs
- Remove console.log calls from MaestroContext.tsx and App.tsx
- All logged values are non-functional additions for debugging only

---

**Created:** 2026-02-03
**Purpose:** Debug environment variable flow in session spawning
**Status:** ✨ Ready for testing
