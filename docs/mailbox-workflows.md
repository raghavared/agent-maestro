# Maestro Mailbox & Session Watch Workflows

## Overview

Maestro provides two distinct communication mechanisms for coordinator-worker interaction:

1. **Session Watch** - Real-time WebSocket streaming of session state changes
2. **Mailbox** - Asynchronous structured messaging between sessions

---

## Architecture Summary

```
                    MAESTRO SERVER
                +-----------------------+
                |                       |
                |  MailService          |    WebSocketBridge
                |  (send/inbox/wait)    |    (event streaming)
                |       |               |         |
                |  EventBus ─────────────────────-+
                |  "mail:received"      |    "session:updated"
                |  "mail:deleted"       |    "notify:progress"
                |                       |    "notify:session_completed"
                |  FileSystemMail       |    "notify:session_failed"
                |  Repository           |    "notify:needs_input"
                |  (~/.maestro/data/    |
                |     mail/*.json)      |
                +-----------------------+
                     |           |
            HTTP REST API    WebSocket
                     |           |
         +-----------+-----------+-----------+
         |                                   |
    COORDINATOR                          WORKER(s)
    (mode=coordinate)                    (mode=execute)
    - mail send                          - session report progress
    - mail inbox                         - session report complete
    - mail broadcast                     - session report blocked
    - mail wait                          - mail inbox (receive)
    - session watch <ids>                - mail reply <mailId>
    - session spawn --task <id>          - mail send (to coordinator)
```

---

## 1. Session Watch (WebSocket Streaming)

### What It Is
`maestro session watch` opens a WebSocket connection to the Maestro server and subscribes to real-time events for specific session IDs. It's a **push-based, real-time** monitoring mechanism.

### How It Works
1. Coordinator spawns worker sessions via `maestro session spawn --task <subtaskId>`
2. Coordinator collects all spawned session IDs
3. Coordinator runs `maestro session watch <id1>,<id2>,...`
4. WebSocket connects and sends a `subscribe` message with the session IDs
5. Server's `WebSocketBridge` filters and pushes relevant domain events
6. Watch command tracks session statuses and auto-exits when all sessions reach `completed`, `failed`, or `stopped`

### Events Received
| Event | Description |
|-------|-------------|
| `session:updated` | Status change, timeline update, needsInput flag |
| `notify:progress` | Worker progress milestone |
| `notify:session_completed` | Worker finished successfully |
| `notify:session_failed` | Worker failed |
| `notify:needs_input` | Worker needs user input |

### CLI Syntax
```bash
# Watch multiple sessions
maestro session watch <sessionId1>,<sessionId2>,...

# With timeout (auto-exit after N ms)
maestro session watch <ids> --timeout 60000
```

### Output Modes
- **Human-readable**: Timestamped event log with status changes and progress messages
- **JSON mode** (`--json`): JSONL (one JSON object per line) for programmatic consumption

### When Session Watch Exits
- All watched sessions reach terminal state (`completed`, `failed`, `stopped`)
- Timeout expires (if `--timeout` is set)
- WebSocket connection drops

---

## 2. Mailbox System (Async Messaging)

### What It Is
The mailbox is an **asynchronous, structured messaging system** between sessions. Messages are typed, persisted to disk, and can be queried, waited on, and replied to.

### Mail Message Structure
```typescript
interface MailMessage {
  id: string;                    // "mail_<timestamp>_<random>"
  projectId: string;
  fromSessionId: string;
  toSessionId: string | null;    // null = broadcast to all sessions
  replyToMailId: string | null;  // threading support
  type: MailMessageType;         // see below
  subject: string;
  body: Record<string, any>;    // type-specific structured fields
  createdAt: number;             // timestamp
}
```

### Mail Message Types
| Type | Body Field | Use Case |
|------|-----------|----------|
| `assignment` | `instructions` | Coordinator assigns work to a worker |
| `status_update` | `message` | Worker reports status back to coordinator |
| `query` | `question` | Either party asks a question |
| `response` | `answer` | Reply to a query |
| `directive` | `details` | Coordinator sends an instruction/override |
| `notification` | `message` | General notification |

### CLI Commands

