# Send Messages Between Sessions

**Scenario:** Worker A needs to tell Worker B something. A coordinator needs to give a worker new instructions. Here's how sessions communicate.

---

## Prerequisites

- Multiple active sessions in the same project
- Sessions must be in `working` or `idle` status to receive messages

## Sending a Direct Message

Use `session prompt` to send a message to any active session:

```bash
maestro session prompt <target-session-id> --message "The database schema has changed. The users table now has a 'role' column. Update your queries."
```

```
✓ Prompt sent to session sess_worker_002
```

The target session receives the message as input in its terminal — just like a user typing into Claude's prompt.

## Finding Session IDs

### List all sessions

```bash
maestro session list
```

```
ID              Name                        Status     Team Member
sess_coord_001  Coordinator: Feature X      working    👔 Lead
sess_w_001      Worker: Build frontend      working    🎨 Alice
sess_w_002      Worker: Build backend       working    ⚙️ Bob
sess_w_003      Worker: Write tests         idle       🧪 Charlie
```

### From inside a coordinated session

Workers spawned by a coordinator can see their siblings:

```bash
maestro session siblings
```

```
Sibling Sessions:
ID              Name                    Status     Team Member
sess_w_001      Worker: Build frontend  working    🎨 Alice
sess_w_003      Worker: Write tests     idle       🧪 Charlie
```

This shows other sessions that share the same coordinator.

---

## Common Messaging Patterns

### Coordinator → Worker

The coordinator sends instructions to workers:

```bash
# From coordinator session:
maestro session prompt sess_w_001 --message "Frontend auth is blocked until the API is ready. Switch to building the settings page instead."
```

### Worker → Worker

Workers can message each other directly:

```bash
# From Worker A:
maestro session prompt sess_w_002 --message "I exported the shared types to src/types/shared.ts. You can import UserType from there."
```

### User → Any Session

From your terminal (outside any session), send a message to any active session:

```bash
maestro session prompt sess_coord_001 --message "Change of plans — skip the notification feature for now. Focus on core CRUD."
```

---

## Message Modes

### Send mode (default)

Types the message and presses Enter — Claude processes it immediately:

```bash
maestro session prompt sess_w_001 --message "Update the API base URL to /api/v2" --mode send
```

### Paste mode

Types the message but doesn't press Enter — useful for providing context without triggering immediate action:

```bash
maestro session prompt sess_w_001 --message "Reference: the design spec is at docs/design.md" --mode paste
```

---

## Messaging in Practice

Here's a typical flow with inter-session communication:

```
Coordinator spawns Worker A (database) and Worker B (API)
  ↓
Worker A completes database schema
  ↓
Coordinator sends to Worker B: "Schema is ready. Tables: users, posts, comments."
  ↓
Worker B starts building API using the new schema
  ↓
Worker B hits an issue, messages Coordinator: "The posts table needs a slug column for URL-friendly titles."
  ↓
Coordinator messages Worker A: "Add a slug column to the posts table."
  ↓
Worker A adds the column, messages Worker B: "Done. slug is VARCHAR(255) UNIQUE."
  ↓
Worker B continues
```

---

## Who Can Message Whom

- **Any session can message any other session** in the same project
- **Coordinators** typically message their spawned workers
- **Workers** can message siblings (other workers under the same coordinator) and their coordinator
- **You** can message any session from the CLI

The sender's session ID is included with the message, so the recipient knows who sent it.

---

## Tips

- **Keep messages actionable.** Don't send status updates as messages — use `maestro report progress` for that. Messages should contain instructions or information the recipient needs to act on.
- **Check session status first.** A session must be active to receive messages:

```bash
maestro session info sess_w_001
```

- **Use session logs to see the conversation:**

```bash
maestro session logs sess_w_001 --tail 20
```

---

## What Next?

- **Want to track all progress centrally?** See [Track Progress in Real Time](./real-time-tracking.md).
- **Want to set up a full team?** See [Set Up a Team](./team-setup.md).
- **Want to control what agents can do?** See [Permissions](./permissions.md).
