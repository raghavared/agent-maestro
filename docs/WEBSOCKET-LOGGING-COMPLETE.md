# WebSocket Event Logging Implementation

## Overview
Comprehensive logging has been added for all WebSocket communication between Maestro Server and Maestro UI client.

## Implementation Summary

### Server-Side Logging (`maestro-server/src/websocket.ts`)

**Location:** Enhanced `broadcast()` function (lines 22-65)

**Features:**
- ✅ Logs every outgoing WebSocket event with timestamp
- ✅ Full event payload displayed (formatted JSON)
- ✅ Shows number of connected clients
- ✅ Tracks broadcast duration (performance metric)
- ✅ Excludes high-frequency events to reduce noise
- ✅ Always enabled (no environment variable needed)

**Log Format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 SERVER EVENT SENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐 Timestamp: 2026-02-05T10:30:45.123Z
📡 Event Type: task:created
👥 Target Clients: 2 connected

📦 Event Payload:
{
  "id": "task-123",
  "name": "Example Task",
  "status": "active",
  ...
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Broadcast complete: 2/2 clients (3ms)
```

### Client-Side Logging (`maestro-ui/src/stores/useMaestroStore.ts`)

**Location:** Enhanced `handleMessage()` function (lines 68-101)

**Features:**
- ✅ Logs every incoming WebSocket event with timestamp
- ✅ Full event payload displayed (formatted JSON)
- ✅ Enhanced error logging with full context
- ✅ Connection state logging (connect/disconnect/error)
- ✅ Excludes high-frequency events to reduce noise
- ✅ Always enabled (no environment variable needed)

**Log Format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 CLIENT EVENT RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐 Timestamp: 2026-02-05T10:30:45.125Z
📡 Event Type: task:created

📦 Event Payload:
{
  "id": "task-123",
  "name": "Example Task",
  "status": "active",
  ...
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Connection Logs:**
```
✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
🔌 CLIENT WEBSOCKET CONNECTED
✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
🕐 Timestamp: 2026-02-05T10:30:45.000Z
🌐 URL: ws://localhost:3000
🔄 Reconnect attempts: 0
✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
```

## High-Frequency Event Exclusions

The following events are excluded from detailed logging to reduce console noise:
- `heartbeat`
- `ping`
- `pong`
- `status:ping`
- `keepalive`

**To modify the exclusion list:**
- Server: Edit `HIGH_FREQUENCY_EVENTS` Set in `maestro-server/src/websocket.ts:26`
- Client: Edit `HIGH_FREQUENCY_EVENTS` Set in `maestro-ui/src/stores/useMaestroStore.ts:48`

## Events Being Logged

### Task Events
- `task:created` - New task created
- `task:updated` - Task modified
- `task:deleted` - Task removed
- `task:session_added` - Session linked to task
- `task:session_removed` - Session unlinked from task

### Session Events
- `session:created` - New session created
- `session:updated` - Session modified
- `session:deleted` - Session removed
- `session:spawn` - Terminal spawning event
- `session:task_added` - Task linked to session
- `session:task_removed` - Task unlinked from session

### Project Events
- `project:created` - New project created
- `project:updated` - Project modified
- `project:deleted` - Project removed

## Clean-up Performed

### Removed Duplicate Logging
1. **Server-side:**
   - Removed specialized logging for `session:spawn` event (lines 113-139)
   - Removed specialized logging for `session:created` event (lines 76-110)
   - Now all events use the unified `broadcast()` logging

2. **Client-side:**
   - Removed duplicate console.log for `session:created` (line 77)
   - Removed verbose logging block for `session:spawn` (lines 88-108)
   - Now all events use the unified `handleMessage()` logging

## Testing

### To Test Server Logging:
1. Start the Maestro server: `npm start` (in maestro-server directory)
2. Trigger any action (create task, create session, etc.)
3. Check server console for formatted event logs

### To Test Client Logging:
1. Start the Maestro UI: `npm run tauri dev` (in maestro-ui directory)
2. Open browser DevTools console (F12)
3. Perform any action in the UI
4. Check console for formatted event logs

## Benefits

1. **Full Visibility:** Complete audit trail of all WebSocket communication
2. **Easy Debugging:** Quickly identify what events are being sent/received
3. **Data Inspection:** Full payload visibility helps debug data issues
4. **Performance Tracking:** Server logs include broadcast duration
5. **Connection Monitoring:** Clear logs for connection state changes
6. **Noise Reduction:** High-frequency events excluded from detailed logs
7. **Always Available:** No need to enable debug flags

## Future Enhancements (Optional)

If needed in the future, you could add:
- Log levels (ERROR, WARN, INFO, DEBUG)
- Log file output (in addition to console)
- Structured JSON logging for production
- Event filtering by type or pattern
- Performance metrics (latency, throughput)
- Event history/replay capability
