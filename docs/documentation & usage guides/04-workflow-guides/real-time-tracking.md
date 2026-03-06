# Track Progress in Real Time

**Scenario:** Claude is working. You want to see what's happening — progress updates, blockers, completions — as they happen.

---

## Prerequisites

- Active sessions running in your project

## From Claude's Side: Reporting Progress

When Claude works on a task, it reports milestones using built-in commands:

### Report progress

```bash
maestro report progress "Finished building the login form, now adding validation"
```

Creates a timeline event visible in the UI and via `session watch`.

### Report blocked

```bash
maestro report blocked "Missing API_KEY environment variable — cannot test OAuth flow"
```

Flags the session as blocked. You'll see an alert in the UI.

### Report completion

```bash
maestro report complete "Login page implemented with form validation, OAuth, and error handling"
```

Marks the session as completed and posts a summary.

### Report error

```bash
maestro report error "Build failed: TypeScript compilation errors in src/auth/provider.ts"
```

Flags an error in the session timeline.

### Task-level reporting

Claude can also report at the task level (useful when a session works on multiple tasks):

```bash
maestro task report progress task_abc "Implemented GET endpoint"
maestro task report complete task_abc "All endpoints implemented and tested"
maestro task report blocked task_abc "Waiting for database schema from Worker A"
maestro task report error task_abc "Test suite failing — 3 assertion errors"
```

---

## From Your Side: Watching Sessions

### Live watch (WebSocket)

The most powerful monitoring tool. Streams events in real time:

```bash
maestro session watch sess_001
```

```
[session:watch] Watching 1 session(s): sess_001
[session:watch] Connected. Listening for events...
[14:00:01] sess_001 status: working
[14:02:30] sess_001 progress: Reading existing codebase structure
[14:05:15] sess_001 progress: Creating database migration files
[14:08:00] sess_001 progress: Building API route handlers
[14:10:30] sess_001 task_completed: Database migration done
[14:12:00] sess_001 progress: Writing integration tests
[14:15:45] sess_001 COMPLETED: Worker: Build blog API
[session:watch] All watched sessions have finished.
```

Watch multiple sessions at once:

```bash
maestro session watch sess_001,sess_002,sess_003
```

With a timeout (auto-exits after 10 minutes):

```bash
maestro session watch sess_001 --timeout 600000
```

JSON output for scripting:

```bash
maestro session watch sess_001 --json
```

Returns one JSON object per line:

```json
{"event":"session:updated","sessionId":"sess_001","data":{"status":"working"},"timestamp":"2025-01-15T14:00:01Z"}
{"event":"timeline","sessionId":"sess_001","data":{"type":"progress","message":"Reading codebase"},"timestamp":"2025-01-15T14:02:30Z"}
```

### Session logs

Get the full log output from a session:

```bash
# Last 50 lines
maestro session logs sess_001 --tail 50

# Follow logs live (like tail -f)
maestro session logs sess_001 --follow

# All logs from multiple sessions
maestro session logs sess_001,sess_002
```

### Session info

Snapshot of a session's current state:

```bash
maestro session info sess_001
```

```
Session: sess_001
Name: Worker: Build blog API
Status: working
Team Member: ⚙️ Bob
Tasks: task_blog_001
Started: 2025-01-15 14:00:01
Last Activity: 2025-01-15 14:12:00
```

### List sessions by status

```bash
# All active sessions
maestro session list --status working

# Completed sessions
maestro session list --status completed

# Everything
maestro session list
```

---

## The Session Timeline

Every session maintains a timeline — a chronological record of everything that happened:

- Status changes (spawning → working → completed)
- Progress reports from the agent
- Task completions and blocks
- Errors and warnings
- Messages received from other sessions

**In the desktop app:** The timeline view shows this as a visual feed. Each event has a timestamp, type, and message. It's the audit trail of everything Claude did.

---

## Detecting When Claude Needs Help

Sessions can signal they need human input:

```bash
maestro session needs-input --message "Should I use JWT or session cookies for auth?"
```

When this happens:
- The session status shows `needsInput: true`
- The desktop app shows a notification
- `session watch` outputs an alert:

```
[14:20:00] sess_001 ⚠️ NEEDS INPUT: Should I use JWT or session cookies for auth?
```

Respond by sending a message:

```bash
maestro session prompt sess_001 --message "Use JWT with refresh tokens."
```

The session continues working with your answer.

---

## Monitoring a Full Orchestration

When an orchestrator is running with multiple workers:

```bash
# Watch everything
maestro session list --status working
maestro session watch sess_coord,sess_w1,sess_w2,sess_w3

# Check the task tree for high-level progress
maestro task tree
```

```
📋 Project Tasks
├── 🔄 Build full-stack blog (task_001) [Coordinator]
│   ├── ✅ Database schema (task_002)
│   ├── ✅ API endpoints (task_003)
│   ├── 🔄 Frontend pages (task_004)
│   ├── 🚫 E2E tests (task_005) — blocked: waiting for frontend
│   └── ⬜ Deploy config (task_006)
```

---

## Tips

- **Use `session watch` for real-time.** It's WebSocket-based and shows events instantly.
- **Use `session logs` for debugging.** It shows the full terminal output — everything Claude saw and did.
- **Use `task tree` for the big picture.** Gives you the status of every task at a glance.
- **JSON output integrates with tools.** Pipe `session watch --json` to monitoring systems, log aggregators, or custom dashboards.

---

## What Next?

- **Want to customize how agents work?** See [Custom Skills](./custom-skills.md).
- **Want to control agent permissions?** See [Permissions](./permissions.md).
- **Want agents to talk to each other?** See [Inter-Session Messaging](./inter-session-messaging.md).