#### Send Mail (to specific sessions)
```bash
maestro mail send <sessionId1>,<sessionId2>,... \
  --type <type> \
  --subject "Subject line" \
  --message "Body content" \
  [--task-id <taskId>] \
  [--priority <priority>] \
  [--reply-to <mailId>]
```

#### Check Inbox
```bash
maestro mail inbox [--type <type>]
```

#### Reply to Mail
```bash
maestro mail reply <mailId> --message "Response content"
```

#### Broadcast (coordinator only)
```bash
maestro mail broadcast --type <type> --subject "Subject" --message "Content"
```
Sets `toSessionId: null` so all sessions in the project receive it.

#### Wait for Mail (coordinator only, long-poll)
```bash
maestro mail wait [--timeout <ms>] [--since <timestamp>]
```
Blocks until a new mail arrives or timeout expires (default 30s, max 120s).

### How Mail Wait Works (Server-Side)
1. Checks for existing messages since the `--since` timestamp
2. If messages exist, returns them immediately
3. If no messages, subscribes to the `mail:received` event on the EventBus
4. When a matching mail arrives (same project, addressed to this session or broadcast), returns it
5. On timeout, returns empty array

### Mail Storage
- Persisted as individual JSON files in `~/.maestro/data/mail/`
- In-memory cache for fast reads
- Each message: `<mail-id>.json`

---

## 3. Coordinator Workflow Patterns

### Pattern A: Session Watch (Primary - Used by Default)

This is the **primary monitoring pattern** used in all coordinator strategies (default, intelligent-batching, dag).

```
COORDINATOR                                      WORKER
    |                                               |
    |-- maestro task create "subtask" --parent X --> |
    |                                               |
    |-- maestro session spawn --task <subtaskId> --> |
    |   (receives sessionId back)                   |
    |                                               |
    |-- maestro session watch <sessionId> --------->|
    |   (WebSocket connection opens)                |
    |                                               |
    |   <--- session:updated (status: working) -----|
    |                                               |-- (does work)
    |   <--- notify:progress "50% done" ------------|
    |                                               |-- (more work)
    |   <--- notify:session_completed --------------|
    |                                               |
    |   (watch auto-exits, all sessions done)       |
    |                                               |
    |-- maestro task children <parentId> ---------->|
    |   (verify all subtasks completed)             |
    |                                               |
    |-- maestro session report complete "done" ---->|
```

### Pattern B: Mailbox (Supplementary - For Complex Coordination)

The mailbox is used when sessions need to **exchange structured data** or when the coordinator needs to send follow-up instructions to running workers.

```
COORDINATOR                                      WORKER
    |                                               |
    |-- maestro session spawn --task <subtaskId> --> |
    |                                               |
    |   (Worker encounters a question)              |
    |   <--- mail send <coordId> --type query       |
    |        --subject "Which DB?" --message "..."  |
    |                                               |
    |-- maestro mail inbox ----------------------->  |
    |   (sees the query)                            |
    |                                               |
    |-- maestro mail reply <mailId>                 |
    |   --message "Use PostgreSQL" ---------------->|
    |                                               |
    |   (Worker checks inbox, gets answer)          |
    |   --- maestro mail inbox --type response ---->|
    |                                               |
    |   (Worker continues with answer)              |
```

### Pattern C: Broadcast Directive

```
COORDINATOR                                  WORKER A    WORKER B    WORKER C
    |                                           |           |           |
    |-- mail broadcast --type directive         |           |           |
    |   --subject "Stop: spec changed"          |           |           |
    |   --message "New requirements..."  ------>|---------->|---------->|
    |                                           |           |           |
    |   (All workers receive the directive)     |           |           |
```

---

## 4. Session Watch vs Mailbox: When to Use Which

