# Manifest Schema Specification

## Overview

The manifest is a JSON file that contains all the data needed for a Maestro session. It is the single source of truth for task execution.

## Core Principles

1. **Self-Contained**: Everything needed is in the manifest
2. **Portable**: Can be copied, versioned, archived
3. **Readable**: Human-readable JSON, easy to inspect
4. **Validatable**: Strict schema with validation

## Manifest Location

Manifests are stored at:
```
~/.maestro/sessions/{SESSION_ID}/manifest.json
```

This allows:
- Easy session management
- Session archival
- Session recovery
- Debugging and inspection

## Multi-Task Model

**IMPORTANT**: Maestro uses a **multi-task model** as the primary architecture.

### Key Concepts

- **tasks: TaskData[]** - Always an array, even for single tasks
- **Single-task sessions** - Simply an array with one task: `tasks: [task1]`
- **Multi-task sessions** - Array with multiple tasks: `tasks: [task1, task2, task3]`
- **Primary task** - First task in the array (`tasks[0]`)
- **Task IDs** - Comma-separated when passing to CLI: `--task-ids task-1,task-2,task-3`

### Why Multi-Task?

1. **Consistency**: One model for all cases
2. **Flexibility**: Worker can handle multiple related tasks
3. **Orchestration**: Orchestrator can coordinate multiple tasks
4. **Simplicity**: No special handling for single vs multi

### Migration from Single-Task

If you have old manifests with `task: TaskData`, convert to:
```typescript
// Old (deprecated)
{ task: { id: "task-1", ... } }

// New (current)
{ tasks: [{ id: "task-1", ... }] }
```

---

## Complete Schema

### TypeScript Definition

```typescript
interface MaestroManifest {
  // Schema version for future compatibility
  manifestVersion: string;

  // Role determines which system prompt to use
  role: 'worker' | 'orchestrator';

  // Worker strategy (for worker role only)
  // 'simple' - Traditional single/multi-task execution
  // 'queue' - FIFO queue-based task processing
  strategy?: 'simple' | 'queue';

  // Core task data - ALWAYS an array
  // Single-task: tasks: [task1]
  // Multi-task: tasks: [task1, task2, task3]
  // Primary task is always tasks[0]
  tasks: TaskData[];

  // Optional standard skills to load
  skills?: string[];

  // Claude Code session configuration
  session: SessionConfig;

  // Optional: Additional context
  context?: AdditionalContext;

  // Optional: Template ID for server-side prompt generation
  templateId?: string;
}

interface TaskData {
  // Unique task identifier
  id: string;

  // Task title (short, descriptive)
  title: string;

  // Detailed task description
  description: string;

  // Parent task ID (for hierarchical tasks)
  // If null, this is a root task
  parentId?: string | null;

  // What must be true when task is complete
  acceptanceCriteria: string[];

  // IDs of tasks that must complete first
  dependencies?: string[];

  // Priority level
  priority?: 'low' | 'medium' | 'high' | 'critical';

  // Project this task belongs to
  projectId: string;

  // When task was created
  createdAt: string; // ISO 8601

  // Custom metadata (extensible)
  metadata?: Record<string, any>;

  // UNIFIED STATUS MODEL
  // Task status (single source of truth)
  // Optional in manifests - will be set by server
  status?: TaskStatus;

  // Session tracking
  sessionIds?: string[];
  activeSessionId?: string;
}

// Unified task status types
type TaskStatus =
  | 'todo'          // Not yet started
  | 'in_progress'   // Actively being worked on
  | 'completed'     // Work finished
  | 'cancelled'     // Cancelled
  | 'blocked';      // Blocked by dependency or issue

// Who triggered a status change
type UpdateSource = 'user' | 'session';

interface SessionConfig {
  // Claude model to use
  model: 'sonnet' | 'opus' | 'haiku';

  // Permission mode
  permissionMode: 'acceptEdits' | 'interactive' | 'readOnly';

  // Thinking mode
  thinkingMode?: 'auto' | 'interleaved' | 'disabled';

  // Maximum turns before auto-exit
  maxTurns?: number;

  // Session timeout in milliseconds
  timeout?: number;

  // Working directory for Claude session
  workingDirectory?: string;

  // Explicit list of allowed commands for this session
  // If not specified, defaults are determined by role and strategy
  // Format: 'command' or 'parent:subcommand'
  // Examples: 'task:list', 'queue:start', 'whoami'
  allowedCommands?: string[];
}

interface AdditionalContext {
  // Pre-analyzed codebase structure
  codebaseContext?: CodebaseContext;

  // Related tasks for context
  relatedTasks?: RelatedTask[];

  // Project-wide standards and conventions
  projectStandards?: ProjectStandards;

  // Custom context (extensible)
  custom?: Record<string, any>;
}

interface CodebaseContext {
  // Relevant files identified during analysis
  relevantFiles?: string[];

  // Codebase patterns and conventions
  patterns?: {
    fileStructure?: string;
    namingConventions?: string;
    architectureNotes?: string;
  };

  // Testing setup information
  testingSetup?: {
    framework?: string;
    testLocation?: string;
    runCommand?: string;
  };

  // Build and development commands
  commands?: {
    install?: string;
    dev?: string;
    build?: string;
    test?: string;
  };
}

interface RelatedTask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  relationship: 'dependency' | 'related' | 'blocking';
  summary?: string;
}

interface ProjectStandards {
  // Code style preferences
  codeStyle?: {
    formatter?: string;
    linter?: string;
    conventions?: string;
  };

  // Testing requirements
  testing?: {
    required: boolean;
    minimumCoverage?: number;
    frameworks?: string[];
  };

  // Documentation requirements
  documentation?: {
    required: boolean;
    format?: string;
  };

  // Git workflow
  gitWorkflow?: {
    branchNaming?: string;
    commitConventions?: string;
    prProcess?: string;
  };
}
```

