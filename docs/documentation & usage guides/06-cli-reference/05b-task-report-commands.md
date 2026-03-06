# Task Report Commands

Report task-level session status. Unlike the top-level `report` commands (which operate on the session), task report commands update the status of a specific task within the current session.

All task report commands require `MAESTRO_SESSION_ID` to be set in the environment.

## maestro task report progress

Report work progress on a specific task. Updates the task's session status to `working` and posts a progress timeline event.

### Syntax

```
maestro task report progress <taskId> <message>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `taskId` | Yes | Task ID to report progress on |
| `message` | Yes | Progress message |

### Flags

None.

### Example

```bash
maestro task report progress task_abc123 "Implementing JWT middleware — 60% complete"
```

```
✔ Task progress reported
```

### Related Commands

- `maestro report progress` — Report session-level progress
- `maestro task report complete` — Mark task as completed

---

## maestro task report complete

Report task completion. Updates the task's session status to `completed` and posts a completion timeline event.

**Note:** This does NOT complete the session — it only marks the specific task's session status as completed. Use `maestro report complete` or `maestro session report complete` to complete the entire session.

### Syntax

```
maestro task report complete <taskId> <summary>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `taskId` | Yes | Task ID to mark as completed |
| `summary` | Yes | Completion summary |

### Flags

None.

### Example

```bash
maestro task report complete task_abc123 "JWT authentication fully implemented. 12 tests passing."
```

```
✔ Task completion reported
```

### Related Commands

- `maestro report complete` — Complete the session (also updates session status)
- `maestro task complete` — Direct task status change (coordinator-only)

---

## maestro task report blocked

Report that a task is blocked. Updates the task's session status to `blocked` and posts a blocked timeline event.

### Syntax

```
maestro task report blocked <taskId> <reason>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `taskId` | Yes | Task ID that is blocked |
| `reason` | Yes | Reason why the task is blocked |

### Flags

None.

### Example

```bash
maestro task report blocked task_abc123 "Waiting for database migration scripts from infrastructure team"
```

```
✔ Task blocked reported
```

### Related Commands

- `maestro report blocked` — Report session-level blocker
- `maestro task block` — Direct task status change (coordinator-only)

---

## maestro task report error

Report an error on a specific task. Updates the task's session status to `failed` and posts an error timeline event.

### Syntax

```
maestro task report error <taskId> <description>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `taskId` | Yes | Task ID where the error occurred |
| `description` | Yes | Error description |

### Flags

None.

### Example

```bash
maestro task report error task_abc123 "TypeScript compilation failed: Cannot find module 'jsonwebtoken'"
```

```
✔ Task error reported
```

### Related Commands

- `maestro report error` — Report session-level error
- `maestro task report progress` — Resume reporting progress after fixing

---

## Session vs Task Reports: Key Differences

| Command | Scope | Session Impact | Task Impact |
|---------|-------|----------------|-------------|
| `maestro report progress` | Session | Posts timeline event | — |
| `maestro report complete` | Session | Posts timeline event + **marks session as completed** | — |
| `maestro task report progress` | Task | Posts timeline event | Sets task session status to `working` |
| `maestro task report complete` | Task | Posts timeline event | Sets task session status to `completed` |

- **Session reports** affect the entire session lifecycle (especially `report complete` which terminates the session).
- **Task reports** affect only the per-task status within the session, allowing a session working on multiple tasks to report progress/completion on each individually.
