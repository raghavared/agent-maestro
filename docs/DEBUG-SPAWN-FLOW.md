# Debug Spawn Flow - Environment Variables

## Testing Steps

1. **Restart the UI app** (to pick up the debug logging):
   ```bash
   cd maestro-ui
   npm run tauri dev
   ```

2. **Open Browser DevTools Console** (in the Tauri window):
   - macOS: `Cmd + Option + I`
   - Windows/Linux: `Ctrl + Shift + I`

3. **Click the play button** on a Maestro task

4. **Check the logs** in the DevTools Console

## What to Look For

### Expected Console Output

```
[useMaestroStore] session:created event received
[useMaestroStore] isSpawnCreated: true
[useMaestroStore] message.data: { session: {...}, command: "maestro worker init", cwd: "/path", envVars: { MAESTRO_SESSION_ID: "...", MAESTRO_MANIFEST_PATH: "...", MAESTRO_SERVER_URL: "..." }, ... }
[useMaestroStore] Spawning terminal with envVars: { MAESTRO_SESSION_ID: "...", MAESTRO_MANIFEST_PATH: "...", MAESTRO_SERVER_URL: "..." }
[handleSpawnTerminalSession] Called with: { name: "...", command: "maestro worker init", cwd: "/path", envVars: {...}, projectId: "..." }
[handleSpawnTerminalSession] envVars: { MAESTRO_SESSION_ID: "...", MAESTRO_MANIFEST_PATH: "...", MAESTRO_SERVER_URL: "..." }
[handleSpawnTerminalSession] Invoking create_session with env_vars: { MAESTRO_SESSION_ID: "...", MAESTRO_MANIFEST_PATH: "...", MAESTRO_SERVER_URL: "..." }
```

### Check Server Logs

The maestro-server should show:
```
⚙️  PREPARING SPAWN DATA:
   • Command: maestro worker init
   • Working directory: /path/to/project
   • Environment variables:
     - MAESTRO_SESSION_ID=sess_xxx
     - MAESTRO_MANIFEST_PATH=/path/to/manifest.json
     - MAESTRO_SERVER_URL=http://localhost:3000

📡 EMITTING CONSOLIDATED SESSION:CREATED EVENT:
   • Event: session:created (with spawn data)
   • Spawn Data Included: YES
```

## Possible Issues

### Issue 1: envVars is undefined in UI
**Symptom:** Console shows `envVars: undefined` or `envVars: null`

**Cause:** WebSocket message doesn't include envVars field

**Fix:** Check server logs to ensure it's sending envVars in the event

### Issue 2: envVars is empty object
**Symptom:** Console shows `envVars: {}`

**Cause:** Server is not populating envVars correctly

**Fix:** Check manifest generation on server side

### Issue 3: envVars present but not passed to Tauri
**Symptom:** Console shows envVars in handleSpawnTerminalSession but terminal still errors

**Cause:** Tauri backend may not be receiving or applying env_vars

**Fix:** Need to check Tauri Rust code (src-tauri/src/commands.rs)

## Next Steps

After running the test, share:
1. The console output from the DevTools
2. The maestro-server terminal output
3. The error message in the spawned terminal

This will help identify exactly where the environment variables are being lost.
