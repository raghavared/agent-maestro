# Team Member Commands

Manage team members within a project. Team members define agent personas with specific roles, models, skills, and identity instructions.

All team member commands require a project context (`--project` or `MAESTRO_PROJECT_ID`).

## maestro team-member list

List team members for the current project.

### Syntax

```
maestro team-member list [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--all` | boolean | `false` | Include archived members |
| `--status <status>` | string | — | Filter by status: `active` or `archived` |
| `--mode <mode>` | string | — | Filter by mode: `worker`, `coordinator`, `coordinated-worker`, `coordinated-coordinator` |

### Example

```bash
maestro team-member list
```

```
┌──────────────────┬──────────────┬──────────────────────┬────────────────────────┬────────┬─────────┐
│ ID               │ Name         │ Role                 │ Mode                   │ Status │ Default │
├──────────────────┼──────────────┼──────────────────────┼────────────────────────┼────────┼─────────┤
│ tm_pro_001       │ 🤖 Pro       │ Full-stack developer │ coordinated-worker     │ active │ no      │
│ tm_lead_001      │ 👑 Lead      │ Project coordinator  │ coordinator            │ active │ no      │
│ tm_test_001      │ 🧪 Tester    │ QA engineer          │ worker                 │ active │ no      │
└──────────────────┴──────────────┴──────────────────────┴────────────────────────┴────────┴─────────┘
```

### Related Commands

- `maestro team-member get` — Get member details
- `maestro team-member create` — Create a new member

---

## maestro team-member get

Get full details about a team member.

### Syntax

```
maestro team-member get <teamMemberId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID |

### Flags

None.

### Example

```bash
maestro team-member get tm_pro_001
```

```
  ID:              tm_pro_001
  Name:            🤖 Pro
  Role:            Full-stack developer
  Mode:            coordinated-worker
  Model:           opus
  Agent Tool:      claude-code
  Permission Mode: acceptEdits
  Default:         no
  Status:          active
  Identity:        You are a senior full-stack developer. Write clean, tested code.
  Skill IDs:       nodejs-backend, react-frontend
Capabilities:
  can_spawn_sessions: false
  can_edit_tasks: true
  can_report_task_level: true
  can_report_session_level: true
Memory: 2 entries
  1. Always use TypeScript strict mode
  2. Prefer functional components with hooks
```

### Related Commands

- `maestro team-member edit` — Edit member settings
- `maestro team-member memory list` — List memory entries

---

## maestro team-member create

Create a new team member.

### Syntax

```
maestro team-member create <name> --role <role> --avatar <emoji> --mode <mode> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Team member name |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--role <role>` | string | **Required** | Role description |
| `--avatar <emoji>` | string | **Required** | Avatar emoji |
| `--mode <mode>` | string | **Required** | Agent mode: `worker`, `coordinator`, `coordinated-worker`, `coordinated-coordinator` |
| `--model <model>` | string | — | Model (e.g. `sonnet`, `opus`, `haiku`, or native model names) |
| `--agent-tool <tool>` | string | `claude-code` | Agent tool: `claude-code`, `codex`, or `gemini` |
| `--permission-mode <mode>` | string | — | Permission mode: `acceptEdits`, `interactive`, `readOnly`, `bypassPermissions` |
| `--identity <instructions>` | string | — | Custom identity/persona instructions |
| `--skills <skills>` | string | — | Comma-separated skill IDs (e.g. `react-expert,frontend-design`) |

### Example

```bash
maestro team-member create "Pro" \
  --role "Full-stack developer" \
  --avatar "🤖" \
  --mode coordinated-worker \
  --model opus \
  --agent-tool claude-code \
  --identity "You are a senior developer. Write clean, well-tested code." \
  --skills "nodejs-backend,react-frontend"
```

```
✔ Team member created
  ID:         tm_1772040_abc12
  Name:       🤖 Pro
  Role:       Full-stack developer
  Mode:       coordinated-worker
  Model:      opus
  Agent Tool: claude-code
```

### Related Commands

- `maestro team-member list` — List all members
- `maestro team-member edit` — Edit after creation
- `maestro team add-member` — Add to a team

---

## maestro team-member edit

Edit a team member's settings.

### Syntax

```
maestro team-member edit <teamMemberId> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID to edit |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--name <name>` | string | — | Update name |
| `--role <role>` | string | — | Update role description |
| `--avatar <emoji>` | string | — | Update avatar emoji |
| `--mode <mode>` | string | — | Update agent mode |
| `--model <model>` | string | — | Update model |
| `--agent-tool <tool>` | string | — | Update agent tool (`claude-code`, `codex`, `gemini`) |
| `--permission-mode <mode>` | string | — | Update permission mode |
| `--identity <instructions>` | string | — | Update identity/persona instructions |
| `--skills <skills>` | string | — | Update skill IDs (comma-separated) |

### Example

```bash
maestro team-member edit tm_pro_001 --model opus --identity "You are the best."
```

```
✔ Team member updated
  ID:         tm_pro_001
  Name:       🤖 Pro
  Role:       Full-stack developer
  Mode:       coordinated-worker
  Model:      opus
  Agent Tool: claude-code
  Identity:   You are the best.
