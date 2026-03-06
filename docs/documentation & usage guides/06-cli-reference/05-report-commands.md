# Report Commands

Shortcut commands for reporting session status updates. These are equivalent to `maestro session report <subcommand>` but available at the top level for convenience.

All report commands require `MAESTRO_SESSION_ID` to be set in the environment (i.e., they must be run from within a Maestro session).

## maestro report progress

Report work progress. Posts a timeline event to the current session.

### Syntax

```
maestro report progress <message>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `message` | Yes | Progress message describing current work |

### Flags

None.

### Example

```bash
maestro report progress "Implementing JWT middleware — 60% complete"
```

```
✔ progress reported
```

### Related Commands

- `maestro session report progress` — Equivalent command under `session report`
- `maestro task report progress` — Report progress on a specific task

---

## maestro report complete

Report completion and mark the current session as completed. This both posts a timeline event and updates the session status.

### Syntax

```
maestro report complete <summary>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `summary` | Yes | Completion summary |

### Flags

None.

### Example

```bash
maestro report complete "All authentication endpoints implemented and tested. 15 tests passing."
```

```
✔ complete reported
```

### Related Commands

- `maestro session report complete` — Equivalent command under `session report`
- `maestro task report complete` — Report task completion (does not complete session)

---

## maestro report blocked

Report a blocker on the current session. Posts a blocked timeline event.

### Syntax

```
maestro report blocked <reason>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `reason` | Yes | Description of what is blocking progress |

### Flags

None.

### Example

```bash
maestro report blocked "Waiting for database migration scripts from the infrastructure team"
```

```
✔ blocked reported
```

### Related Commands

- `maestro session report blocked` — Equivalent command under `session report`
- `maestro task report blocked` — Report a specific task as blocked

---

## maestro report error

Report an error encountered during session execution.

### Syntax

```
maestro report error <description>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | Yes | Description of the error encountered |

### Flags

None.

### Example

```bash
maestro report error "Build failed: TypeScript compilation error in auth.ts line 42"
```

```
✔ error reported
```

### Related Commands

- `maestro session report error` — Equivalent command under `session report`
- `maestro task report error` — Report an error on a specific task

---

## Session Report Subcommands

These are identical to the top-level report commands but namespaced under `session report`.

### maestro session report progress

```
maestro session report progress <message>
```

### maestro session report complete

```
maestro session report complete <summary>
```

### maestro session report blocked

```
maestro session report blocked <reason>
```

### maestro session report error

```
maestro session report error <description>
```

All arguments, behavior, and output are identical to their `maestro report` counterparts described above.
