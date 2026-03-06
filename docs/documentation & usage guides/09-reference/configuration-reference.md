# Configuration reference

> All config files, data paths, environment variables, and CLI flags.

---

## Data directory structure

Maestro stores all data as JSON files on disk. No database required.

```
~/.maestro/
├── config                              # Server URL configuration
├── bin/
│   ├── maestro                         # CLI binary
│   └── maestro-server                  # Server binary
├── data/
│   ├── projects/<id>.json              # Project records
│   ├── tasks/<id>.json                 # Task records
│   ├── sessions/<id>.json              # Session records
│   ├── task-lists/<id>.json            # Task list records
│   ├── team-members/<projectId>.json   # Team members (per project)
│   ├── teams/<projectId>.json          # Teams (per project)
│   ├── orderings/                      # UI display orderings
│   ├── modals/                         # Agent-generated modal HTML
│   └── images/<projectId>/<taskId>/    # Task image attachments
└── sessions/<id>/
    └── manifest.json                   # Session manifest (generated at spawn)
```

---

## Config file

**Location:** `~/.maestro/config`

Contains the server URL. Read by the CLI to locate the API.

```
MAESTRO_API_URL=http://localhost:3000
```

---

## Manifest file

**Location:** `~/.maestro/sessions/<sessionId>/manifest.json`

Generated at spawn time by `maestro manifest generate`. Contains the full configuration for a session.

```typescript
interface MaestroManifest {
  manifestVersion: string;          // Schema version
  mode: AgentMode;                  // worker | coordinator | coordinated-worker | coordinated-coordinator
  tasks: TaskData[];                // Task payloads
  session: SessionConfig;           // Session ID, project ID, env vars
  skills?: string[];                // Skill names to load
  agentTool?: AgentTool;            // claude-code | codex | gemini
  teamMemberId?: string;            // Primary team member identity
  teamMemberName?: string;          // Display name
  teamMemberIdentity?: string;      // Persona/identity prompt
  teamMemberMemory?: string[];      // Persistent memory entries
  teamMemberCapabilities?: Record<string, boolean>;  // Capability flags
  coordinatorSessionId?: string;    // Parent coordinator (coordinated modes)
  isMaster?: boolean;               // Cross-project access enabled
  masterProjects?: MasterProjectInfo[];  // Available projects (master mode)
}
```

---

## Skills locations

Skills are markdown instruction files loaded into a session's system prompt.

| Scope | Path pattern |
|-------|-------------|
| Global (Claude) | `~/.claude/skills/<name>/SKILL.md` |
| Global (Agents) | `~/.agents/skills/<name>/SKILL.md` |
| Project (Claude) | `<projectDir>/.claude/skills/<name>/SKILL.md` |
| Project (Agents) | `<projectDir>/.agents/skills/<name>/SKILL.md` |

Project-scoped skills override global skills of the same name.

---

## Environment variables

### Server

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | Server listen port. Production uses `2357`. |
| `HOST` | string | `0.0.0.0` | Server bind address. |

### CLI — Session context

Set automatically when a session spawns. Used by CLI commands inside a running session.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MAESTRO_API_URL` | string | `http://localhost:3000` | Server URL for API calls. |
| `MAESTRO_SERVER_URL` | string | — | Alias for `MAESTRO_API_URL` (CLI reads this). |
| `MAESTRO_PROJECT_ID` | string | — | Current project ID. |
| `MAESTRO_SESSION_ID` | string | — | Current session ID. |
| `MAESTRO_TASK_IDS` | string | — | Comma-separated task IDs assigned to this session. |
| `MAESTRO_ROLE` | string | — | `worker` or `orchestrator` (legacy). |
| `MAESTRO_MODE` | string | — | Full four-mode value (worker, coordinator, etc.). |
| `MAESTRO_MANIFEST_PATH` | string | — | Absolute path to the session's `manifest.json`. |

### CLI — Spawn-time variables

Set by the server when generating a manifest. Consumed by `maestro manifest generate`.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MAESTRO_INITIAL_DIRECTIVE` | JSON string | — | Initial directive object for coordinated sessions. |
| `MAESTRO_COORDINATOR_SESSION_ID` | string | — | Parent coordinator's session ID. |
| `MAESTRO_IS_MASTER` | string | — | `"true"` if this is a master session. |
| `MAESTRO_MEMBER_OVERRIDES` | JSON string | — | Per-member launch overrides (serialized JSON). |
| `MAESTRO_PERMISSION_MODE` | string | — | Session-level permission mode override. |
| `MAESTRO_DELEGATE_PERMISSION_MODE` | string | — | Permission mode for spawned workers (coordinators). |

---

## CLI global flags

These flags work with any `maestro` subcommand.

| Flag | Description |
|------|-------------|
| `--json` | Output machine-readable JSON instead of human-friendly text. |
| `--help` | Show help for any command. |

---

## Server ports

| Environment | Port | Notes |
|-------------|------|-------|
| Development | `3000` | Default `PORT` value. |
| Production | `2357` | Set by `install.sh` for the installed server binary. |

---

## Installation paths

| Component | Path |
|-----------|------|
| CLI binary | `~/.maestro/bin/maestro` |
| Server binary | `~/.maestro/bin/maestro-server` |
| Desktop app (macOS) | `/Applications/Maestro.app` |
| Data directory | `~/.maestro/data/` |
| Session manifests | `~/.maestro/sessions/` |
| Config file | `~/.maestro/config` |

---

> **See also:** [API reference](./api-reference.md) for endpoint details, [Glossary](./glossary.md) for term definitions.
