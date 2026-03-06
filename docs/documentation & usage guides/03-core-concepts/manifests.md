# Manifests

**A manifest is a JSON configuration file that tells Claude everything it needs to know when starting a session. It's the bridge between Maestro's data and Claude's system prompt.**

---

## What is a Manifest?

When Maestro spawns a session, it doesn't just launch Claude in a terminal. It generates a manifest — a JSON file containing the session's mode, tasks, skills, team member profile, model, and permissions. Claude reads this manifest to understand who it is, what it's supposed to do, and how to report back.

```
~/.maestro/sessions/<session-id>/manifest.json
```

Every session has exactly one manifest. No manifest, no context. The manifest is what turns a generic Claude session into a Maestro-aware agent.

## Why Manifests Matter

Manifests solve the bootstrap problem: how does Claude know what to do when it first starts up? The answer is the manifest. It contains:

- **What to do** — the tasks, with titles, descriptions, and priorities
- **How to behave** — the mode (worker/coordinator), permissions, model
- **Who to be** — the team member profile, identity, memory
- **What tools to use** — skills to load, agent tool to use

Without manifests, you'd have to manually type all this context into every session.

## Manifest Data Model

```typescript
interface MaestroManifest {
  // Core
  manifestVersion: string;         // "1.0"
  mode: AgentMode;                 // 'worker' | 'coordinator' | 'coordinated-worker' | 'coordinated-coordinator'
  tasks: TaskData[];               // Array of tasks to work on
  session: SessionConfig;          // Model, permissions, working directory

  // Skills
  skills?: string[];               // Skill names to load (default: ['maestro-worker'])

  // Agent configuration
  agentTool?: AgentTool;           // 'claude-code' | 'codex' | 'gemini'

  // Team member identity
  teamMemberId?: string;
  teamMemberName?: string;
  teamMemberRole?: string;
  teamMemberAvatar?: string;
  teamMemberIdentity?: string;     // Custom system prompt
  teamMemberMemory?: string[];     // Persistent memory entries
  teamMemberCapabilities?: Record<string, boolean>;
  teamMemberCommandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };

  // Coordination
  coordinatorSessionId?: string;   // Parent coordinator (if coordinated mode)
  initialDirective?: {             // Message from coordinator
    subject: string;
    message: string;
    fromSessionId: string;
  };

  // Multi-identity (advanced)
  teamMemberProfiles?: TeamMemberProfile[];
  availableTeamMembers?: TeamMemberData[];

  // Master projects (advanced)
  isMaster?: boolean;
  masterProjects?: MasterProjectInfo[];

  // Reference
  referenceTaskIds?: string[];     // Additional task context
  context?: AdditionalContext;     // Codebase/project context
}
```

### SessionConfig

```typescript
interface SessionConfig {
  model: string;                   // 'opus' | 'sonnet' | 'haiku'
  permissionMode: string;         // 'acceptEdits' | 'interactive' | 'readOnly' | 'bypassPermissions'
  thinkingMode?: string;          // 'auto' (default)
  maxTurns?: number;              // Maximum agentic turns
  timeout?: number;               // Session timeout
  workingDirectory?: string;      // Project filesystem path
  allowedCommands?: string[];     // Allowed shell commands
}
```

### TaskData

```typescript
interface TaskData {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria?: string[];
  parentId?: string;
  dependencies?: string[];
  priority: string;
  projectId: string;
  status?: string;
  sessionIds?: string[];
  metadata?: Record<string, any>;
}
```

## How Manifests Are Generated

Manifests are generated automatically. You rarely need to create one by hand.

### Automatic generation (most common)

When you spawn a session, the server generates the manifest:

```bash
maestro session spawn --task <task-id> --model opus
```

Behind the scenes:
1. Server calls `maestro manifest generate` with the session parameters
2. The generator fetches task data, project info, and team member profile
3. It assembles the manifest JSON
4. Manifest is validated against a JSON Schema
5. Written to `~/.maestro/sessions/<session-id>/manifest.json`

### Manual generation