## Worker Strategies

**NEW FEATURE**: Maestro supports different worker strategies for task execution.

### Available Strategies

#### 1. Simple Strategy (Default)

Traditional single or multi-task execution:
- Worker processes one or more assigned tasks
- Tasks are known upfront in the manifest
- Suitable for focused, pre-defined work

```json
{
  "role": "worker",
  "strategy": "simple",  // or omit (defaults to simple)
  "tasks": [
    { "id": "task-1", "title": "Implement feature" }
  ]
}
```

#### 2. Queue Strategy

FIFO (First-In-First-Out) queue-based task processing:
- Worker processes tasks from a queue managed by the server
- Tasks are pulled dynamically using queue commands
- Suitable for batch processing and sequential workflows

```json
{
  "role": "worker",
  "strategy": "queue",
  "tasks": []  // Empty - tasks pulled from server queue
}
```

**Queue Commands** (only available with `strategy: "queue"`):
- `maestro queue top` - Show next task in queue
- `maestro queue start` - Start processing next task
- `maestro queue complete` - Mark current task as completed
- `maestro queue fail` - Mark current task as failed
- `maestro queue skip` - Skip current task
- `maestro queue list` - List all queue items

### Strategy Selection

**Set by**: Server/UI when generating manifest
**Determines**: Available CLI commands and workflow
**Check current**: `maestro whoami` shows current strategy

---

## Two-Status Model

**IMPLEMENTATION**: Maestro uses a **two-status model** with strict ownership separation between task status and session status.

### Philosophy

Tasks have two independent status fields with different owners:

- **Task Status** (`status`) - Controlled by the **user or orchestrator** only. Represents the overall task lifecycle.
- **Session Status** (`sessionStatus`) - Controlled by **worker sessions** via `maestro report` commands. Represents what the agent is doing right now.

This strict separation ensures:
- ✅ Users/orchestrators maintain full control over task lifecycle
- ✅ Workers cannot accidentally change task status
- ✅ Session status provides real-time agent activity
- ✅ Clean ownership boundaries

### Status Types

#### Task Status (`status`) - User/Orchestrator Controlled

