# WebSocket Connection Issues

Maestro uses WebSockets for real-time communication between the server, UI, and CLI. This page covers common WebSocket problems and how to debug them.

---

## UI Not Updating in Real Time

**Symptom:** You spawn sessions or update tasks via CLI, but the desktop app doesn't reflect changes until you refresh.

**Cause:** The WebSocket connection between the UI and server is broken or was never established.

**Solution:**

1. **Check the server is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check WebSocket status:**
   ```bash
   curl http://localhost:3000/ws-status
   ```

3. **Verify the UI is connecting to the right port:**
   The server defaults to port `3000`. If you changed the port via the `PORT` env var, the UI must know about it. Check `~/.maestro/config`:
   ```bash
   cat ~/.maestro/config
   # Should contain: MAESTRO_API_URL=http://localhost:<your-port>
   ```

4. **Restart the UI:**
   Close and reopen the Maestro desktop app. It re-establishes the WebSocket on launch.

**Prevention:** Don't change the server port without updating the config. Keep the server running before opening the UI.

---

## Session Watch Hangs

**Error:**
```bash
maestro session watch <session-id>
# Hangs indefinitely with no output
```

**Cause:** The CLI can't connect to the server's WebSocket endpoint, or the session ID doesn't exist.

**Solution:**
```bash
# Verify the server is reachable
curl http://localhost:3000/health

# Check MAESTRO_API_URL
echo $MAESTRO_API_URL
# Should be http://localhost:3000 (or your custom URL)

# Verify the session exists
maestro session info <session-id>

# Try with a timeout
maestro session watch <session-id> --timeout 30
```

If `MAESTRO_API_URL` is unset or wrong:
```bash
export MAESTRO_API_URL=http://localhost:3000
maestro session watch <session-id>
```

**Prevention:** Ensure `MAESTRO_API_URL` is set in `~/.maestro/config` or your environment. The CLI reads it from `~/.maestro/config` automatically.

---

## Debugging WebSocket Connections

When troubleshooting WebSocket issues, use browser DevTools for the desktop app or direct HTTP checks for the server.

### Browser DevTools (Desktop App)

The Maestro desktop app is a Tauri/web app, so you can open DevTools:

1. In the Maestro desktop app, use `Cmd+Option+I` (macOS) to open DevTools
2. Go to the **Network** tab
3. Filter by **WS** (WebSocket)
4. Look for the WebSocket connection to `localhost:3000`
5. Click on it to see:
   - **Messages tab** — all sent/received WebSocket frames
   - **Headers** — connection upgrade details

**What to look for:**
- If there's no WS connection → server isn't running or wrong port
- If the connection shows `101 Switching Protocols` → connection is healthy
- If messages aren't flowing → check subscriptions (the client must subscribe to events)

### Server-Side Checks

```bash
# Check WebSocket bridge status
curl http://localhost:3000/ws-status

# Check server health
curl http://localhost:3000/health

# Watch server logs for WS errors (in dev mode)
# Look for: "WebSocket client error" or "Failed to parse WebSocket message"
```

### CLI-Side Checks

```bash
# Test if the CLI can reach the API
maestro status

# If offline, you'll see:
# "Server not reachable" or connection errors

# Verify the full config chain
maestro whoami --json
```

---

## WebSocket Messages Not Delivering

**Symptom:** Sessions send events but the UI or other sessions don't receive them.

**Cause:** The WebSocket bridge uses a subscription model — clients must subscribe to specific event types. If a client isn't subscribed to an event, it won't receive it.

**Solution:**

The server broadcasts these key event types:
- `session:created` — new session spawned
- `session:updated` — session status change
- `session:events` — new session event (timeline)
- `task:updated` — task status change

If the UI isn't receiving updates:
1. Close and reopen the app (forces re-subscription)
2. Check that the server didn't restart (clients lose subscriptions on server restart)

**Prevention:** This is handled automatically by the UI. If you're building a custom client, ensure you send a subscribe message after connecting:
```json
{
  "type": "subscribe",
  "events": ["session:created", "session:updated", "task:updated"]
}
```

---

## Connection Drops Under Load

**Symptom:** WebSocket disconnects when many sessions are active simultaneously.

**Cause:** Too many concurrent WebSocket messages or the server is CPU-starved.

**Solution:**
```bash
# Check system resources
top -l 1 | head -10

# Check how many sessions are active
maestro session list --status working --json | jq length

# Restart the server to clear stale connections
# Stop the server (Ctrl+C or kill), then restart
maestro-server
```

**Prevention:** Monitor system resources when running many sessions. Each session involves a separate agent process (Claude, Codex, etc.) which can be resource-intensive.