```bash
maestro manifest generate \
  --mode worker \
  --project-id <project-id> \
  --task-ids <task-id-1>,<task-id-2> \
  --skills my-skill,code-review \
  --model opus \
  --agent-tool claude-code \
  --team-member-id <member-id> \
  --output ./my-manifest.json
```

## A Real Manifest

Here's what a generated manifest looks like:

```json
{
  "manifestVersion": "1.0",
  "mode": "coordinated-worker",
  "tasks": [
    {
      "id": "task_abc123",
      "title": "Build the login page",
      "description": "Create a login form with email/password, client-side validation, and Google OAuth. Use React + Tailwind.",
      "acceptanceCriteria": [
        "Form validates email format",
        "Password requires 8+ chars",
        "Google OAuth redirects correctly",
        "All tests pass"
      ],
      "priority": "high",
      "projectId": "proj_xyz789"
    }
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits",
    "thinkingMode": "auto",
    "workingDirectory": "/Users/you/projects/my-app"
  },
  "skills": ["maestro-worker", "ts-api-standards"],
  "agentTool": "claude-code",
  "teamMemberId": "tm_alice",
  "teamMemberName": "Alice",
  "teamMemberRole": "Frontend Engineer",
  "teamMemberAvatar": "👩‍💻",
  "teamMemberIdentity": "You are a senior frontend engineer specializing in React and TypeScript.",
  "teamMemberMemory": [
    "This project uses React 18 with TypeScript 5",
    "Auth module uses JWT with RS256 signing"
  ],
  "teamMemberCapabilities": {
    "can_edit_tasks": true,
    "can_report_task_level": true,
    "can_report_session_level": true,
    "can_spawn_sessions": false
  },
  "coordinatorSessionId": "sess_coord_456"
}
```

### Field by field

| Field | What it does |
|-------|-------------|
| `manifestVersion` | Schema version. Always `"1.0"` for now. |
| `mode` | Determines the Maestro system prompt and plugin loaded. |
| `tasks` | The work to do. Claude reads these to understand its assignment. |
| `session.model` | Which Claude model to use. |
| `session.permissionMode` | How much autonomy Claude has with files. |
| `session.workingDirectory` | Where Claude's terminal starts. |
| `skills` | Extra instruction sets loaded as plugins. |
| `agentTool` | Which AI tool to spawn (`claude-code`, `codex`, or `gemini`). |
| `teamMember*` | The agent's persona — name, role, identity, memory. |
| `coordinatorSessionId` | Who spawned this session (for coordinated modes). |

## Advanced: Writing Manifests by Hand

For custom workflows, you can write manifests manually and spawn sessions with them:

```bash
# Generate a base manifest
maestro manifest generate \
  --mode worker \
  --project-id <id> \
  --task-ids <task-id> \
  --output ./custom-manifest.json

# Edit it to your needs
# (add custom context, tweak permissions, etc.)

# Use it with the MAESTRO_MANIFEST_PATH env var
MAESTRO_MANIFEST_PATH=./custom-manifest.json maestro worker init
```

This is useful when you want full control over what Claude sees — for example, injecting custom context that isn't stored as a task or skill.

## Multi-Identity Manifests

When a session is assigned multiple team member profiles, the manifest merges them:

- **Model:** Most powerful wins (`opus` > `sonnet` > `haiku`)
- **Agent tool:** First non-default wins
- **Permission mode:** First member's setting wins
- **Capabilities:** Union of all (if any member allows it, it's allowed)
- **Command permissions:** Most permissive union

```bash
maestro session spawn --task <task-id> --team-member-ids <id-1>,<id-2>
```

The manifest will contain a `teamMemberProfiles` array with both identities.

## Manifest Validation

Every manifest is validated against a JSON Schema before it's written. If the manifest is invalid (missing required fields, wrong types), generation fails with a clear error.

```bash
# The validation happens automatically, but you can see it with:
maestro manifest generate --mode worker --project-id <id> --task-ids <id> --output test.json
```

If something is wrong, you'll get a validation error explaining what's missing or malformed.

> **Next:** [Execution Strategies](./execution-strategies.md) — How tasks are assigned and processed.