| Dimension | Session Watch | Mailbox |
|-----------|--------------|---------|
| **Transport** | WebSocket (real-time push) | HTTP REST (pull / long-poll) |
| **Direction** | Server -> Coordinator (one-way) | Bidirectional (any session -> any session) |
| **Persistence** | No (ephemeral events) | Yes (stored as JSON files) |
| **Content** | Session state changes | Structured typed messages |
| **Blocking** | Yes (blocks until all sessions done) | Optional (`mail wait` blocks, `mail inbox` doesn't) |
| **Use in workflows** | Primary monitoring mechanism | Supplementary communication |
| **Available to** | Coordinators only (in prompt) | All sessions (workers + coordinators) |
| **Thread support** | No | Yes (`replyToMailId` for threading) |

### Decision Guide

**Use Session Watch when:**
- Monitoring worker completion (the primary use case)
- You need real-time status updates
- You want automatic exit when all workers finish
- You're in the "monitor" phase of coordinator workflow
- You need to detect `needsInput` situations

**Use Mailbox when:**
- Workers need to ask the coordinator questions
- Coordinator needs to send follow-up instructions to running workers
- You need structured, typed communication (assignments, queries, directives)
- You need message persistence and auditability
- Multiple sessions need to coordinate peer-to-peer
- You want to broadcast to all sessions at once

### Combined Pattern (Recommended for Complex Workflows)

```
1. Coordinator spawns workers
2. Coordinator starts session watch (for real-time monitoring)
3. Workers can send mail to coordinator if they need guidance
4. Coordinator periodically checks inbox during watch
5. Session watch auto-exits when workers complete
6. Coordinator verifies results
```

---

## 5. Command Reference by Role

### Coordinator Commands

| Command | Purpose | Phase |
|---------|---------|-------|
| `maestro task create "..." --parent <id>` | Create subtask | decompose |
| `maestro session spawn --task <id>` | Launch worker | spawn |
| `maestro session watch <ids>` | Monitor workers | monitor |
| `maestro mail inbox` | Check for worker messages | monitor |
| `maestro mail reply <id> --message "..."` | Answer worker queries | monitor |
| `maestro mail broadcast --type directive` | Send instructions to all | monitor |
| `maestro mail wait --timeout <ms>` | Block until mail arrives | monitor |
| `maestro task children <parentId>` | Verify subtask statuses | verify |
| `maestro session report complete "..."` | Report done | complete |

### Worker Commands

| Command | Purpose | Phase |
|---------|---------|-------|
| `maestro session report progress "..."` | Report milestone | execute |
| `maestro task report progress <id> "..."` | Report task progress | execute |
| `maestro session report blocked "..."` | Report blocker | execute |
| `maestro mail send <coordId> --type query` | Ask coordinator a question | execute |
| `maestro mail inbox` | Check for coordinator replies | execute |
| `maestro mail reply <id> --message "..."` | Reply to coordinator | execute |
| `maestro session report complete "..."` | Report done | complete |
| `maestro task report complete <id> "..."` | Report task done | complete |

---

## 6. Known Issues & Improvement Areas

### Mail Command Issues Identified
1. **Workers may not know coordinator session ID** - Workers need the coordinator's session ID to send mail back, but this isn't always passed in the spawn context
2. **Mail wait only in coordinate mode** - `mail wait` and `mail broadcast` are only shown in coordinator prompts, but workers might benefit from `mail wait` too
3. **No mail notification in session watch** - Session watch doesn't show `mail:received` events, so coordinators monitoring via watch might miss mail from workers
4. **Body field varies by type** - The `buildBody()` function maps `--message` to different body fields depending on type (`instructions`, `question`, `answer`, `details`, `message`), which can be confusing

### Session Watch Limitations
1. **One-directional** - Watch only receives events; the coordinator cannot send messages through the watch channel
2. **No structured data** - Watch events contain status/progress strings but not structured payloads
3. **Must pre-collect session IDs** - You need all session IDs before starting watch; can't add new sessions to an existing watch

---

## 7. Architecture Diagram Key Files

| File | Purpose |
|------|---------|
| `maestro-cli/src/commands/mail.ts` | Mail CLI commands |
| `maestro-cli/src/commands/session.ts` | Session watch CLI (line 288+) |
| `maestro-cli/src/services/prompt-builder.ts` | System prompt generation |
| `maestro-server/src/api/mailRoutes.ts` | Mail REST API endpoints |
| `maestro-server/src/application/services/MailService.ts` | Mail business logic |
| `maestro-server/src/infrastructure/repositories/FileSystemMailRepository.ts` | Mail persistence |
| `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` | WebSocket event bridge |
| `maestro-server/src/domain/events/DomainEvents.ts` | Domain event definitions |
| `maestro-server/src/api/sessionRoutes.ts` | Session spawn endpoint (line 455+) |
