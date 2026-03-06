# Manifest Customization

**A manifest is the JSON configuration file that defines everything a Maestro session needs — tasks, model, permissions, team identity, and context. You can generate them automatically or write them by hand for full control.**

---

## What Is a Manifest?

When you spawn a session, Maestro generates a manifest at:

```
~/.maestro/sessions/<session-id>/manifest.json
```

This file is read by the CLI during `worker init` or `orchestrator init`. It contains the tasks, session config, team member identity, memory, skills, and coordination context.

You can inspect any session's manifest:

```bash
cat ~/.maestro/sessions/<session-id>/manifest.json | jq .
```

## Manifest Schema

```typescript
interface MaestroManifest {
  // Required
  manifestVersion: string;          // "1.0"
  mode: AgentMode;                  // 'worker' | 'coordinator' | 'coordinated-worker' | 'coordinated-coordinator'
  tasks: TaskData[];                // At least one task
  session: SessionConfig;           // Model, permissions, etc.

  // Optional — Skills & Tools
  skills?: string[];                // Skill names to load (e.g., ['maestro-worker'])
  agentTool?: AgentTool;            // 'claude-code' | 'codex' | 'gemini'
  referenceTaskIds?: string[];      // Task IDs for reference docs

  // Optional — Team Identity
  teamMemberId?: string;
  teamMemberName?: string;
  teamMemberRole?: string;
  teamMemberAvatar?: string;
  teamMemberIdentity?: string;      // Custom system prompt for the agent
  teamMemberMemory?: string[];      // Persistent memory entries
  teamMemberCapabilities?: Record<string, boolean>;
  teamMemberCommandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };
  teamMemberProfiles?: TeamMemberProfile[];  // Multi-identity profiles

  // Optional — Coordination
  coordinatorSessionId?: string;     // Parent coordinator session
  initialDirective?: {               // Message from coordinator
    subject: string;
    message: string;
    fromSessionId: string;
  };

  // Optional — Coordinator Context
  availableTeamMembers?: TeamMemberData[];  // Workers available for delegation

  // Optional — Workspace
  isMaster?: boolean;
  masterProjects?: MasterProjectInfo[];

  // Optional — Context
  context?: AdditionalContext;
}
```

### TaskData

```typescript
interface TaskData {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];     // At least one criterion
  projectId: string;
  createdAt: string;                // ISO 8601

  // Optional
  parentId?: string | null;
  dependencies?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: TaskStatus;
  metadata?: Record<string, any>;
  images?: Array<{ path: string; filename: string; mimeType: string }>;
}
```

### SessionConfig

```typescript
interface SessionConfig {
  model: string;                    // 'sonnet', 'opus', 'haiku', etc.
  permissionMode: string;           // 'acceptEdits' | 'interactive' | 'readOnly' | 'bypassPermissions'

  // Optional
  thinkingMode?: 'auto' | 'interleaved' | 'disabled';
  maxTurns?: number;
  timeout?: number;                 // Milliseconds
  workingDirectory?: string;
  allowedCommands?: string[];
}
```

### AdditionalContext

```typescript
interface AdditionalContext {
  codebaseContext?: {
    recentChanges?: string[];
    relevantFiles?: string[];
    architecture?: string;
    techStack?: string[];
    dependencies?: Record<string, string>;
  };
  relatedTasks?: Array<{
    id: string;
    title: string;
    relationship: 'blocks' | 'blocked_by' | 'depends_on' | 'related_to';
    status: string;
    description?: string;
  }>;
  projectStandards?: {
    codingStyle?: string;
    testingApproach?: string;
    documentation?: string;
    branchingStrategy?: string;
    cicdPipeline?: string;
    customGuidelines?: string[];
  };
  custom?: Record<string, any>;
}
```

## Generating Manifests

The standard way to create a manifest:

```bash
maestro manifest generate \
  --mode worker \
  --project-id <project-id> \
  --task-ids <task-id-1>,<task-id-2> \
  --skills maestro-worker \
  --model sonnet \
  --agent-tool claude-code \
  --output ~/.maestro/sessions/my-session/manifest.json
```

