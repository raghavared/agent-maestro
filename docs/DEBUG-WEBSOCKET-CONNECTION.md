# WebSocket Connection Debugging Guide

## Problem
Server logs show "👥 Target Clients: 0 connected" when broadcasting events, meaning the UI client is not connected to the WebSocket server.

## Diagnostic Steps

### 1. Check if Server WebSocket is Running

**Server logs should show:**
```
🚀 Maestro Server running on http://localhost:3000
   Health check: http://localhost:3000/health
✅ WebSocket server initialized
```

If you don't see "✅ WebSocket server initialized", the WebSocket server didn't start properly.

### 2. Check Client Connection Attempt

**Open browser DevTools Console (F12) and look for:**

**Success:**
```
✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
🔌 CLIENT WEBSOCKET CONNECTED
✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
🕐 Timestamp: 2026-02-05T...
🌐 URL: ws://localhost:3000
```

**Failure:**
```
❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌
🔌 CLIENT WEBSOCKET ERROR
❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌
Error: [connection error details]
```

**Disconnected:**
```
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
🔌 CLIENT WEBSOCKET DISCONNECTED
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
```

### 3. Common Issues & Solutions

#### Issue A: Server Not Running
**Check:**
```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{"status":"ok","timestamp":1738739243429,"uptime":123.45}
```

**If it fails:** Start the server:
```bash
cd maestro-server
npm start
```

#### Issue B: Wrong Port or URL
**Client URL:** `ws://localhost:3000` (defined in `maestro-ui/src/stores/useMaestroStore.ts:13`)
**Server Port:** `3000` (defined in `maestro-server/src/server.ts:7`)

**Check if server is on different port:**
```bash
# Check what's listening on port 3000
lsof -i :3000
# or
netstat -an | grep 3000
```

**If port is in use by something else:**
- Either stop the other process
- Or change the server port and update client URL

#### Issue C: CORS or WebSocket Upgrade Issues
Check server logs for any errors during WebSocket initialization.

#### Issue D: Timing Issue - Event Fired Before Client Connected
If the event is being triggered immediately on server start before the UI has time to connect:

**Server side:** Check if events are being emitted during startup
**Client side:** Check connection timing in logs

### 4. Test WebSocket Connection Manually

**Quick test script (run in browser console):**
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (err) => console.error('❌ Error:', err);
ws.onclose = () => console.log('⚠️ Disconnected');
ws.onmessage = (msg) => console.log('📥 Message:', JSON.parse(msg.data));
```

If this connects successfully, the server is fine and the issue is in the app code.

### 5. Check Server Connection Count

Add a simple endpoint to check connected clients:

**In `maestro-server/src/server.ts`, after line 30:**
```typescript
app.get('/ws-clients', (req: Request, res: Response) => {
  res.json({
    connectedClients: wss.clients.size,
    clients: Array.from(wss.clients).map((c: any) => ({
      readyState: c.readyState,
      url: c.url
    }))
  });
});
```

Then check: `curl http://localhost:3000/ws-clients`

## Quick Fix: Force Reconnection

If the connection is dropping, try adding aggressive reconnection in the client.

**Edit `maestro-ui/src/stores/useMaestroStore.ts` line 153:**
Change delay calculation from:
```typescript
const delay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);
```

To:
```typescript
const delay = 1000; // Always retry after 1 second
```

## Expected Flow

1. **Server starts:** WebSocket server initialized on port 3000
2. **UI starts:** App initialization calls `initWebSocket()`
3. **Client connects:** WebSocket connection established
4. **Server logs:** "✅ WebSocket client connected. Total clients: 1"
5. **Client logs:** "🔌 CLIENT WEBSOCKET CONNECTED"
6. **Events flow:** Server broadcasts → Client receives

## What to Report

Please check and report:
1. ✅/❌ Server shows "✅ WebSocket server initialized"
2. ✅/❌ Browser console shows "🔌 CLIENT WEBSOCKET CONNECTED"
3. ✅/❌ Server shows "✅ WebSocket client connected. Total clients: 1"
4. If ❌ on any, what error messages do you see?
