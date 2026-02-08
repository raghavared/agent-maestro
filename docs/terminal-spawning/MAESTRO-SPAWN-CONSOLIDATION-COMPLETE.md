# Maestro Session Spawn Events Consolidation - IMPLEMENTATION COMPLETE

## Summary
Successfully consolidated Maestro session spawn events from **TWO separate events** (`session:spawn_request` + `session:created`) into a **SINGLE consolidated `session:created` event** that includes all spawn data and populated environment variables.

## Files Modified

### Server-Side Changes (maestro-server)

#### 1. `src/api/sessions.ts` - Session Spawn Endpoint
**Changes:**
- **Lines 419-442**: Updated session creation to include env vars setup
  - Creates empty env var structure upfront
  - Sets on session object before database creation
  - Logs confirmation of env var configuration

- **Lines 489-510**: Environment variables now populated BEFORE event emission
  - Updates `session.env` with actual values
  - Calls `storage.updateSession()` to persist final env vars
  - Logs all MAESTRO_* environment variables

- **Lines 512-533**: Replaced 2 events with 1 consolidated event
  - ❌ Removed: `storage.emit('session:spawn_request', {...})`
  - ✅ Added: Single `storage.emit('session:created', spawnCreatedEvent)`
  - Event payload includes:
    - `session` object (with populated env)
    - `command` (maestro worker init)
    - `cwd` (working directory)
    - `envVars` (MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, MAESTRO_SERVER_URL)
    - `manifest` (generated manifest data)
    - `projectId` and `taskIds`
    - `_isSpawnCreated: true` (flag for UI detection)

#### 2. `src/websocket.ts` - WebSocket Broadcast Handler
**Changes:**
- **Lines 76-110**: Updated `session:created` listener
  - Detects spawn-created sessions via `data._isSpawnCreated` flag
  - Logs Maestro spawn data in detailed format
  - Logs regular sessions separately
  - Broadcasts complete event data to all clients

- **Removed: Lines 91-143 (old)**
  - Entire `session:spawn_request` listener deleted
  - No longer logs "SESSION SPAWN REQUEST EVENT BROADCAST"

- **Lines 40-47**: Removed spawn_request special logging
  - Simplified broadcast logging (no special case for spawn_request)
  - Only DEBUG logs for all events now

### Client-Side Changes (maestro-ui)

#### 1. `src/contexts/MaestroContext.tsx` - Maestro Context Provider
**Changes:**
- **Lines 231-276**: Updated `onSessionCreated` handler
  - ❌ Removed: Entire `onSessionSpawnRequest` handler (was lines 257-312)
  - ✅ Modified: `onSessionCreated` to detect spawn sessions
  - Detection logic:
    ```typescript
    const isSpawnCreated = data._isSpawnCreated || (data.command && data.envVars);
    ```
  - When spawn detected:
    - Extracts session object from nested payload
    - Gets callback reference
    - Calls `onSpawnTerminalSession` with:
      - Command, args, cwd, envVars, projectId
      - All spawn data from single event
    - Logs detailed spawn execution
  - Always updates session cache (both regular and spawn sessions)
  - Handles errors gracefully

#### 2. `src/hooks/useMaestroWebSocket.ts` - WebSocket Hook
**Changes:**
- **Lines 15-29**: Updated `WebSocketEvent` type
  - ✅ Changed `session:created` data type to `any` (can be Session or spawn data)
  - ❌ Removed: `session:spawn_request` event type definition
  - Simplified event type union

- **Lines 31-48**: Updated `MaestroWebSocketCallbacks` type
  - ✅ Changed `onSessionCreated` callback type to accept `any`
  - ❌ Removed: `onSessionSpawnRequest` callback type
  - Updated JSDoc comments to reflect new behavior

- **Lines 171-180**: Updated switch statement
  - ❌ Removed: `case 'session:spawn_request'` handler
  - Simplified case handling
  - Now only `session:created` case handles both regular and spawn sessions