| Value | Meaning | Set By |
|-------|---------|--------|
| `todo` | Not yet started | User/Orchestrator |
| `in_progress` | Actively being worked on | System (auto on session start) or Orchestrator |
| `completed` | Work finished | User/Orchestrator only |
| `cancelled` | Cancelled | User only |
| `blocked` | Blocked by dependency or issue | User/Orchestrator |

**Workers cannot modify `task.status`**. The `task:update`, `task:complete`, and `task:block` commands are restricted to the orchestrator role.

#### Session Status (`sessionStatus`) - Worker Controlled

| Value | Meaning | Set By |
|-------|---------|--------|
| `working` | Agent is actively working | `maestro report progress` |
| `blocked` | Agent is blocked | `maestro report blocked` |
| `needs_input` | Agent needs user input | `maestro report needs-input` |
| `completed` | Agent completed work | `maestro report complete` |
| `failed` | Agent encountered error | `maestro report error` |

Session status is stored on the task record but only modified by worker sessions via `report` commands.

### Status Workflow Example

```
1. Task Created (User/Orchestrator)
   status: 'todo'
   sessionStatus: null

2. Session Spawned (System)
   status: 'in_progress' (auto-updated)
   sessionStatus: null

3. Agent Working (Worker)
   $ maestro report progress "Implementing feature"
   status: 'in_progress' (unchanged - worker cannot modify)
   sessionStatus: 'working'

4. Agent Blocked (Worker)
   $ maestro report blocked "Need API credentials"
   status: 'in_progress' (unchanged - worker cannot modify)
   sessionStatus: 'blocked'

5. User Unblocks (User via UI)
   status: 'in_progress' (unchanged, or user sets to 'blocked' if needed)
   sessionStatus: 'blocked' (unchanged until agent resumes)

6. Agent Completes (Worker)
   $ maestro report complete "All criteria met"
   status: 'in_progress' (unchanged - worker cannot modify)
   sessionStatus: 'completed'

7. User Reviews and Completes (User/Orchestrator)
   status: 'completed' (user/orchestrator decision)
   sessionStatus: 'completed'
```

### Report Commands

Workers report session status via `maestro report` commands. Report commands support an optional `--task` flag for explicit targeting:

- **With `--task task-1`**: Updates `sessionStatus` on task-1 + posts timeline event
- **With `--task task-1,task-2`**: Updates multiple tasks
- **Without `--task`**: Posts session timeline event only (no task sessionStatus change)
- **Special: `report complete` without `--task`**: Also marks the session as completed

```bash
# Report progress on specific task (sessionStatus → working)
maestro report progress "Implementing authentication" --task task-1

# Report progress (session timeline only, no task update)
maestro report progress "Implementing authentication"

# Report blocker on task (sessionStatus → blocked)
maestro report blocked "Need API credentials from team" --task task-1

# Request input (sessionStatus → needs_input)
maestro report needs-input "Should I use JWT or sessions?" --task task-1

# Report completion on task (sessionStatus → completed)
maestro report complete "All acceptance criteria met" --task task-1

# Report completion without --task (posts timeline + marks session completed)
maestro report complete "All acceptance criteria met"

# Report error (sessionStatus → failed)
maestro report error "Tests failing due to dependency issue" --task task-1
```

**Note**: Workers are CLI-blocked from `task:update`, `task:complete`, and `task:block` via the command permissions system. Workers must use `maestro report` commands to communicate status.

### API Endpoints

#### Report Session Status (Worker via `maestro report`)

Each report command makes two API calls:

**1. Update sessionStatus on task:**
```http
PATCH /api/tasks/{taskId}

{
  "sessionStatus": "working",
  "updateSource": "session",
  "sessionId": "sess-123"
}
```

**2. Add timeline event to session:**
```http
POST /api/sessions/{sessionId}/timeline

{
  "type": "progress",
  "message": "Implementing authentication endpoints",
  "taskId": "task-123"
}
```

### Key Differences from Task Commands

