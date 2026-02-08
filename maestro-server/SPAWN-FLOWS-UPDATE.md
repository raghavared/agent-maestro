# Session Spawning Flows - Specification Update

**Date:** 2026-02-04
**Status:** ✅ Updated

---

## Changes Made

Updated specifications to correctly document TWO distinct session spawning flows based on user clarification.

---

## Flow 1: UI-Initiated Manual Spawning

### Request
```javascript
POST /api/sessions/spawn
{
  projectId: "proj_123",
  taskIds: ["task_456"],
  spawnSource: "ui",  // ← KEY: Indicates UI-initiated
  sessionName: "My Worker",
  role: "worker",
  skills: ["maestro-worker"]
}
```

### Server Behavior
1. ✅ Create session in DB (optimistic, status: "spawning")
2. ✅ Generate manifest via CLI
3. ✅ **HTTP Response ONLY** (no WebSocket event)
4. ❌ NO WebSocket event emitted

### Response
```javascript
{
  sessionId: "sess_789",
  manifestPath: "~/.maestro/sessions/sess_789/manifest.json",
  envVars: {
    MAESTRO_SESSION_ID: "sess_789",
    MAESTRO_MANIFEST_PATH: "~/.maestro/sessions/sess_789/manifest.json",
    MAESTRO_SERVER_URL: "http://localhost:3000"
  },
  initialCommand: "maestro worker init",
  session: { /* full session object */ }
}
```

### UI Behavior
- Receives HTTP response
- Spawns terminal locally using response data
- Sets env vars and runs command

---

## Flow 2: Agent-Initiated Spawning

### Request
```javascript
POST /api/sessions/spawn
{
  projectId: "proj_123",
  taskIds: ["task_456"],
  spawnSource: "agent",  // ← KEY: Indicates agent-initiated
  spawnedBy: "sess_parent_123",  // Parent session ID
  role: "worker",
  skills: ["maestro-worker"]
}
```

### Server Behavior
1. ✅ Create session in DB (optimistic, status: "spawning")
2. ✅ Generate manifest via CLI
3. ✅ Emit WebSocket event: `session:spawn`
4. ✅ Also return HTTP response (for CLI tracking)

### WebSocket Event
```javascript
{
  type: "session:spawn",
  event: "session:spawn",
  data: {
    session: { /* full session object */ },
    manifestPath: "~/.maestro/sessions/sess_789/manifest.json",
    envVars: {
      MAESTRO_SESSION_ID: "sess_789",
      MAESTRO_MANIFEST_PATH: "~/.maestro/sessions/sess_789/manifest.json",
      MAESTRO_SERVER_URL: "http://localhost:3000"
    },
    initialCommand: "maestro worker init",
    command: "maestro worker init",
    cwd: "/Users/john/Projects/my-app",
    manifest: { /* full manifest object */ },
    projectId: "proj_123",
    taskIds: ["task_456"]
  }
}
```

### UI Behavior
- Receives WebSocket `session:spawn` event
- **Automatically spawns terminal** (no user interaction)
- Sets env vars and runs command

---

## Key Differences

| Aspect | UI-Initiated (spawnSource: "ui") | Agent-Initiated (spawnSource: "agent") |
|--------|----------------------------------|----------------------------------------|
| **Trigger** | User clicks button in UI | Agent runs `maestro session spawn` CLI |
| **Request Field** | `spawnSource: "ui"` | `spawnSource: "agent"` |
| **Session Creation** | ✅ Immediate (optimistic) | ✅ Immediate (optimistic) |
| **Manifest Generation** | ✅ Via CLI | ✅ Via CLI |
| **HTTP Response** | ✅ Full spawn data | ✅ Full spawn data |
| **WebSocket Event** | ❌ NO event emitted | ✅ `session:spawn` event |
| **UI Spawning** | Manual (from HTTP response) | Automatic (from WebSocket event) |

---

## Updated Files

### 1. spec/08-SESSION-SPAWNING-SPECIFICATION.md
✅ Completely rewritten to document both flows
- Architecture diagrams for both flows
- Sequence diagrams for both flows
- Request/response examples for both
- Clear distinction based on `spawnSource` field

### 2. spec/04-WEBSOCKET-SPECIFICATION.md
✅ Added new `session:spawn` event
- Only emitted when `spawnSource: "agent"`
- Complete payload documentation
- UI handling instructions
- Distinction from `session:created`

### 3. spec/03-API-SPECIFICATION.md
✅ Updated POST /api/sessions/spawn endpoint
- Documents `spawnSource` field usage
- Shows different behaviors for "ui" vs "agent"
- Side effects clearly documented
- Examples for both flows

---

## Implementation Requirements

### Server Changes Needed
1. Check `spawnSource` field in request
2. If `spawnSource === "agent"`:
   - Emit `session:spawn` WebSocket event after manifest generation
3. If `spawnSource === "ui"`:
   - Do NOT emit any WebSocket event
   - Just return HTTP response

### UI Changes Needed
1. For manual spawning:
   - Send `spawnSource: "ui"` in request
   - Handle HTTP response
   - Spawn terminal locally
2. For auto-spawning:
   - Listen for `session:spawn` WebSocket event
   - Automatically spawn terminal when event received
   - No user interaction needed

---

## Validation

### Test Case 1: UI-Initiated Spawn
```bash
# Request
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "taskIds": ["task_456"],
    "spawnSource": "ui",
    "role": "worker"
  }'

# Expected:
# ✅ HTTP 201 response with spawn data
# ❌ NO WebSocket event emitted
# ✅ Session created in DB
```

### Test Case 2: Agent-Initiated Spawn
```bash
# Request (from CLI)
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "taskIds": ["task_456"],
    "spawnSource": "agent",
    "spawnedBy": "sess_parent_123",
    "role": "worker"
  }'

# Expected:
# ✅ HTTP 201 response with spawn data
# ✅ WebSocket event "session:spawn" emitted to all clients
# ✅ Session created in DB
```

---

## Migration Notes

If current implementation emits WebSocket event for all spawns:
1. Add `spawnSource` check before emitting event
2. Only emit `session:spawn` when `spawnSource === "agent"`
3. UI code already handles HTTP response, so no breaking change
4. New agent-spawning feature can be added incrementally

---

**Status:** Specifications updated and ready for implementation
**Next:** Update server code to implement conditional WebSocket emission
