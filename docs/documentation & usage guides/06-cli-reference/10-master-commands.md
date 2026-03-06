# Master Commands

Cross-project workspace commands. Master commands allow a designated master project to view and manage resources across all projects in the workspace.

These commands are available from sessions running in a master project (see `maestro project set-master`).

## maestro master projects

List all projects across the workspace.

### Syntax

```
maestro master projects
```

### Arguments

None.

### Flags

None.

### Example

```bash
maestro master projects
```

```
┌────────────────────────────┬──────────────────┬───────────────────────────────────┬────────┐
│ ID                         │ Name             │ Working Dir                       │ Master │
├────────────────────────────┼──────────────────┼───────────────────────────────────┼────────┤
│ proj_1770533548982_3bgiz   │ agent-maestro    │ /Users/dev/projects/maestro       │ yes    │
│ proj_1770612345678_abc12   │ web-app          │ /Users/dev/projects/web-app       │        │
│ proj_1770698765432_def34   │ mobile-api       │ /Users/dev/projects/mobile-api    │        │
└────────────────────────────┴──────────────────┴───────────────────────────────────┴────────┘
```

### Related Commands

- `maestro project list` — List projects (single project context)
- `maestro master context` — Full workspace overview

---

## maestro master tasks

List tasks across all projects (or filtered by a specific project).

### Syntax

```
maestro master tasks [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project <id>` | string | — | Filter by project ID |

### Example

```bash
maestro master tasks --project proj_1770612345678_abc12
```

```
┌────────────────────────┬────────────────────────────┬─────────────┬──────────┬────────────────────────────┐
│ ID                     │ Title                      │ Status      │ Priority │ Project                    │
├────────────────────────┼────────────────────────────┼─────────────┼──────────┼────────────────────────────┤
│ task_abc123             │ Build authentication       │ in_progress │ high     │ proj_1770612345678_abc12   │
│ task_def456             │ Add payment processing     │ todo        │ medium   │ proj_1770612345678_abc12   │
└────────────────────────┴────────────────────────────┴─────────────┴──────────┴────────────────────────────┘
```

### Related Commands

- `maestro task list` — List tasks within a single project
- `maestro master sessions` — View sessions across projects

---

## maestro master sessions

List sessions across all projects (or filtered by a specific project).

### Syntax

```
maestro master sessions [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project <id>` | string | — | Filter by project ID |

### Example

```bash
maestro master sessions
```

```
┌────────────────────────────┬──────────────────────────┬──────────┬────────────────────────────┐
│ ID                         │ Name                     │ Status   │ Project                    │
├────────────────────────────┼──────────────────────────┼──────────┼────────────────────────────┤
│ sess_17726525_abc12        │ Worker: Auth module      │ working  │ proj_1770612345678_abc12   │
│ sess_17726530_def34        │ Orchestrator: Payments   │ idle     │ proj_1770612345678_abc12   │
│ sess_17726535_ghi56        │ Worker: Mobile layout    │ working  │ proj_1770698765432_def34   │
└────────────────────────────┴──────────────────────────┴──────────┴────────────────────────────┘
```

### Related Commands

- `maestro session list` — List sessions within a single project
- `maestro master tasks` — View tasks across projects

---

## maestro master context

Full workspace overview across all projects. Shows project count, task counts, and session counts.

### Syntax

```
maestro master context
```

### Arguments

None.

### Flags

None.

### Example

```bash
maestro master context
```

```
  Projects: 3
    agent-maestro (proj_1770533548982_3bgiz) [master] — tasks: 12, sessions: 5
    web-app (proj_1770612345678_abc12) — tasks: 8, sessions: 3
    mobile-api (proj_1770698765432_def34) — tasks: 15, sessions: 7
```

### JSON output

```bash
maestro --json master context
```

```json
{
  "projects": [
    { "id": "proj_1770533548982_3bgiz", "name": "agent-maestro", "workingDir": "/Users/dev/maestro", "isMaster": true },
    { "id": "proj_1770612345678_abc12", "name": "web-app", "workingDir": "/Users/dev/web-app" }
  ],
  "taskCounts": {
    "proj_1770533548982_3bgiz": 12,
    "proj_1770612345678_abc12": 8
  },
  "sessionCounts": {
    "proj_1770533548982_3bgiz": 5,
    "proj_1770612345678_abc12": 3
  }
}
```

### Related Commands

- `maestro master projects` — List just the projects
- `maestro master tasks` — List tasks across projects
- `maestro master sessions` — List sessions across projects
