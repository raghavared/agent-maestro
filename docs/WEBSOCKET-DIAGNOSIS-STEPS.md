# WebSocket Connection Diagnosis - Quick Steps

## The Problem
Your server shows **"👥 Target Clients: 0 connected"** when broadcasting events, meaning the UI client is not connected.

## Quick Diagnosis (Do These Now)

### Step 1: Check Server Logs
When you start the maestro-server, you should see:
```
🚀 Maestro Server running on http://localhost:3000
   Health check: http://localhost:3000/health
   WebSocket status: http://localhost:3000/ws-status
✅ WebSocket server initialized
```

### Step 2: Check WebSocket Status Endpoint
Open a new terminal and run:
```bash
curl http://localhost:3000/ws-status
```

**Expected output if clients are connected:**
```json
{
  "connectedClients": 1,
  "clients": [
    {
      "readyState": 1,
      "readyStateText": "OPEN"
    }
  ]
}
```

**If you see `"connectedClients": 0`:**
```json
{
  "connectedClients": 0,
  "clients": []
}
```
This confirms no clients are connected. Continue to Step 3.

### Step 3: Check Browser Console
1. Open the Maestro UI in your browser
2. Press F12 to open DevTools
3. Go to Console tab
4. Look for these logs:

**✅ SUCCESS - You should see:**
```
🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
🔌 CLIENT WEBSOCKET CONNECTED
🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
🕐 Timestamp: ...
🌐 URL: ws://localhost:3000
```

**❌ FAILURE - You might see:**
```
❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌
🔌 CLIENT WEBSOCKET ERROR
❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌
Error: [details here]
```

Or:
```
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
🔌 CLIENT WEBSOCKET DISCONNECTED
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
```

### Step 4: Check Server Connection Logs
When the UI connects, the server should show:
```
🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
🔌 WEBSOCKET CLIENT CONNECTED
🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
🕐 Timestamp: ...
👥 Total Clients: 1
🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
```

## Common Issues & Solutions

### Issue 1: Server Not Running
**Symptom:** `curl http://localhost:3000/ws-status` fails with "Connection refused"

**Solution:**
```bash
cd maestro-server
npm start
```

### Issue 2: UI Not Starting initWebSocket
**Symptom:** No connection logs at all in browser console

**Check:** Is the UI actually running?
```bash
cd maestro-ui
npm run tauri dev
```

**Manual test in browser console:**
```javascript
// Manually trigger connection
useMaestroStore.getState().initWebSocket();
```

### Issue 3: Port Mismatch
**Symptom:** Connection refused or wrong endpoint

**Check server port:**
```bash
# Server should be on port 3000
grep -n "PORT" maestro-server/src/server.ts
```

**Check client URL:**
```bash
# Client should connect to ws://localhost:3000
grep -n "WS_URL" maestro-ui/src/stores/useMaestroStore.ts
```

### Issue 4: Timing Issue (Event Fires Before Connection)
**Symptom:**
- Browser shows "CLIENT WEBSOCKET CONNECTED"
- Server shows "WEBSOCKET CLIENT CONNECTED"
- But server still broadcasts to "0 connected" clients

**This means:** The event is being triggered BEFORE the client connects.

**Check:** When is the event being fired? Is it during server startup?

### Issue 5: Connection Established Then Immediately Drops
**Symptom:**
- Server shows "CLIENT CONNECTED" then immediately "CLIENT DISCONNECTED"
- Browser shows "CONNECTED" then immediately "DISCONNECTED"

**Possible causes:**
- Network issue
- CORS issue
- WebSocket upgrade failed
- Server error

**Check server logs for errors between connect/disconnect**

## Test Connection Flow

### 1. Start Fresh
```bash
# Terminal 1 - Start server
cd maestro-server
npm start

# Terminal 2 - Start UI
cd maestro-ui
npm run tauri dev
```

### 2. Watch Logs
**Server Terminal Should Show:**
1. "🚀 Maestro Server running..."
2. "✅ WebSocket server initialized"
3. "🟢 WEBSOCKET CLIENT CONNECTED" (when UI connects)

**Browser Console Should Show:**
1. "🔌 CLIENT WEBSOCKET CONNECTED"

### 3. Verify Connection
```bash
# Terminal 3 - Check status
curl http://localhost:3000/ws-status
```

Should show:
```json
{"connectedClients": 1, "clients": [{"readyState": 1, "readyStateText": "OPEN"}]}
```

### 4. Trigger an Event
In the UI, try to create a task or session. Watch both:
- **Server logs:** Should show "📤 SERVER EVENT SENT" with clients > 0
- **Browser console:** Should show "📥 CLIENT EVENT RECEIVED"

## Next Steps

Based on your findings, report back:

1. **What does `curl http://localhost:3000/ws-status` show?**
2. **Does browser console show "CLIENT WEBSOCKET CONNECTED"?**
3. **Does server show "WEBSOCKET CLIENT CONNECTED"?**
4. **What's the timing?** Is the event being broadcast before connection?

This will help identify the exact issue!
