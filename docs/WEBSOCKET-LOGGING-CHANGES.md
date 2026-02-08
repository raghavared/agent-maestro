# WebSocket Logging Changes Summary

## Files Modified

### 1. `maestro-server/src/websocket.ts`

#### Changes Made:
- ✅ Added `HIGH_FREQUENCY_EVENTS` Set to exclude noisy events
- ✅ Enhanced `broadcast()` function with comprehensive logging
- ✅ Removed duplicate specialized logging for `session:spawn`
- ✅ Removed duplicate specialized logging for `session:created`

#### Before & After:

**Before:**
```typescript
function broadcast(event: string, data: any) {
  const message = JSON.stringify({ type: event, event, data });
  // ... send to clients ...

  if (process.env.DEBUG) {
    console.log(`📡 Broadcast to ${sent}/${clients.size} clients: ${event}`);
  }
}
```

**After:**
```typescript
const HIGH_FREQUENCY_EVENTS = new Set(['heartbeat', 'ping', 'pong', ...]);

function broadcast(event: string, data: any) {
  const timestamp = new Date().toISOString();
  const shouldLogDetails = !HIGH_FREQUENCY_EVENTS.has(event);

  if (shouldLogDetails) {
    console.log('\n' + '━'.repeat(80));
    console.log(`📤 SERVER EVENT SENT`);
    console.log('━'.repeat(80));
    console.log(`🕐 Timestamp: ${timestamp}`);
    console.log(`📡 Event Type: ${event}`);
    console.log(`👥 Target Clients: ${clients.size} connected`);
    console.log('\n📦 Event Payload:');
    console.log(JSON.stringify(data, null, 2));
    console.log('━'.repeat(80) + '\n');
  }

  // ... send to clients ...

  if (shouldLogDetails) {
    console.log(`✅ Broadcast complete: ${sent}/${clients.size} clients (${duration}ms)\n`);
  }
}
```

---

### 2. `maestro-ui/src/stores/useMaestroStore.ts`

#### Changes Made:
- ✅ Added `HIGH_FREQUENCY_EVENTS` Set to exclude noisy events
- ✅ Enhanced `handleMessage()` function with comprehensive logging
- ✅ Enhanced connection state logging (onopen, onerror, onclose)
- ✅ Enhanced error handling with detailed logging
- ✅ Removed duplicate logging for `session:created`
- ✅ Removed duplicate verbose logging for `session:spawn`

#### Before & After:

**handleMessage() - Before:**
```typescript
const handleMessage = (event: MessageEvent) => {
  try {
    const message = JSON.parse(event.data);
    console.log('[useMaestroStore.handleMessage] Received WebSocket message:', message.event, message.data);
    switch (message.event) {
      // ... event handlers ...
    }
  } catch (err) {
    console.error('[useMaestroStore.handleMessage] Error parsing WebSocket message:', err);
  }
};
```

**handleMessage() - After:**
```typescript
const HIGH_FREQUENCY_EVENTS = new Set(['heartbeat', 'ping', 'pong', ...]);

const handleMessage = (event: MessageEvent) => {
  try {
    const message = JSON.parse(event.data);
    const timestamp = new Date().toISOString();
    const shouldLogDetails = !HIGH_FREQUENCY_EVENTS.has(message.event);

    if (shouldLogDetails) {
      console.log('\n' + '━'.repeat(80));
      console.log(`📥 CLIENT EVENT RECEIVED`);
      console.log('━'.repeat(80));
      console.log(`🕐 Timestamp: ${timestamp}`);
      console.log(`📡 Event Type: ${message.event}`);
      console.log('\n📦 Event Payload:');
      console.log(JSON.stringify(message.data, null, 2));
      console.log('━'.repeat(80) + '\n');
    }

    switch (message.event) {
      // ... event handlers ...
    }
  } catch (err) {
    console.error('\n' + '⚠️'.repeat(40));
    console.error('❌ CLIENT ERROR: Failed to handle WebSocket message');
    console.error('⚠️'.repeat(40));
    console.error('Error:', err);
    console.error('Raw event data:', event.data);
    console.error('⚠️'.repeat(40) + '\n');
  }
};
```