**Options:**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--mode` | Yes | — | Agent mode |
| `--project-id` | Yes | — | Project context |
| `--task-ids` | Yes | — | Comma-separated task IDs |
| `--output` | Yes | — | Output file path |
| `--skills` | No | `maestro-worker` | Comma-separated skill names |
| `--model` | No | `sonnet` | Model name |
| `--agent-tool` | No | `claude-code` | Agent tool |
| `--team-member-id` | No | — | Single team member ID |
| `--team-member-ids` | No | — | Multiple team member IDs |
| `--reference-task-ids` | No | — | Tasks for reference docs |

## Writing Manifests by Hand

For repeatable workflows or custom configurations, you can write manifests directly.

### Minimal Worker Manifest

```json
{
  "manifestVersion": "1.0",
  "mode": "worker",
  "tasks": [
    {
      "id": "task-001",
      "title": "Fix login bug",
      "description": "The login form throws a 500 error when the email contains a plus sign. Fix the email validation in src/auth/validate.ts.",
      "acceptanceCriteria": [
        "Emails with + sign are accepted",
        "Existing validation still works",
        "Tests pass"
      ],
      "projectId": "proj-001",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}
```

### Worker with Identity and Context

```json
{
  "manifestVersion": "1.0",
  "mode": "worker",
  "tasks": [
    {
      "id": "task-002",
      "title": "Add rate limiting to API",
      "description": "Implement rate limiting on all public API endpoints using a sliding window algorithm.",
      "acceptanceCriteria": [
        "Rate limiting middleware added",
        "Configurable per-endpoint limits",
        "429 responses with Retry-After header"
      ],
      "priority": "high",
      "projectId": "proj-001",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "session": {
    "model": "opus",
    "permissionMode": "acceptEdits",
    "maxTurns": 50,
    "workingDirectory": "/home/user/projects/my-api"
  },
  "skills": ["maestro-worker", "nodejs-backend-patterns"],
  "teamMemberName": "Backend Specialist",
  "teamMemberIdentity": "You are a backend security engineer. Prioritize correctness over speed. Always validate edge cases.",
  "teamMemberMemory": [
    "This project uses Express 5 with TypeScript",
    "Redis is available at localhost:6379 for caching",
    "Run tests with: bun test"
  ],
  "context": {
    "codebaseContext": {
      "relevantFiles": ["src/middleware/", "src/api/routes/"],
      "techStack": ["TypeScript", "Express", "Redis", "PostgreSQL"]
    }
  }
}
```

### Coordinator Manifest with Team

```json
{
  "manifestVersion": "1.0",
  "mode": "coordinator",
  "tasks": [
    {
      "id": "task-003",
      "title": "Implement user dashboard",
      "description": "Build a complete user dashboard with profile, settings, and activity views.",
      "acceptanceCriteria": [
        "Profile page shows user info",
        "Settings page allows updates",
        "Activity page shows recent actions"
      ],
      "projectId": "proj-001",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  },
  "teamMemberProfiles": [
    {
      "id": "tm-coordinator",
      "name": "Coordinator",
      "avatar": "🎯",
      "identity": "You are a project coordinator. Break down work, assign to team members, and verify results."
    }
  ],
  "availableTeamMembers": [
    {
      "id": "tm-frontend",
      "name": "Frontend Dev",
      "role": "Frontend Engineer",
      "avatar": "🎨",
      "identity": "You are a React frontend engineer.",
      "mode": "worker",
      "permissionMode": "acceptEdits",
      "model": "sonnet",
      "agentTool": "claude-code"
    },
    {
      "id": "tm-backend",
      "name": "Backend Dev",
      "role": "Backend Engineer",
      "avatar": "🔧",
      "identity": "You are a Node.js backend engineer.",
      "mode": "worker",
      "permissionMode": "acceptEdits",
      "model": "sonnet",
      "agentTool": "claude-code"
    }
  ]
}
```

### Coordinated Worker Manifest (Spawned by a Coordinator)

```json
{
  "manifestVersion": "1.0",
  "mode": "coordinated-worker",
  "tasks": [
    {
      "id": "task-004",
      "title": "Build profile API",
      "description": "Create REST endpoints for user profile CRUD operations.",
      "acceptanceCriteria": ["GET /profile/:id works", "PATCH /profile/:id works"],
      "projectId": "proj-001",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  },
  "coordinatorSessionId": "sess-parent-123",
  "initialDirective": {
    "subject": "Build the profile API",
    "message": "Implement the profile endpoints. Use the existing user model in src/models/user.ts. Report progress at each milestone.",
    "fromSessionId": "sess-parent-123"
  }
}
```

## Overriding Defaults

Hand-written manifests let you override anything the auto-generator produces:

| Override | Field | Example |
|----------|-------|---------|
| Use a different model | `session.model` | `"opus"` for complex tasks |
| Restrict permissions | `session.permissionMode` | `"readOnly"` for review-only agents |
| Limit execution | `session.maxTurns` | `30` turns maximum |
| Set thinking mode | `session.thinkingMode` | `"interleaved"` for reasoning-heavy tasks |
| Custom identity | `teamMemberIdentity` | Full custom prompt |
| Inject memory | `teamMemberMemory` | `["Always use bun", "DB is PostgreSQL"]` |
| Add codebase context | `context.codebaseContext` | Relevant files, tech stack |
| Restrict commands | `teamMemberCommandPermissions` | Whitelist specific CLI commands |

## Use Case: Pre-Configured Launch Configs

Create saved manifest templates for common workflows:

```bash
# Save a template
cat > ~/.maestro/templates/bug-fix.json << 'EOF'
{
  "manifestVersion": "1.0",
  "mode": "worker",
  "tasks": [],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits",
    "maxTurns": 30
  },
  "skills": ["maestro-worker"],
  "teamMemberIdentity": "You are a bug fixer. Read the bug report, locate the issue, fix it, and verify the fix with tests. Be methodical."
}
EOF
```

Then modify and use:

```bash
# Copy template, add task details, spawn
cp ~/.maestro/templates/bug-fix.json ~/.maestro/sessions/sess-new/manifest.json
# Edit the tasks array with actual task data
# Set MAESTRO_MANIFEST_PATH and run
```

## Validation

Manifests are validated against a JSON schema on load. The validation checks:

- `manifestVersion` is present
- `mode` is one of the six valid values (4 canonical + 2 legacy)
- `tasks` array has at least one entry
- Each task has `id`, `title`, `description`, `acceptanceCriteria` (non-empty), `projectId`, `createdAt`
- `session` has `model` and `permissionMode`

Legacy modes (`execute`, `coordinate`) are automatically normalized to their canonical equivalents during reading.