| Aspect | `maestro report` (Worker) | `maestro task update/complete/block` (Orchestrator) |
|--------|---------------------------|-----------------------------------------------------|
| **Modifies** | `sessionStatus` | `status` |
| **Available to** | Worker + Orchestrator | Orchestrator only |
| **Purpose** | Report agent activity | Control task lifecycle |
| **Timeline** | Posts to session timeline | N/A |

### Benefits

✅ **Clear Ownership**: Workers control sessionStatus, users/orchestrators control status
✅ **Safety**: Workers cannot accidentally complete or cancel tasks
✅ **Real-time Updates**: sessionStatus provides live agent activity without affecting task lifecycle
✅ **Persistence**: Task status survives across multiple sessions
✅ **Audit Trail**: Timeline events on sessions track all worker reports

## Example Manifests

### Worker Manifest (Minimal)

```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [
    {
      "id": "task-123",
      "title": "Implement user authentication",
      "description": "Add JWT-based authentication with login and logout endpoints",
      "parentId": null,
      "acceptanceCriteria": [
        "Users can register with email and password",
        "Users can login and receive JWT token",
        "Protected routes require valid JWT",
        "Users can logout"
      ],
      "projectId": "proj-1",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "skills": [],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}
```

### Worker Manifest (Complete)

```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [
    {
      "id": "task-456",
      "title": "Implement user authentication",
      "description": "Add JWT-based authentication system with refresh tokens, password hashing, and secure session management",
      "parentId": null,
      "acceptanceCriteria": [
        "Users can register with email and password",
        "Passwords are hashed with bcrypt (cost factor 10+)",
        "Users can login and receive JWT access token",
        "Access tokens expire after 15 minutes",
        "Refresh tokens are implemented and stored securely",
        "Protected routes validate JWT tokens",
        "Invalid tokens return 401 Unauthorized",
        "All authentication endpoints have integration tests"
      ],
      "dependencies": ["task-100", "task-101"],
      "priority": "high",
      "projectId": "proj-1",
      "createdAt": "2026-02-02T10:00:00Z",
      "metadata": {
        "epic": "User Management",
        "sprint": "Sprint 5",
        "assignedBy": "user-789"
      }
    }
  ],
  "skills": [
    "code-visualizer"
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits",
    "thinkingMode": "auto",
    "maxTurns": 50,
    "timeout": 3600000,
    "workingDirectory": "/Users/dev/projects/my-app"
  },
  "context": {
    "codebaseContext": {
      "relevantFiles": [
        "src/models/User.js",
        "src/routes/auth.js",
        "src/middleware/auth.js"
      ],
      "patterns": {
        "fileStructure": "MVC pattern with routes, controllers, models, middleware",
        "namingConventions": "camelCase for variables, PascalCase for classes",
        "architectureNotes": "Express.js REST API with MongoDB"
      },
      "testingSetup": {
        "framework": "Jest + Supertest",
        "testLocation": "src/__tests__/",
        "runCommand": "npm test"
      },
      "commands": {
        "install": "npm install",
        "dev": "npm run dev",
        "build": "npm run build",
        "test": "npm test"
      }
    },
    "relatedTasks": [
      {
        "id": "task-100",
        "title": "Setup database schema",
        "status": "completed",
        "relationship": "dependency",
        "summary": "Created MongoDB schema with User collection"
      },
      {
        "id": "task-101",
        "title": "Setup Express server",
        "status": "completed",
        "relationship": "dependency",
        "summary": "Basic Express server with middleware configured"
      }
    ],
    "projectStandards": {
      "codeStyle": {
        "formatter": "prettier",
        "linter": "eslint",
        "conventions": "Airbnb style guide"
      },
      "testing": {
        "required": true,
        "minimumCoverage": 80,
        "frameworks": ["jest", "supertest"]
      },
      "documentation": {
        "required": true,
        "format": "JSDoc for functions, README for APIs"
      },
      "gitWorkflow": {
        "branchNaming": "feature/task-{id}-{description}",
        "commitConventions": "Conventional Commits (feat, fix, docs, etc.)",
        "prProcess": "PR requires 1 approval, all tests must pass"
      }
    }
  }
}
```