**Connection Logging - Before:**
```typescript
ws.onopen = () => {
  console.log('[useMaestroStore] WebSocket connected to', WS_URL);
  // ...
};

ws.onerror = (err) => {
  console.error('[useMaestroStore] WebSocket error:', err);
};

ws.onclose = () => {
  console.log('[useMaestroStore] WebSocket disconnected');
  // ...
};
```

**Connection Logging - After:**
```typescript
ws.onopen = () => {
  const timestamp = new Date().toISOString();
  console.log('\n' + '✅'.repeat(40));
  console.log(`🔌 CLIENT WEBSOCKET CONNECTED`);
  console.log('✅'.repeat(40));
  console.log(`🕐 Timestamp: ${timestamp}`);
  console.log(`🌐 URL: ${WS_URL}`);
  console.log(`🔄 Reconnect attempts: ${globalReconnectAttempts}`);
  console.log('✅'.repeat(40) + '\n');
  // ...
};

ws.onerror = (err) => {
  const timestamp = new Date().toISOString();
  console.error('\n' + '❌'.repeat(40));
  console.error(`🔌 CLIENT WEBSOCKET ERROR`);
  console.error('❌'.repeat(40));
  console.error(`🕐 Timestamp: ${timestamp}`);
  console.error('Error:', err);
  console.error('❌'.repeat(40) + '\n');
};

ws.onclose = () => {
  const timestamp = new Date().toISOString();
  const delay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);
  console.log('\n' + '⚠️'.repeat(40));
  console.log(`🔌 CLIENT WEBSOCKET DISCONNECTED`);
  console.log('⚠️'.repeat(40));
  console.log(`🕐 Timestamp: ${timestamp}`);
  console.log(`🌐 URL: ${WS_URL}`);
  console.log(`🔄 Reconnect attempts: ${globalReconnectAttempts}`);
  console.log(`⏱️  Reconnecting in: ${delay}ms`);
  console.log('⚠️'.repeat(40) + '\n');
  // ...
};
```

## Key Improvements

### 1. **Unified Logging Format**
- Consistent format across server and client
- Clear visual separators using box-drawing characters
- Emoji icons for quick visual identification

### 2. **Complete Information**
- Full ISO 8601 timestamps
- Complete event payload (formatted JSON)
- Connection state information
- Performance metrics (server broadcast duration)

### 3. **Noise Reduction**
- High-frequency events excluded from detailed logs
- Easily configurable exclusion list
- Production-ready (no debug flags needed)

### 4. **Better Error Handling**
- Enhanced error messages with full context
- Raw event data included for debugging
- Visual indicators for errors

### 5. **Code Cleanup**
- Removed duplicate specialized logging
- Simplified event handlers
- Consistent logging approach throughout

## Quick Test

### Start Both Services:
```bash
# Terminal 1 - Start server
cd maestro-server
npm start

# Terminal 2 - Start UI
cd maestro-ui
npm run tauri dev
```

### Trigger an Event:
1. In the UI, create a new task
2. Watch server console - see "📤 SERVER EVENT SENT" log
3. Watch browser console - see "📥 CLIENT EVENT RECEIVED" log

### Expected Output:

**Server Console:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 SERVER EVENT SENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐 Timestamp: 2026-02-05T10:30:45.123Z
📡 Event Type: task:created
👥 Target Clients: 1 connected

📦 Event Payload:
{
  "id": "task-abc123",
  "name": "My New Task",
  ...
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Broadcast complete: 1/1 clients (2ms)
```

**Browser Console:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 CLIENT EVENT RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐 Timestamp: 2026-02-05T10:30:45.125Z
📡 Event Type: task:created

📦 Event Payload:
{
  "id": "task-abc123",
  "name": "My New Task",
  ...
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Configuration

### To Add/Remove Excluded Events:

**Server (`maestro-server/src/websocket.ts`):**
```typescript
const HIGH_FREQUENCY_EVENTS = new Set([
  'heartbeat',
  'ping',
  'pong',
  'status:ping',
  'keepalive',
  // Add more events here to exclude them
]);
```

**Client (`maestro-ui/src/stores/useMaestroStore.ts`):**
```typescript
const HIGH_FREQUENCY_EVENTS = new Set([
  'heartbeat',
  'ping',
  'pong',
  'status:ping',
  'keepalive',
  // Add more events here to exclude them
]);
```

## No Breaking Changes
✅ All existing functionality preserved
✅ TypeScript compilation passes
✅ No API changes
✅ Backward compatible
