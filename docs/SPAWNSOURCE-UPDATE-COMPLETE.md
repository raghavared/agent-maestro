# SpawnSource Standardization - Complete

## Problem
Server was running old compiled code that validated `spawnSource` as `'manual' | 'orchestrator'`, but source code and CLI were updated to use `'ui' | 'session'`.

Error received:
```
Failed to spawn session: HTTP 400: {"error":true,"code":"invalid_spawn_source","message":"spawnSource must be \"manual\" or \"orchestrator\""}
```

## Solution
Updated both source code AND compiled dist files to use the new `spawnSource` values consistently.

## Changes Made

### 1. Server Code (maestro-server)
**Files Updated:**
- `src/types.ts` - Already correct (`'ui' | 'session'`)
- `src/api/sessionRoutes.ts` - Already correct
- **Rebuilt** `dist/` folder to compile changes

**Validation Logic:**
```typescript
if (spawnSource !== 'ui' && spawnSource !== 'session') {
  return res.status(400).json({
    error: true,
    code: 'invalid_spawn_source',
    message: 'spawnSource must be "ui" or "session"'
  });
}
```

### 2. CLI Code (maestro-cli)
**Files Updated:**
- `src/commands/session.ts:241` - Already sending `spawnSource: 'session'`
- Removed `spawnReason` field (moved to `context.reason`)
- **Rebuilt** `dist/` folder

**Spawn Request:**
```typescript
const spawnRequest = {
  projectId,
  taskIds: [taskId],
  role: skill === 'maestro-orchestrator' ? 'orchestrator' : 'worker',
  spawnSource: 'session',                   // Session-initiated spawn
  sessionId: config.sessionId || undefined, // Parent session ID
  skills: [skill],
  sessionName: sessionName,
  context: {
    ...context,
    reason: cmdOpts.reason || `Execute task: ${task.title}`
  }
};
```

### 3. Spec Files
**Files Updated:**
- `spec/02-CORE-CONCEPTS.md` - Updated `SessionMetadata` interface
- `spec/03-API-SPECIFICATION.md` - Updated spawn endpoint schema and errors
- `spec/09-ERROR-HANDLING-SPECIFICATION.md` - Updated validation examples
- `spec/schemas/spawn-session-request.json` - Updated enum values
- `spec/04-WEBSOCKET-SPECIFICATION.md` - Replaced "agent" with "session"
- `spec/08-SESSION-SPAWNING-SPECIFICATION.md` - Replaced "agent" with "session"

**Updated Schema:**
```typescript
interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  role?: 'worker' | 'orchestrator';
  spawnSource?: 'ui' | 'session';      // NEW: 'ui' (user) or 'session' (agent)
  sessionId?: string;                   // Required when spawnSource === 'session'
  sessionName?: string;
  skills?: string[];
  context?: Record<string, any>;
}
```

## SpawnSource Values

| Value | Description | Initiated By |
|-------|-------------|--------------|
| `'ui'` | User-initiated spawn from UI | Human user clicking "Spawn" button |
| `'session'` | Agent-initiated spawn | Claude agent running `maestro session spawn` command |

## Flow Documentation

### Unified Spawn Flow (Both UI and Session)
1. Client calls `POST /api/sessions/spawn` with `spawnSource: 'ui' | 'session'`
2. Server validates request (including `sessionId` if `spawnSource === 'session'`)
3. Server creates session with `status: 'spawning'`
4. Server generates manifest via CLI
5. Server emits `session:spawn` WebSocket event **for BOTH sources**
6. UI receives event and spawns terminal automatically
7. Terminal runs `maestro worker init` or `maestro orchestrator init`

**Key Point:** Both UI and agent spawns use the same flow, only differing by the `spawnSource` field value.

## Verification

Run these commands to verify:

```bash
# Rebuild server
cd maestro-server && npm run build

# Rebuild CLI
cd maestro-cli && npm run build

# Check dist validation
grep -A2 "invalid_spawn_source" maestro-server/dist/api/sessionRoutes.js
# Should output: 'spawnSource must be "ui" or "session"'

# Check CLI spawn request
grep -A5 "spawnSource:" maestro-cli/dist/commands/session.js
# Should output: spawnSource: 'session'
```

## Status
✅ Server rebuilt with correct validation
✅ CLI rebuilt with correct spawnSource
✅ Spec files updated to reflect 'ui' | 'session'
✅ All references to 'manual' | 'orchestrator' replaced
✅ Error should be resolved

## Next Steps
Restart the maestro-server if it's currently running to pick up the new compiled code.
