# Skill Commands

Manage Claude Code and Agent skills. Skills are markdown instruction files that extend agent behavior and are injected into the system prompt.

## maestro skill list

List all available skills, grouped by scope.

### Syntax

```
maestro skill list [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project-path <path>` | string | — | Path to the project root for project-scoped skills |
| `--scope <scope>` | string | `all` | Filter by scope: `project`, `global`, or `all` |

### Example

```bash
maestro skill list --scope project
```

```
┌───────────────────────┬───────────────────────────────────────────┬───────┬────────────────────────────────────┐
│ Name                  │ Source                                    │ Valid │ Description                        │
├───────────────────────┼───────────────────────────────────────────┼───────┼────────────────────────────────────┤
│ maestro-worker        │ .claude/skills/maestro-worker/SKILL.md    │ yes   │ Maestro worker agent skill         │
│ react-frontend        │ .claude/skills/react-frontend/SKILL.md    │ yes   │ React frontend development         │
│ nodejs-backend        │ .agents/skills/nodejs-backend/SKILL.md    │ yes   │ Node.js backend patterns           │
└───────────────────────┴───────────────────────────────────────────┴───────┴────────────────────────────────────┘
```

### Related Commands

- `maestro skill info` — Get details about a specific skill
- `maestro skill validate` — Validate all skills

---

## maestro skill info

Get details about a specific skill.

### Syntax

```
maestro skill info <name> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Skill name |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project-path <path>` | string | — | Path to the project root for project-scoped skills |

### Example

```bash
maestro skill info maestro-worker
```

```json
{
  "name": "maestro-worker",
  "scope": "project",
  "source": ".claude/skills/maestro-worker/SKILL.md",
  "valid": true,
  "description": "Maestro worker agent skill for task execution"
}
```

### Related Commands

- `maestro skill list` — List all skills
- `maestro skill validate` — Validate skill format

---

## maestro skill validate

Validate all skills across all scopes. Checks that skill files are properly formatted and loadable.

### Syntax

```
maestro skill validate [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project-path <path>` | string | — | Path to the project root for project-scoped skills |

### Example

```bash
maestro --json skill validate
```

```json
{
  "valid": [
    { "name": "maestro-worker", "scope": "project", "valid": true },
    { "name": "react-frontend", "scope": "global", "valid": true }
  ],
  "invalid": [
    { "name": "broken-skill", "scope": "project", "valid": false }
  ],
  "summary": { "valid": 2, "invalid": 1 }
}
```

### Related Commands

- `maestro skill list` — List all skills
- `maestro skill info` — Check a specific skill

---

## maestro skill install

Install a skill from a GitHub repository. Tries `npx skillsadd` first, falls back to `git clone`.

### Syntax

```
maestro skill install <repo> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `repo` | Yes | GitHub repository in `owner/repo` format |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--scope <scope>` | string | `project` | Install scope: `project` or `global` |
| `--target <target>` | string | `claude` | Target directory: `claude` (`.claude/skills/`) or `agents` (`.agents/skills/`) |
| `--project-path <path>` | string | — | Project root path (required for project scope) |

### Example

```bash
maestro skill install anthropics/react-expert --scope project --project-path /Users/dev/my-app
```

```json
{
  "repo": "anthropics/react-expert",
  "path": "/Users/dev/my-app/.claude/skills/react-expert",
  "scope": "project",
  "source": "claude"
}
```

### Related Commands

- `maestro skill list` — Verify installed skills
- `maestro skill browse` — Discover skills to install

---

## maestro skill browse

Browse available skills on skills.sh. Opens the browser to the skills directory.

### Syntax

```
maestro skill browse [query]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `query` | No | Optional search query |

### Flags

None.

### Example

```bash
maestro skill browse "react testing"
```

Opens `https://skills.sh/search?q=react%20testing` in the default browser.

```bash
maestro --json skill browse "react testing"
```

```json
{
  "url": "https://skills.sh/search?q=react%20testing",
  "query": "react testing"
}
```

### Related Commands

- `maestro skill install` — Install a discovered skill
- `maestro skill list` — List locally installed skills