### Orchestrator Manifest (Single Task)

```json
{
  "manifestVersion": "1.0",
  "role": "orchestrator",
  "tasks": [
    {
      "id": "project-init",
      "title": "Setup new e-commerce platform",
      "description": "Initialize project structure, decompose into tasks, and coordinate implementation of core features including product catalog, shopping cart, and checkout",
      "parentId": null,
      "acceptanceCriteria": [
        "Project structure is initialized",
        "All major features are decomposed into tasks",
        "Tasks are properly sequenced with dependencies",
        "Worker sessions are spawned for independent tasks"
      ],
      "priority": "critical",
      "projectId": "proj-ecommerce",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "skills": [],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits",
    "thinkingMode": "auto"
  },
  "context": {
    "projectStandards": {
      "codeStyle": {
        "formatter": "prettier",
        "linter": "eslint"
      },
      "testing": {
        "required": true,
        "minimumCoverage": 80
      },
      "gitWorkflow": {
        "branchNaming": "feature/task-{id}",
        "commitConventions": "Conventional Commits"
      }
    }
  }
}
```

### Multi-Task Worker Manifest

```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [
    {
      "id": "task-101",
      "title": "Implement user registration",
      "description": "Create registration endpoint with validation",
      "parentId": "task-100",
      "acceptanceCriteria": [
        "POST /auth/register endpoint created",
        "Email and password validation implemented",
        "User created in database"
      ],
      "priority": "high",
      "projectId": "proj-1",
      "createdAt": "2026-02-02T10:00:00Z"
    },
    {
      "id": "task-102",
      "title": "Implement user login",
      "description": "Create login endpoint with JWT generation",
      "parentId": "task-100",
      "acceptanceCriteria": [
        "POST /auth/login endpoint created",
        "JWT token generated on successful login",
        "Invalid credentials return 401"
      ],
      "priority": "high",
      "projectId": "proj-1",
      "createdAt": "2026-02-02T10:00:00Z"
    },
    {
      "id": "task-103",
      "title": "Implement password reset",
      "description": "Create password reset flow with email verification",
      "parentId": "task-100",
      "acceptanceCriteria": [
        "POST /auth/reset endpoint created",
        "Reset email sent with token",
        "Password can be reset with valid token"
      ],
      "priority": "medium",
      "projectId": "proj-1",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "skills": ["code-visualizer"],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  },
  "context": {
    "relatedTasks": [
      {
        "id": "task-100",
        "title": "Authentication System",
        "relationship": "blocks",
        "status": "in_progress",
        "description": "Parent task for all auth features"
      }
    ]
  }
}
```

### Queue Strategy Worker Manifest

```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "strategy": "queue",
  "tasks": [],
  "skills": [],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits",
    "allowedCommands": [
      "whoami",
      "commands",
      "queue:top",
      "queue:start",
      "queue:complete",
      "queue:fail",
      "queue:skip",
      "queue:list",
      "report:progress",
      "report:blocked",
      "report:needs-input",
      "report:error"
    ]
  },
  "context": {
    "custom": {
      "queueInfo": "Tasks will be pulled from server queue dynamically"
    }
  }
}
```

**Queue Strategy Notes**:
- `tasks` array is empty - tasks are pulled from server queue
- `strategy: "queue"` enables queue-specific commands
- `allowedCommands` explicitly lists available commands
- Agent uses `maestro queue start` to begin processing next task
- Agent uses `maestro queue complete/fail/skip` to finish current task

## Validation Rules

### Required Fields

**All manifests must have:**
- `manifestVersion` (currently "1.0")
- `role` ("worker" or "orchestrator")
- `tasks` array (must have at least 1 task, unless using queue strategy) with each task having:
  - `id`
  - `title`
  - `description`
  - `acceptanceCriteria` (array, must have at least 1)
  - `projectId`
  - `createdAt`
- `session` object with:
  - `model`
  - `permissionMode`

**Exception**: Queue strategy workers can have empty `tasks` array

### Optional Fields

Everything else is optional and has sensible defaults.

### Validation Examples

