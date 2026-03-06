# Task List Commands

Manage ordered task lists within a project. Task lists provide a curated, ordered view of tasks beyond the default project task listing.

## maestro task-list create

Create a new task list.

### Syntax

```
maestro task-list create [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--name <name>` | string | — | Name for the task list |
| `--description <text>` | string | — | Description of the task list |

### Example

```bash
maestro task-list create --name "Sprint 1" --description "First sprint backlog"
```

```json
{
  "id": "tl_1772040_abc12",
  "name": "Sprint 1",
  "description": "First sprint backlog",
  "orderedTaskIds": []
}
```

### Related Commands

- `maestro task-list list` — List all task lists
- `maestro task-list reorder` — Reorder tasks within a list

---

## maestro task-list list

List all task lists for the current project.

### Syntax

```
maestro task-list list
```

### Arguments

None.

### Flags

None.

### Example

```bash
maestro --json task-list list
```

```json
[
  {
    "id": "tl_1772040_abc12",
    "name": "Sprint 1",
    "description": "First sprint backlog",
    "orderedTaskIds": ["task_abc123", "task_def456"]
  }
]
```

### Related Commands

- `maestro task-list get` — Get a specific task list
- `maestro task-list create` — Create a new list

---

## maestro task-list get

Get a specific task list with its ordered tasks.

### Syntax

```
maestro task-list get <id>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Task list ID |

### Flags

None.

### Example

```bash
maestro --json task-list get tl_1772040_abc12
```

```json
{
  "id": "tl_1772040_abc12",
  "name": "Sprint 1",
  "description": "First sprint backlog",
  "orderedTaskIds": ["task_abc123", "task_def456", "task_ghi789"]
}
```

### Related Commands

- `maestro task-list list` — List all task lists
- `maestro task-list reorder` — Change task ordering

---

## maestro task-list reorder

Reorder tasks within a task list.

### Syntax

```
maestro task-list reorder <id>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Task list ID to reorder |

### Flags

None.

### Example

```bash
maestro task-list reorder tl_1772040_abc12
```

### Related Commands

- `maestro task-list get` — View current order
- `maestro task-list list` — List all task lists