```

### Related Commands

- `maestro team-member get` — View current settings
- `maestro team-member update-identity` — Update identity only

---

## maestro team-member archive

Archive a team member. Archived members are hidden from default listings.

### Syntax

```
maestro team-member archive <teamMemberId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID to archive |

### Flags

None.

### Example

```bash
maestro team-member archive tm_pro_001
```

```
✔ Team member archived
  ID:     tm_pro_001
  Name:   🤖 Pro
  Status: archived
```

### Related Commands

- `maestro team-member unarchive` — Restore archived member
- `maestro team-member delete` — Delete (requires archiving first)

---

## maestro team-member unarchive

Restore an archived team member to active status.

### Syntax

```
maestro team-member unarchive <teamMemberId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID to unarchive |

### Flags

None.

### Example

```bash
maestro team-member unarchive tm_pro_001
```

```
✔ Team member unarchived
  ID:     tm_pro_001
  Name:   🤖 Pro
  Status: active
```

### Related Commands

- `maestro team-member archive` — Archive a member

---

## maestro team-member delete

Delete a team member. The member must be archived first.

### Syntax

```
maestro team-member delete <teamMemberId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID to delete |

### Flags

None.

### Example

```bash
maestro team-member delete tm_pro_001
```

```
Warning: Team members must be archived before deletion. Use "team-member archive <id>" first.
✔ Team member deleted
  Team member tm_pro_001 deleted.
```

### Related Commands

- `maestro team-member archive` — Archive before deleting

---

## maestro team-member reset

Reset a default team member to its original factory settings.

### Syntax

```
maestro team-member reset <teamMemberId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID to reset |

### Flags

None.

### Example

```bash
maestro team-member reset tm_pro_001
```

```
✔ Team member reset to defaults
  ID:     tm_pro_001
  Name:   🤖 Pro
  Role:   Full-stack developer
  Mode:   worker
  Status: active
```

### Related Commands

- `maestro team-member edit` — Edit specific fields instead

---

## maestro team-member update-identity

Update a team member's identity/persona instructions. Useful for self-awareness updates by the agent itself.

### Syntax

```
maestro team-member update-identity <teamMemberId> --identity <instructions>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--identity <instructions>` | string | **Required** | New identity/persona instructions |

### Example

```bash
maestro team-member update-identity tm_pro_001 \
  --identity "You are a senior backend specialist focused on Node.js and PostgreSQL."
```

```
✔ Identity updated
  ID:       tm_pro_001
  Name:     🤖 Pro
  Identity: You are a senior backend specialist focused on Node.js and PostgreSQL.
```

### Related Commands

- `maestro team-member edit` — Edit any field including identity

---

## maestro team-member memory append

Append a persistent memory entry to a team member. Memory entries are injected into the agent's system prompt across sessions.

### Syntax

```
maestro team-member memory append <teamMemberId> --entry <text>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--entry <text>` | string | **Required** | Memory entry to store |

### Example

```bash
maestro team-member memory append tm_pro_001 --entry "Always use TypeScript strict mode"
```

```
✔ Memory entry added
  ID:             tm_pro_001
  Name:           🤖 Pro
  Memory entries: 3

Memory:
  1. Always use TypeScript strict mode
  2. Prefer functional components with hooks
  3. Always use TypeScript strict mode
```

### Related Commands

- `maestro team-member memory list` — List all memory entries
- `maestro team-member memory clear` — Clear all memory

---

## maestro team-member memory list

List all memory entries for a team member.

### Syntax

```
maestro team-member memory list <teamMemberId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID |

### Flags

None.

### Example

```bash
maestro team-member memory list tm_pro_001
```

```
  ID:             tm_pro_001
  Name:           🤖 Pro
  Memory entries: 2

Memory:
  1. Always use TypeScript strict mode
  2. Prefer functional components with hooks
```

### Related Commands

- `maestro team-member memory append` — Add a memory entry
- `maestro team-member memory clear` — Clear all memory

---

## maestro team-member memory clear

Clear all memory entries for a team member.

### Syntax

```
maestro team-member memory clear <teamMemberId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `teamMemberId` | Yes | Team member ID |

### Flags

None.

### Example

```bash
maestro team-member memory clear tm_pro_001
```

```
✔ Memory cleared
  ID:   tm_pro_001
  Name: 🤖 Pro
  Memory cleared.
```

### Related Commands

- `maestro team-member memory list` — Verify memory is cleared
- `maestro team-member memory append` — Add new entries
