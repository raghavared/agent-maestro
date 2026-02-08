# Session Initialization

## Overview

When `maestro worker init` or `maestro orchestrator init` runs, the CLI performs a sophisticated initialization sequence to prepare the agent for work. This document details the session initialization flow.

## Initialization Sequence

```
┌─────────────────────────────────────┐
│  1. Read Environment Variables      │
│     - MAESTRO_MANIFEST_PATH         │
│     - MAESTRO_SESSION_ID            │
│     - MAESTRO_PROJECT_ID            │
│     - MAESTRO_API_URL (optional)    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Read & Validate Manifest        │
│     - Parse JSON                    │
│     - Validate schema (Ajv)         │
│     - Extract task data             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Generate System Prompt          │
│     - Load template (worker/orch)   │
│     - Replace ${VARIABLES}          │
│     - Include task context          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3a. Load Command Permissions       │
│     - Read role from manifest       │
│     - Determine strategy            │
│     - Build allowed commands list   │
│     - Cache permissions             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Load Standard Skills            │
│     - Read manifest.skills[]        │
│     - Discover in ~/.skills/        │
│     - Validate skill directories    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. Display Session Brief ✅        │
│     - Formatted task summary        │
│     - Acceptance criteria           │
│     - Skills loaded                 │
│     - Session configuration         │
│     - Multi-task info (if multi)    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  6. Auto-Update Status ✅           │
│     - Session → 'running'           │
│     - Task sessionStatus → 'working'│
│     - Via autoUpdateSessionStatus() │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  7. Spawn Claude Code ✅            │
│     - Build CLI arguments           │
│     - Append system prompt          │
│     - Add skill plugin dirs         │
│     - Preserve env vars             │
│     - spawn('claude', args)         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  8. Monitor Claude Process ✅       │
│     - Wait for exit                 │
│     - Capture exit code             │
│     - Cleanup on completion         │
└─────────────────────────────────────┘

---

**Hooks** (implemented via plugin hooks.json):
- SessionStart hook: `maestro session register` (auto-executed by Claude Code plugin system)
- SessionEnd hook: `maestro session complete` (auto-executed on exit)
- PostToolUse hook (Worker only): `track-file` (auto-executed on Write/Edit)
```

## Session Brief Display

### Purpose

The session brief provides the agent with immediate context about their task without needing to query the server or read documentation.

### Format

```
╔═══════════════════════════════════════════════════════════╗
║              MAESTRO WORKER SESSION BRIEF                 ║
╚═══════════════════════════════════════════════════════════╝

# Your Task

**Title**: Implement user authentication
**ID**: task-123
**Priority**: high
**Complexity**: high

**Description**:
Add JWT-based authentication to the API with login and logout endpoints.
Use bcrypt for password hashing and jsonwebtoken for token generation.

## Acceptance Criteria

When this task is complete, the following must be true:

  ✓ Users can register with email and password
  ✓ Passwords are hashed with bcrypt (cost factor 10+)
  ✓ Users can login and receive JWT access token
  ✓ Access tokens expire after 15 minutes
  ✓ Protected routes validate JWT tokens
  ✓ Invalid tokens return 401 Unauthorized
  ✓ All authentication endpoints have integration tests

## Technical Notes

Use bcrypt for password hashing with cost factor 12.
Use jsonwebtoken library for JWT generation.
Store refresh tokens in database with 7-day expiry.
Use express-validator for input validation.
Follow RESTful API conventions for endpoints.

## Dependencies

This task depends on:
  • task-100: Setup database schema (✅ completed)
  • task-101: Configure Express server (✅ completed)

## Skills Loaded

  • code-visualizer

═══════════════════════════════════════════════════════════

🤖 Running initial commands...
```

### Implementation

```typescript
// src/services/session-brief-generator.ts

export class SessionBriefGenerator {
  generate(manifest: MaestroManifest): string {
    const task = manifest.tasks[0];

    const brief = `
╔${'═'.repeat(60)}╗
║${this.center('MAESTRO WORKER SESSION BRIEF', 60)}║
╚${'═'.repeat(60)}╝

# Your Task

**Title**: ${task.title}
**ID**: ${task.id}
**Priority**: ${task.priority || 'medium'}

**Description**:
${task.description}

## Acceptance Criteria

When this task is complete, the following must be true:

${this.formatAcceptanceCriteria(task.acceptanceCriteria)}

${this.formatDependencies(task.dependencies)}

