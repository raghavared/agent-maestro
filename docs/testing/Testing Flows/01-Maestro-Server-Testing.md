# 01 - Maestro Server Testing

**Goal:** Verify that the Maestro Server starts correctly, handles API requests, and manages WebSocket connections reliably.

## Prerequisites
- Terminal open at `maestro-server/` directory.

## Test Flows

### 1. Server Startup & Health
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Run `npm run dev` in `maestro-server/` | Server starts on port 3000 (or configured port). Log shows "Server listening". | |
| 1.2 | Navigate to `http://localhost:3000/health` in browser | JSON response: `{"status": "ok", "services": {...}}` | |
| 1.3 | Check logs for errors | No stack traces or error logs on startup. | |

### 2. API Endpoints (Basic)
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | `curl http://localhost:3000/api/tasks?projectId=test-p1` | JSON response with an array (empty or populated). Status 200. | |
| 2.2 | `curl http://localhost:3000/api/sessions?projectId=test-p1` | JSON response with an array. Status 200. | |
| 2.3 | Request a non-existent route `GET /api/unknown` | JSON response with 404 error. | |

### 3. WebSocket Connectivity
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | Connect a WebSocket client (or open App UI) | Log shows "✅ WebSocket client connected". | |
| 3.2 | Disconnect the client | Log shows "❌ WebSocket client disconnected". | |
| 3.3 | Stop the server (`Ctrl+C`) while client is connected | Client should detect disconnection (test via UI indicator in Module 05). | |

### 4. Database Persistence (InMemory/File)
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | Create a task via API (using curl or Postman) | Task ID is returned. Status 201. | |
| 4.2 | Restart the server | Server restarts successfully. | |
| 4.3 | Query the task created in 4.1 | **If persistence is enabled:** Task exists. **If in-memory:** Task might be gone (verify implementation expectation). | |

## Success Criteria
- [ ] Server starts without errors.
- [ ] Health endpoint returns 200 OK.
- [ ] Core API endpoints return valid JSON.
- [ ] WebSockets accept and release connections.
