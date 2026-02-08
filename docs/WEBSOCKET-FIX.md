# WebSocket Connection Fix - Task Play Button Session Spawning

## Problem

When clicking the play button on a Maestro task, sessions were not spawning in the UI terminal.

## Root Cause

The WebSocket connection to maestro-server was **never initialized**, causing the UI to miss `session:created` events from the server.

### Expected Flow

1. User clicks play button on task
2. UI calls `maestroClient.spawnSession()`
3. Server creates session, generates manifest via CLI
4. **Server emits `session:created` WebSocket event with spawn data**
5. **UI receives event via WebSocket**
6. UI spawns terminal session with environment variables

### What Was Broken

Step 5 was failing because the WebSocket connection was never established.

## Evidence

The `useMaestroStore` (maestro-ui/src/stores/useMaestroStore.ts) had:
- ✅ WebSocket message handler (`handleMessage`) - line 63
- ✅ WebSocket connection logic (`connectGlobal`) - line 103
- ✅ `initWebSocket()` method - line 231
- ❌ **But `initWebSocket()` was never called during app initialization**

## Fix Applied

Modified `maestro-ui/src/stores/initApp.ts`:

1. **Added import:**
   ```typescript
   import { useMaestroStore } from './useMaestroStore';
   ```

2. **Initialize WebSocket on startup** (line 94):
   ```typescript
   const setup = async () => {
     const s = stores();

     // ──── MAESTRO WEBSOCKET ────
     // Initialize WebSocket connection to maestro-server for real-time updates
     useMaestroStore.getState().initWebSocket();

     // ... rest of setup
   }
   ```

3. **Cleanup WebSocket on teardown** (line 624):
   ```typescript
   return () => {
     cancelled = true;
     unlisteners.forEach((fn) => fn());

     // Clean up Maestro WebSocket
     useMaestroStore.getState().destroyWebSocket();

     // ... rest of cleanup
   }
   ```

## How It Works Now

1. App starts → `initApp()` runs → WebSocket connects to `ws://localhost:3000`
2. User clicks play button → Server spawns session
3. Server emits `session:created` event with `{ session, command, cwd, envVars, _isSpawnCreated: true }`
4. UI receives event → `useMaestroStore.handleMessage()` processes it
5. Calls `useSessionStore.getState().handleSpawnTerminalSession()` (line 78 of useMaestroStore.ts)
6. Terminal session spawns with correct environment variables

## Files Modified

- `maestro-ui/src/stores/initApp.ts`:
  - Added `useMaestroStore` import
  - Added WebSocket initialization in `setup()`
  - Added WebSocket cleanup in return cleanup function

## Testing

To verify the fix works:

1. Start maestro-server: `cd maestro-server && npm start`
2. Start maestro-ui: `cd maestro-ui && npm run tauri dev`
3. Open Maestro panel (right panel)
4. Create a task or select existing task
5. Click the play button (▶)
6. **Expected result:** Terminal session spawns automatically in left panel

## Related Code References

- WebSocket handler: `maestro-ui/src/stores/useMaestroStore.ts:63-101`
- Session spawn handler: `maestro-ui/src/stores/useSessionStore.ts:1155-1191`
- Server spawn endpoint: `maestro-server/src/api/sessions.ts:330-608`
- Spawn service: `maestro-ui/src/services/maestroService.ts:6-58`

---

**Fixed:** 2026-02-05