${manifest.skills && manifest.skills.length > 0 ? `## Skills Loaded\n\n${this.formatSkills(manifest.skills)}\n` : ''}

${'═'.repeat(60)}

🚀 Spawning Claude Code session...
`;

    return brief;
  }

  private center(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return ' '.repeat(left) + text + ' '.repeat(right);
  }

  private formatAcceptanceCriteria(criteria: string[]): string {
    return criteria
      .map(c => `  ✓ ${c}`)
      .join('\n');
  }

  private formatDependencies(dependencies?: string[]): string {
    if (!dependencies || dependencies.length === 0) {
      return '## Dependencies\n\nNone';
    }

    return `## Dependencies\n\nThis task depends on:\n${
      dependencies.map(id => `  • ${id}`).join('\n')
    }`;
  }

  private formatSkills(skills: string[]): string {
    return skills.map(s => `  • ${s}`).join('\n');
  }
}
```

## Automatic Status Updates

**Architectural Decision**: Tasks are automatically marked as `in_progress` when sessions spawn. No manual `maestro task start` command is needed.

### Previous Approach (Deprecated)

```bash
# Old approach - manual task start
$ maestro task start task-123
```

**Problems**:
- Extra step for agents to remember
- Redundant (session creation = task started)
- Error-prone (agent might forget)

### Current Approach (Automatic)

```typescript
// In WorkerInitCommand.autoUpdateSessionStatus():
// 1. Update SESSION status: spawning → running
await api.patch(`/api/sessions/${sessionId}`, { status: 'running' });

// 2. Update TASK session status for each task
for (const task of manifest.tasks) {
  await api.patch(`/api/tasks/${task.id}`, {
    sessionStatus: 'working',
    updateSource: 'session',
    sessionId
  });
}
```

**Benefits**:
- ✅ **Simpler**: No manual commands needed
- ✅ **Automatic**: Status updates based on session lifecycle
- ✅ **Accurate**: Session start = task start
- ✅ **Less cognitive load**: Agents don't need to remember to start tasks

### Status Update Flow

```
Session Spawned → Task status: 'in_progress' (automatic)
       ↓
Agent working → sessionStatus: 'working' (via maestro report progress)
       ↓
Agent completes → sessionStatus: 'completed' (via maestro report complete)
       ↓
User reviews → status: 'completed' (user/orchestrator decision)
```

### Agent Commands Available

While task start is automatic, agents report their work status via `maestro report`:

```bash
# Report progress (sessionStatus → working)
maestro report progress "Implementing login form"

# Report blocker (sessionStatus → blocked)
maestro report blocked "Need API credentials"

# Report completion (sessionStatus → completed)
maestro report complete "All acceptance criteria met"

# Report error (sessionStatus → failed)
maestro report error "Tests failing: TypeError in auth.test.js"
```

These commands update `sessionStatus` on the task and post timeline events to the session.

## Worker Init Complete Flow

### Full Example

```bash
$ maestro worker init

🚀 Maestro Worker Initialization

📄 Reading manifest...
   Path: ~/.maestro/sessions/sess-123/manifest.json
✅ Manifest loaded: Implement user authentication

📝 Generating system prompt...
   Template: worker-prompt.md
   Variables: 8 replaced
✅ System prompt generated (1,245 characters)

🔌 Loading standard skills...
   • code-visualizer
✅ Loaded 1 skill(s)

📡 Reporting session start...
   API: POST http://localhost:3000/api/sessions
✅ Session sess-123 created on server

───────────────────────────────────────────

╔═══════════════════════════════════════════════════════════╗
║              MAESTRO WORKER SESSION BRIEF                 ║
╚═══════════════════════════════════════════════════════════╝

# Your Task

**Title**: Implement user authentication
**ID**: task-123
**Priority**: high

[... full session brief ...]

═══════════════════════════════════════════════════════════

🤖 Running initial commands...

$ maestro whoami
Session Context:
  Project ID: proj-1
  Session ID: sess-123
  Task: task-123 (Implement user authentication)

✅ Initial setup complete. Starting Claude...

───────────────────────────────────────────────────────────

Spawning: claude --plugin-dir plugins/maestro-worker \
                 --plugin-dir ~/.skills/code-visualizer \
                 --model sonnet \
                 "Run `maestro whoami` to understand your assignment and begin working."

───────────────────────────────────────────────────────────

Welcome to Claude Code! Type /help for assistance.

>
```

## Orchestrator Init Flow

### Differences from Worker