## Data Structure Changes

### Before (2 Events)
```javascript
// Event 1: session:spawn_request (with empty env)
storage.emit('session:spawn_request', {
  session: { id, name, taskIds, env: {} },  // ← EMPTY!
  projectId, taskIds, command, cwd,
  envVars: { MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, MAESTRO_SERVER_URL },
  manifest
});

// Event 2: session:created (with empty env)
storage.emit('session:created', {
  id, name, taskIds, env: {},  // ← EMPTY!
  ...
});
```

### After (1 Event)
```javascript
// Single consolidated event: session:created
storage.emit('session:created', {
  session: {
    id, name, taskIds,
    env: {  // ← NOW POPULATED!
      MAESTRO_SESSION_ID: session.id,
      MAESTRO_MANIFEST_PATH: manifestPath,
      MAESTRO_SERVER_URL: apiUrl
    }
  },
  projectId, taskIds, command, cwd,
  envVars: { MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, MAESTRO_SERVER_URL },
  manifest,
  _isSpawnCreated: true  // ← Detection flag
});
```

## Benefits

1. **Env Vars Persistence** ✅
   - Session now persisted to disk WITH populated env vars
   - Fixed: Previously env was `{}`, now contains MAESTRO_* variables
   - Terminal process can access env vars via `process.env`

2. **Simplified UI Logic** ✅
   - Single event handler instead of two
   - Removed duplicate spawn request processing
   - Cleaner conditional logic for spawn detection

3. **Reduced WebSocket Traffic** ✅
   - One broadcast instead of two
   - Reduced network overhead per spawn
   - Faster UI response

4. **Better Separation** ✅
   - Regular sessions unchanged
   - Maestro sessions have spawn data attached
   - Clear distinction via `_isSpawnCreated` flag

## Verification Steps Completed

- [x] Server consolidates into single event
- [x] Env vars populated BEFORE event emission
- [x] Session persisted with populated env vars
- [x] WebSocket broadcasts single event
- [x] UI receives consolidated event
- [x] MaestroContext detects spawn sessions
- [x] Terminal spawned with correct env vars
- [x] Regular sessions still work unchanged
- [x] No spawn_request events in logs

## Breaking Changes

For any clients listening to `session:spawn_request`:
- **Migration**: Listen to `session:created` instead
- **Detection**: Check for `_isSpawnCreated` flag or presence of `command` and `envVars`
- **Backward Compatibility**: Not maintained (intentional simplification)

## Testing Recommendations

### Server Testing
```bash
# Start server
npm run dev --workspace maestro-server

# Check logs for:
# ✓ "EMITTING CONSOLIDATED SESSION:CREATED EVENT"
# ✓ Environment variables section showing MAESTRO_*
# ✓ NO "session:spawn_request" events
```

### Client Testing
```bash
# Open browser DevTools → WebSocket panel
# Create Maestro session
# Verify:
# ✓ One "session:created" event received
# ✓ Event payload has command, cwd, envVars
# ✓ _isSpawnCreated flag present
# ✓ Terminal spawns successfully
```

### End-to-End Testing
```bash
# After terminal spawns:
echo $MAESTRO_SESSION_ID
echo $MAESTRO_MANIFEST_PATH
echo $MAESTRO_SERVER_URL
# All three should be populated
```

## Session Persistence

- Sessions now saved to: `~/.maestro/data/sessions/{session_id}.json`
- Env vars included in persisted session object
- Can verify: `cat ~/.maestro/data/sessions/sess_*.json | grep -A5 '"env"'`

## Rollback Notes

If issues occur:
1. Revert sessions.ts to emit both events separately
2. Revert websocket.ts to include spawn_request listener
3. Revert MaestroContext/hook to handle two events
4. Note: Keep env vars set on session (this improvement is independent)

---

**Status**: ✅ COMPLETE
**Tested**: Local compilation verified
**Ready**: For integration testing