```typescript
// Valid - minimal manifest
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [{
    "id": "t1",
    "title": "Fix bug",
    "description": "Fix login bug",
    "parentId": null,
    "acceptanceCriteria": ["Bug is fixed"],
    "projectId": "p1",
    "createdAt": "2026-02-02T10:00:00Z"
  }],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}

// Valid - queue strategy with empty tasks
{
  "manifestVersion": "1.0",
  "role": "worker",
  "strategy": "queue",
  "tasks": [],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}

// Invalid - missing required fields
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [{
    "id": "t1",
    "title": "Fix bug"
    // Missing description, acceptanceCriteria, etc.
  }]
}

// Invalid - wrong role value
{
  "manifestVersion": "1.0",
  "role": "reviewer", // Only "worker" or "orchestrator" allowed
  ...
}
```

## Manifest Generation

### From UI

```typescript
// CLI generates manifest via `maestro manifest generate` command
// Server calls this command during spawn API
function generateWorkerManifest(task: Task, options: SpawnOptions): MaestroManifest {
  return {
    manifestVersion: "1.0",
    role: "worker",
    tasks: [
      {
        id: task.id,
        title: task.title,
        description: task.description,
        parentId: task.parentId || null,
        acceptanceCriteria: task.acceptanceCriteria,
        dependencies: task.dependencies,
        priority: task.priority,
        projectId: task.projectId,
        createdAt: task.createdAt,
        metadata: task.metadata
      }
    ],
    skills: options.selectedSkills || [],
    session: {
      model: options.model || "sonnet",
      permissionMode: options.permissionMode || "acceptEdits",
      thinkingMode: options.thinkingMode,
      workingDirectory: options.workingDirectory
    },
    context: {
      codebaseContext: options.codebaseContext,
      relatedTasks: options.relatedTasks,
      projectStandards: getProjectStandards(task.projectId)
    }
  };
}
```

### Programmatically

```bash
# Using CLI command (recommended)
$ maestro manifest generate \
    --role worker \
    --project-id proj-1 \
    --task-ids task-1 \
    --model sonnet \
    --permission-mode acceptEdits \
    --api-url http://localhost:3000 \
    --output ~/.maestro/sessions/sess-123/manifest.json

# Or manually create with jq
cat > ~/.maestro/sessions/sess-123/manifest.json << 'EOF'
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [
    {
      "id": "task-1",
      "title": "Implement feature X",
      "description": "Add new feature X to the system",
      "parentId": null,
      "acceptanceCriteria": ["Feature works", "Tests pass"],
      "projectId": "proj-1",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}
EOF
```

## Manifest Evolution

### Version Migration

When manifest schema changes:

```typescript
function migrateManifest(manifest: any): MaestroManifest {
  const version = manifest.manifestVersion;

  if (version === "1.0") {
    return manifest; // Current version
  }

  // Future: handle version migrations
  // if (version === "0.9") {
  //   return migrateFrom0_9To1_0(manifest);
  // }

  throw new Error(`Unsupported manifest version: ${version}`);
}
```

### Backward Compatibility

The CLI must support old manifest versions with migration:
- Read old version
- Migrate to current version
- Optionally save migrated version

## Best Practices

### 1. Include Enough Context

Workers perform better with more context:
- Detailed acceptance criteria
- Technical notes with constraints
- Relevant codebase context

### 2. Use Hierarchical Tasks for Decomposition

If a task is complex, decompose it into child tasks:
```bash
# Create parent task
maestro task create "Implement authentication" --parent null

# Create child tasks
maestro task create "Install auth dependencies" --parent task-1
maestro task create "Create User model" --parent task-1
maestro task create "Add JWT middleware" --parent task-1
```

Each child task gets its own manifest and can have independent sessions.

### 3. Select Skills Purposefully

Only include skills that are actually needed:
```json
// Good - relevant skill
"skills": ["frontend-design"]  // For UI task

// Bad - unnecessary skill
"skills": ["frontend-design"]  // For backend API task
```

### 4. Use Metadata for Extensions

