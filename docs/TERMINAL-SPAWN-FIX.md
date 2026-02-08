# Terminal Spawn Fix - Summary

## Problem
When starting a session from the Maestro UI, the terminal was not being created despite the WebSocket event being received successfully.

## Root Cause
The deduplication mechanism in `handleSpawnTerminalSession` was blocking terminal creation:

1. **Wrong deduplication key**: Used `projectId:sessionName` which blocked multiple sessions with the same name (e.g., multiple sessions for the same task)
2. **Missing cleanup**: No cleanup in error case, causing stale entries to persist
3. **Silent blocking**: No logging when deduplication blocked a spawn attempt

## Fix Applied

### 1. Updated Deduplication Logic
- **Before**: `const dedupKey = \`\${sessionInfo.projectId}:\${sessionInfo.name}\``
- **After**: `const dedupKey = sessionInfo.maestroSessionId`

Now uses the unique `maestroSessionId` from the server, allowing multiple sessions for the same task.

### 2. Added Comprehensive Logging
Added detailed logs to `handleSpawnTerminalSession`:
- Logs when deduplication blocks a spawn
- Shows active spawning keys for debugging
- Logs maestroSessionId and environment variables
- Tracks the full spawn lifecycle

### 3. Fixed Cleanup
- Added cleanup in error case to prevent stale entries
- Cleanup now happens in both success and error paths

### 4. Passed maestroSessionId Through the Stack
- Updated WebSocket handler to pass `maestroSessionId`
- Updated `handleSpawnTerminalSession` signature to accept it
- Store `maestroSessionId` on the terminal session for tracking

## Changes Made

### Files Modified:
1. **maestro-ui/src/stores/useMaestroStore.ts** (line 98)
   - Pass `maestroSessionId` to `handleSpawnTerminalSession`

2. **maestro-ui/src/stores/useSessionStore.ts** (lines 131-138, 1155-1195)
   - Updated function signature to accept `maestroSessionId`
   - Changed deduplication key to use `maestroSessionId`
   - Added comprehensive logging
   - Added cleanup in error case
   - Store `maestroSessionId` on terminal session

## Testing Instructions

### 1. Clear Stale State
Since `spawningSessionsRef` is a module-level variable, you need to clear it:

**Option A: Hard Refresh (Development)**
```bash
# Stop the dev server
# Clear browser cache or do a hard refresh (Cmd+Shift+R on Mac)
# Restart dev server
cd maestro-ui
npm run dev
```

**Option B: Rebuild (Production)**
```bash
cd maestro-ui
npm run build
npm run tauri build
```

### 2. Test the Flow
1. Open the Maestro UI
2. Start a task by clicking "Work on Task"
3. Check the browser console for detailed logs:
   - Should see `[useMaestroStore] session:spawn event received!`
   - Should see `[handleSpawnTerminalSession] Called with: ...`
   - Should see `[handleSpawnTerminalSession] ✓ Terminal session added to store:`
   - Terminal should appear in the left panel

### 3. Expected Console Output
```
[useMaestroStore] ========================================
[useMaestroStore] session:spawn event received!
[useMaestroStore] Session: sess_xxx
[useMaestroStore] Command: maestro worker init
[useMaestroStore] CWD: /path/to/project
[useMaestroStore] EnvVars: { MAESTRO_SESSION_ID: "sess_xxx", ... }
[useMaestroStore] Calling handleSpawnTerminalSession...
[handleSpawnTerminalSession] ========================================
[handleSpawnTerminalSession] Called with: { maestroSessionId: "sess_xxx", ... }
[handleSpawnTerminalSession] Dedup key: sess_xxx
[handleSpawnTerminalSession] ✓ Added to spawning set
[handleSpawnTerminalSession] Invoking create_session with env_vars: {...}
[handleSpawnTerminalSession] ✓ create_session returned: {...}
[handleSpawnTerminalSession] ✓ Terminal session added to store: terminal_xxx
[handleSpawnTerminalSession] ✓ Linked to maestroSessionId: sess_xxx
[handleSpawnTerminalSession] ========================================
```

## Verification
- ✅ TypeScript compilation passes (`npx tsc --noEmit`)
- ✅ Deduplication now uses unique session IDs
- ✅ Comprehensive logging added for debugging
- ✅ Cleanup happens in both success and error cases
- ✅ maestroSessionId properly linked to terminal sessions

## Next Steps
1. Clear stale state (hard refresh or rebuild)
2. Test the spawn flow
3. If terminal still doesn't appear, check console logs for the specific error
4. The new logging should show exactly where the flow breaks
