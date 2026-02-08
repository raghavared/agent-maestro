# Phase VII CLI Reference

**Usage:** `maestro <command> [subcommand] [options]`

**Global Options:**
- `--json`: Output results as JSON (essential for LLMs).
- `--help, -h`: Show help.
- `--version, -v`: Show version.
- `--server <url>`: Override Maestro Server URL.
- `--project <id>`: Override Project ID.

---

## 1. Task Management

### `maestro task list`
List tasks. Filters by status or priority.

**Options:**
- `--status <pending|in_progress|completed>`
- `--priority <high|medium|low>`
- `--all`: Show all tasks (ignores project context).

**Example (LLM):**
```bash
$ maestro task list --status pending --json
[
  { "id": "t1", "title": "Fix login bug", "priority": "high" },
  { "id": "t2", "title": "Update styles", "priority": "low" }
]
```

### `maestro task get <id>`
Get details of a specific task. If `<id>` is omitted and only one task is active in context, returns that.

### `maestro task create <title>`
Create a new task.

**Options:**
- `--desc <description>`
- `--priority <high|medium|low>`
- `--assign`: Automatically assign to current session.

### `maestro task update <id>`
Update a task.

**Options:**
- `--status <status>`
- `--priority <priority>`
- `--title <new title>`

### `maestro task complete <id>`
Shortcut for `update <id> --status completed`.

### `maestro task fail <id>`
Shortcut for `update <id> --status blocked`. Requires `--reason "..."`.

---

## 2. Session Management

### `maestro session info`
Get information about the current session (from `MAESTRO_SESSION_ID`).

### `maestro session list`
List active sessions for the current project.

---

## 3. Subtasks (Micro-Management)

LLMs often need to break down large tasks.

### `maestro subtask create <task-id> <title>`
Add a checklist item to a task.

### `maestro subtask list <task-id>`
List subtasks.

### `maestro subtask complete <task-id> <subtask-id>`
Mark a subtask as done.

---

## 4. Context & Debugging

### `maestro whoami`
Prints current context:
- Server URL
- Project ID
- Session ID
- Active Agent (if known)

### `maestro status`
Summary of the current project state (e.g., "3 tasks pending, 1 running").

---

## JSON Output Schema

When `--json` is passed, **STDOUT** must contain *only* valid JSON. **STDERR** can contain logs.

**Success:**
```json
{
  "success": true,
  "data": { ...object or array... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "error_code",
  "message": "Human readable message",
  "details": { ...optional context... }
}
```