Store custom data in metadata:
```json
"metadata": {
  "epic": "User Management",
  "jiraTicket": "PROJ-123",
  "estimateConfidence": "high"
}
```

## Schema Validation Implementation

```typescript
import Ajv from 'ajv';

const manifestSchema = {
  type: 'object',
  required: ['manifestVersion', 'role', 'tasks', 'session'],
  properties: {
    manifestVersion: { type: 'string', const: '1.0' },
    role: { type: 'string', enum: ['worker', 'orchestrator'] },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'description', 'acceptanceCriteria', 'projectId', 'createdAt'],
        properties: {
          id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', minLength: 1 },
          parentId: { type: ['string', 'null'] },
          acceptanceCriteria: { type: 'array', items: { type: 'string' }, minItems: 1 },
          // ... more properties
        }
      }
    },
    skills: { type: 'array', items: { type: 'string' } },
    session: {
      type: 'object',
      required: ['model', 'permissionMode'],
      properties: {
        model: { type: 'string', enum: ['sonnet', 'opus', 'haiku'] },
        permissionMode: { type: 'string', enum: ['acceptEdits', 'interactive', 'readOnly'] },
        // ... more properties
      }
    },
    context: { type: 'object' } // Optional
  }
};

const ajv = new Ajv();
const validate = ajv.compile(manifestSchema);

export function validateManifest(manifest: unknown): manifest is MaestroManifest {
  const valid = validate(manifest);
  if (!valid) {
    throw new Error(`Invalid manifest: ${ajv.errorsText(validate.errors)}`);
  }
  return true;
}
```

## Hierarchical Tasks

### What Are Hierarchical Tasks?

Tasks can have parent-child relationships via the `parentId` field:
- **Root tasks**: `parentId` is `null`
- **Child tasks**: `parentId` points to parent task ID

### Benefits

- **Full task capabilities**: Child tasks have all properties (status, sessions, timeline)
- **Recursive nesting**: Children can have children (unlimited depth)
- **Independent execution**: Each task can have its own sessions and manifest
- **Better organization**: Natural decomposition of complex work

### Example Hierarchy

```
task-1: Implement authentication (parentId: null)
  ├─ task-2: Create User model (parentId: task-1)
  ├─ task-3: Add JWT middleware (parentId: task-1)
  │  ├─ task-4: Write middleware (parentId: task-3)
  │  └─ task-5: Add tests (parentId: task-3)
  └─ task-6: Documentation (parentId: task-1)
```

### Working with Child Tasks

```bash
# List child tasks
maestro task children task-1

# Create child task
maestro task create "Child task" --parent task-1

# View task tree
maestro task tree
```

## Manifest Generation Flow (Updated Architecture)

### CLI-Based Generation

**Manifest generation logic lives in the CLI**, making it reusable by:
- Server (during spawn API)
- Orchestrator agents (when spawning workers)
- External automation tools

### Flow

```
1. Server/Orchestrator calls CLI command:
   $ maestro manifest generate \
       --role worker \
       --task-ids task-1 \
       --api-url http://localhost:3000 \
       --output ~/.maestro/sessions/sess-123/manifest.json

2. CLI fetches task data from server:
   GET /api/tasks/task-1

3. CLI generates manifest with:
   - Full task data
   - System prompt template
   - Session configuration

4. CLI saves manifest to specified path

5. Server/Orchestrator uses manifest for spawning
```

### Benefits of CLI-Based Generation

✅ **Reusable**: Same logic for UI, orchestrator, automation
✅ **Consistent**: All manifests generated identically
✅ **Maintainable**: Changes in one place
✅ **Testable**: CLI can be tested independently

## Summary

The manifest is:
- ✅ Simple JSON file
- ✅ Contains all task data
- ✅ Generated by CLI (not UI or server)
- ✅ Supports hierarchical tasks via `parentId`
- ✅ Portable and versionable
- ✅ Strictly validated
- ✅ Extensible through metadata and context

Next: [02-CLI-ARCHITECTURE.md](./02-CLI-ARCHITECTURE.md) - How the CLI uses manifests
