# Project Commands

Manage Maestro projects. Projects are the top-level containers that associate a working directory with tasks, sessions, and team members.

## maestro project list

List all projects.

### Syntax

```
maestro project list
```

### Arguments

None.

### Flags

None (uses global `--json` flag).

### Example

```bash
maestro project list
```

```
┌────────────────────────────┬──────────────────┬─────────────────────────────────┐
│ ID                         │ Name             │ Working Dir                     │
├────────────────────────────┼──────────────────┼─────────────────────────────────┤
│ proj_1770533548982_3bgiz   │ agent-maestro    │ /Users/dev/projects/maestro     │
│ proj_1770612345678_abc12   │ web-app          │ /Users/dev/projects/web-app     │
└────────────────────────────┴──────────────────┴─────────────────────────────────┘
```

### Related Commands

- `maestro project get` — Get details for a specific project

---

## maestro project create

Create a new project.

### Syntax

```
maestro project create <name> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Name of the project |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-d, --dir <workingDir>` | string | Current directory | Working directory for the project |
| `--desc <description>` | string | — | Project description |

### Example

```bash
maestro project create my-api --dir /Users/dev/projects/my-api --desc "REST API backend"
```

```
✔ Project created
  ID:   proj_1770612345678_abc12
  Name: my-api
  Dir:  /Users/dev/projects/my-api
```

### Related Commands

- `maestro project list` — List all projects
- `maestro project get` — View project details

---

## maestro project get

Get project details.

### Syntax

```
maestro project get <id>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Project ID |

### Flags

None.

### Example

```bash
maestro project get proj_1770533548982_3bgiz
```

```
  ID:          proj_1770533548982_3bgiz
  Name:        agent-maestro
  Dir:         /Users/dev/projects/maestro
  Description: Multi-agent orchestration platform
```

### Related Commands

- `maestro project list` — List all projects

---

## maestro project delete

Delete a project.

### Syntax

```
maestro project delete <id>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Project ID to delete |

### Flags

None.

### Example

```bash
maestro project delete proj_1770612345678_abc12
```

```
✔ Project deleted
```

### Related Commands

- `maestro project list` — List remaining projects

---

## maestro project set-master

Designate a project as a master project. Master projects can manage sessions and tasks across all other projects.

### Syntax

```
maestro project set-master <id>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Project ID to designate as master |

### Flags

None.

### Example

```bash
maestro project set-master proj_1770533548982_3bgiz
```

```
✔ Project set as master
  ID:     proj_1770533548982_3bgiz
  Name:   agent-maestro
  Master: true
```

### Related Commands

- `maestro project unset-master` — Remove master designation
- `maestro master projects` — List all projects from master context

---

## maestro project unset-master

Remove master designation from a project.

### Syntax

```
maestro project unset-master <id>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Project ID to remove master designation from |

### Flags

None.

### Example

```bash
maestro project unset-master proj_1770533548982_3bgiz
```

```
✔ Project master status removed
  ID:     proj_1770533548982_3bgiz
  Name:   agent-maestro
  Master: false
```

### Related Commands

- `maestro project set-master` — Designate a project as master