1. **Different Template**: Uses `orchestrator-prompt.md`
2. **Different Initial Commands**:
   ```bash
   maestro whoami
   maestro status
   maestro task list
   ```
3. **Different Brief**: Emphasizes project overview, not single task
4. **Workflow Focus**: Task decomposition and worker spawning

### Example Brief

```
╔═══════════════════════════════════════════════════════════╗
║           MAESTRO ORCHESTRATOR SESSION BRIEF              ║
╚═══════════════════════════════════════════════════════════╝

# Your Role

You are the Maestro Orchestrator responsible for coordinating this project.

**Project ID**: proj-1
**Session ID**: sess-456

## Current Tasks

  1. task-1: Implement authentication (pending, high priority)
  2. task-2: Add dark mode (pending, medium priority)
  3. task-3: Write documentation (pending, low priority)

## Your Responsibilities

1. **Analyze** each task and determine if it needs decomposition
2. **Create child tasks** for complex tasks (hierarchical decomposition)
3. **Identify dependencies** between tasks
4. **Spawn workers** to execute tasks
5. **Monitor progress** across all sessions
6. **Coordinate completion** of the project

## Key Commands

- `maestro status` - View project overview
- `maestro task list` - List all tasks
- `maestro task create` - Create new tasks
- `maestro task create --parent <id>` - Create child tasks
- `maestro task children <id>` - View task hierarchy
- `maestro session spawn` - Spawn worker sessions

═══════════════════════════════════════════════════════════

🤖 Running initial commands...

$ maestro whoami
$ maestro status
$ maestro task list

✅ Initial setup complete. Starting Claude...
```

## Error Handling During Initialization

### Manifest Read Error

```bash
$ maestro worker init

🚀 Maestro Worker Initialization

📄 Reading manifest...
   Path: ~/.maestro/sessions/sess-123/manifest.json

❌ Error: Manifest file not found

Details:
  Path: ~/.maestro/sessions/sess-123/manifest.json
  Error: ENOENT: no such file or directory

Suggestions:
  • Verify MAESTRO_MANIFEST_PATH is correct
  • Check that the manifest was created by the UI
  • Try regenerating the manifest

Exit code: 1
```

### Manifest Validation Error

```bash
$ maestro worker init

🚀 Maestro Worker Initialization

📄 Reading manifest...
✅ Manifest loaded

Validating manifest schema...

❌ Error: Invalid manifest structure

Validation errors:
  • Missing required field: task.acceptanceCriteria
  • Invalid field: session.model (must be sonnet, opus, or haiku)
  • Invalid field: role (must be worker or orchestrator)

Exit code: 1
```

### Skill Not Found

```bash
$ maestro worker init

[... initialization ...]

🔌 Loading standard skills...
   • code-visualizer
   • nonexistent-skill

⚠️  Skill not found: nonexistent-skill
   Available skills: code-visualizer, frontend-design, skill-creator

ℹ️  Continuing with 1 skill(s)...

✅ Loaded 1 skill(s)

[... continues normally ...]
```

### Server Unreachable

```bash
$ maestro worker init

[... initialization ...]

📡 Reporting session start...
   API: POST http://localhost:3000/api/sessions

⚠️  Failed to report session start: Network error
   Server appears to be offline at http://localhost:3000

ℹ️  Continuing in offline mode...

[... continues without server reporting ...]
```

## Configuration

### Customizing Session Brief

Environment variable (optional):
```bash
MAESTRO_SHOW_BRIEF=false    # Skip session brief display
```

### Customizing Initial Commands

Environment variable (optional):
```bash
MAESTRO_SKIP_INITIAL_COMMANDS=true    # Skip auto-execution
```

Or in manifest:
```json
{
  "session": {
    "skipInitialCommands": true
  }
}
```

### Debug Mode

```bash
MAESTRO_DEBUG=true maestro worker init
```

Output includes:
- Detailed step timing
- Environment variable values
- Manifest contents
- Generated prompt preview
- Claude CLI arguments

## Summary

Session initialization provides:
- ✅ Clear visual feedback during setup
- ✅ Formatted task context (session brief)
- ✅ Auto-executed initial commands
- ✅ Graceful error handling
- ✅ Offline capability
- ✅ Debug mode for troubleshooting

The agent starts with complete context and is immediately productive without manual setup.

Next: See [07-CLI-COMMANDS-REFERENCE.md](./07-CLI-COMMANDS-REFERENCE.md) for all available commands.
