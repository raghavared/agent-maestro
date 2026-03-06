# Team Commands

Manage teams within a project. Teams group team members under a leader and can contain sub-teams for hierarchical organization.

All team commands require a project context (`--project` or `MAESTRO_PROJECT_ID`).

## maestro team list

List teams for the current project.

### Syntax

```
maestro team list [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--all` | boolean | `false` | Include archived teams |
| `--status <status>` | string | — | Filter by status: `active` or `archived` |

### Example

```bash
maestro team list
```

```
┌──────────────────────────┬──────────────────┬──────────────────┬─────────┬───────────┬────────┐
│ ID                       │ Name             │ Leader           │ Members │ Sub-Teams │ Status │
├──────────────────────────┼──────────────────┼──────────────────┼─────────┼───────────┼────────┤
│ team_abc123              │ 🚀 Backend Team  │ tm_leader_001    │ 3       │ 1         │ active │
│ team_def456              │ 🎨 Frontend Team │ tm_leader_002    │ 2       │ 0         │ active │
└──────────────────────────┴──────────────────┴──────────────────┴─────────┴───────────┴────────┘
```

### Related Commands

- `maestro team get` — Get team details
- `maestro team create` — Create a new team

---

## maestro team get

Get team details.

### Syntax

```
maestro team get <teamId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Team ID |

### Flags

None.

### Example

```bash
maestro team get team_abc123
```

```
  ID:          team_abc123
  Name:        🚀 Backend Team
  Description: Handles all backend API development
  Leader:      tm_leader_001
  Status:      active
  Members:     tm_worker_001, tm_worker_002, tm_worker_003
  Sub-Teams:   team_db_001
```

### Related Commands

- `maestro team edit` — Edit team details
- `maestro team tree` — Show team hierarchy

---

## maestro team create

Create a new team.

### Syntax

```
maestro team create <name> --leader <teamMemberId> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Team name |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--leader <teamMemberId>` | string | **Required** | Team leader (team member ID) |
| `--members <ids>` | string | — | Comma-separated member IDs |
| `--description <text>` | string | — | Team description |
| `--avatar <emoji>` | string | — | Team avatar emoji |

### Example

```bash
maestro team create "Backend Team" \
  --leader tm_leader_001 \
  --members "tm_worker_001,tm_worker_002" \
  --description "Backend API development" \
  --avatar "🚀"
```

```
✔ Team created
  ID:      team_abc123
  Name:    🚀 Backend Team
  Leader:  tm_leader_001
  Members: tm_worker_001, tm_worker_002
```

### Related Commands

- `maestro team list` — List all teams
- `maestro team add-member` — Add members later

---

## maestro team edit

Edit a team's details.

### Syntax

```
maestro team edit <teamId> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Team ID to edit |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--name <name>` | string | — | Update team name |
| `--leader <teamMemberId>` | string | — | Update team leader |
| `--description <text>` | string | — | Update description |
| `--avatar <emoji>` | string | — | Update avatar emoji |

### Example

```bash
maestro team edit team_abc123 --name "API Team" --avatar "⚡"
```

```
✔ Team updated
  ID:     team_abc123
  Name:   ⚡ API Team
  Leader: tm_leader_001
```

### Related Commands

- `maestro team get` — View current details

---

## maestro team archive

Archive a team. Archived teams are hidden from default listings.

### Syntax

```
maestro team archive <teamId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Team ID to archive |

### Flags

None.

### Example

```bash
maestro team archive team_abc123
```

```
✔ Team archived
  ID:     team_abc123
  Name:   🚀 Backend Team
  Status: archived
```

### Related Commands

- `maestro team unarchive` — Restore an archived team
- `maestro team delete` — Delete (requires archiving first)

---

## maestro team unarchive

Restore an archived team to active status.

### Syntax

```
maestro team unarchive <teamId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Team ID to unarchive |

### Flags

None.

### Example

```bash
maestro team unarchive team_abc123
```

```
✔ Team unarchived
  ID:     team_abc123
  Name:   🚀 Backend Team
  Status: active
```

### Related Commands

- `maestro team archive` — Archive a team

---

## maestro team delete

Delete a team. The team must be archived first.

### Syntax

```
maestro team delete <teamId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Team ID to delete |

### Flags

None.

### Example

```bash
maestro team delete team_abc123
```

```
Warning: Teams must be archived before deletion. Use "team archive <id>" first.
✔ Team deleted
  Team team_abc123 deleted.
```

### Related Commands

- `maestro team archive` — Archive before deleting

---

## maestro team add-member

Add one or more members to a team.

### Syntax

```
maestro team add-member <teamId> <memberIds...>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Team ID |
| `memberIds` | Yes | One or more team member IDs to add (space-separated) |

### Flags

None.

### Example

```bash
maestro team add-member team_abc123 tm_worker_003 tm_worker_004
```

```
✔ Members added
  ID:      team_abc123
  Name:    🚀 Backend Team
  Members: tm_worker_001, tm_worker_002, tm_worker_003, tm_worker_004
```

### Related Commands

- `maestro team remove-member` — Remove members from a team

---

## maestro team remove-member

Remove one or more members from a team.

### Syntax

```
maestro team remove-member <teamId> <memberIds...>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Team ID |
| `memberIds` | Yes | One or more team member IDs to remove (space-separated) |

### Flags

None.

### Example

```bash
maestro team remove-member team_abc123 tm_worker_003
```

```
✔ Members removed
  ID:      team_abc123
  Name:    🚀 Backend Team
  Members: tm_worker_001, tm_worker_002, tm_worker_004
```

### Related Commands

- `maestro team add-member` — Add members to a team

---

## maestro team add-sub-team

Add a sub-team to a team, creating a hierarchical structure.

### Syntax

```
maestro team add-sub-team <teamId> <subTeamId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Parent team ID |
| `subTeamId` | Yes | Sub-team ID to add |

### Flags

None.

### Example

```bash
maestro team add-sub-team team_abc123 team_db_001
```

```
✔ Sub-team added
  ID:        team_abc123
  Name:      🚀 Backend Team
  Sub-Teams: team_db_001
```

### Related Commands

- `maestro team remove-sub-team` — Remove a sub-team
- `maestro team tree` — View hierarchy

---

## maestro team remove-sub-team

Remove a sub-team from a team.

### Syntax

```
maestro team remove-sub-team <teamId> <subTeamId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Parent team ID |
| `subTeamId` | Yes | Sub-team ID to remove |

### Flags

None.

### Example

```bash
maestro team remove-sub-team team_abc123 team_db_001
```

```
✔ Sub-team removed
  ID:        team_abc123
  Name:      🚀 Backend Team
  Sub-Teams: none
```

### Related Commands

- `maestro team add-sub-team` — Add a sub-team

---

## maestro team tree

Display the full team hierarchy tree.

### Syntax

```
maestro team tree <teamId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamId` | Yes | Root team ID to display tree from |

### Flags

None.

### Example

```bash
maestro team tree team_abc123
```

```
🚀 Backend Team (4 members)
├── 🗄️ Database Team (2 members)
│   └── 🔍 Query Optimization (1 members)
└── 🌐 API Gateway Team (2 members)
```

### Related Commands

- `maestro team get` — Get flat team details
- `maestro team add-sub-team` — Build team hierarchy
