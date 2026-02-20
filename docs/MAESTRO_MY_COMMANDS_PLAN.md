# Plan: `maestro my` — Context-Aware Agent Commands

## Problem

Agents currently use generic commands like `maestro whoami`, `maestro task list`, `maestro session siblings`, `maestro session mail read`, etc. These commands:
1. Are scattered across different command groups (`task`, `session`, `whoami`)
2. Require agents to know their own session ID, project ID, or task IDs to filter results
3. Don't clearly communicate "this is about **me** and **my current context**"
4. Force LLMs to stitch together multiple commands to get a cohesive self-picture

## Solution: The `maestro my` Command Group

A unified, **session-scoped** command group where every subcommand returns data about the **current agent's own context** — no IDs needed, no filtering required. The manifest and environment provide all the context.

```
maestro my <subcommand>
```

### Why "my"?

- **Intuitive for LLMs**: "my tasks" is more natural than "task list --session-id X"
- **Zero-config**: Every `my` command reads from manifest/env — no arguments needed
- **Context-aware**: Results are pre-filtered to the agent's scope
- **Discoverable**: One prefix to remember, tab-completable

---

## Proposed Subcommands

### 1. `maestro my status`
**What it returns:** A unified self-portrait of the agent's current state.

```json
{
  "sessionId": "sess_abc",
  "mode": "execute",
  "strategy": "simple",
  "teamMember": {
    "id": "tm_123",
    "name": "Backend Engineer",
    "role": "developer",
    "avatar": "⚙️"
  },
  "tasks": {
    "total": 3,
    "completed": 1,
    "inProgress": 1,
    "pending": 1,
    "blocked": 0
  },
  "session": {
    "status": "working",
    "startedAt": "...",
    "model": "claude-sonnet-4-20250514"
  },
  "coordinator": {
    "sessionId": "sess_coord_xyz",
    "reachable": true
  },
  "unreadMail": 2
}
```

**Source:** Manifest + API calls for live task statuses + mail count.

---

### 2. `maestro my tasks`
**What it returns:** The agent's assigned tasks with current statuses (live from server).

```json
[
  {
    "id": "task_abc",
    "title": "Implement auth module",
    "status": "in_progress",
    "priority": "high",
    "description": "...",
    "acceptanceCriteria": "..."
  }
]
```

**Source:** Manifest `tasks[]` IDs → fetch latest from API.
**Difference from `task list`:** Only returns tasks assigned to this session's manifest. No filtering args needed.

---

### 3. `maestro my commands`
**What it returns:** The commands this specific agent is allowed to run, grouped and formatted.

```json
{
  "mode": "execute",
  "allowedCount": 46,
  "groups": {
    "core": ["whoami", "status", "commands", "my"],
    "task": ["task:list", "task:get", "task:create", ...],
    "session": ["session:info", "session:siblings", ...],
    "my": ["my:status", "my:tasks", "my:commands", ...]
  },
  "disabledGroups": ["project"],
  "customOverrides": {
    "enabled": ["team:create"],
    "disabled": ["task:delete"]
  }
}
```

**Source:** `getPermissionsFromManifest()` → group and annotate.
**Difference from `maestro commands`:** Shows what's allowed vs disabled, highlights overrides, and explains WHY certain commands are available.

---

### 4. `maestro my siblings`
**What it returns:** Other active sessions in the same project (peer agents).

```json
[
  {
    "sessionId": "sess_xyz",
    "name": "Frontend Engineer",
    "avatar": "🎨",
    "status": "working",
    "taskTitles": ["Build login page", "Add form validation"],
    "canMessage": true
  }
]
```

**Source:** API `/api/sessions` filtered by project + exclude self.
**Difference from `session siblings`:** Enriched with task titles and messaging capability flag.

---

### 5. `maestro my identity`
**What it returns:** The agent's identity profile — who they are, what they can do.

```json
{
  "profile": "maestro-worker",
  "teamMember": {
    "id": "tm_123",
    "name": "Backend Engineer",
    "avatar": "⚙️",
    "identity": "You are the Backend Engineer...",
    "memory": ["Prefers TypeScript", "Uses Fastify over Express"]
  },
  "capabilities": {
    "canSpawnSessions": false,
    "canManageTasks": true,
    "canAccessProjects": false
  },
  "workflow": {
    "templateId": "execute-simple",
    "phases": ["init", "execute", "complete"],
    "currentPhase": "execute"
  }
}
```

**Source:** Manifest fields (teamMember*, capabilities, workflow).

---

### 6. `maestro my context`
**What it returns:** Additional context attached to this session (from manifest + docs).

```json
{
  "additionalContext": {
    "guidelines": "Follow REST API conventions...",
    "techStack": "Node.js, TypeScript, PostgreSQL"
  },
  "referenceTaskIds": ["task_ref1", "task_ref2"],
  "skills": ["maestro-worker"],
  "coordinatorDirective": {
    "subject": "Focus on API endpoints first",
    "message": "...",
    "fromSessionId": "sess_coord"
  },
  "sessionDocs": [
    { "id": "doc_1", "title": "API Spec", "addedAt": "..." }
  ]
}
```

**Source:** Manifest `context`, `referenceTaskIds`, `skills`, `initialDirective` + API for docs.

---

### 7. `maestro my mail`
**What it returns:** Unread messages/notifications for this session.

**Source:** Alias/wrapper for `session mail read` but with richer formatting.

---

## Implementation Architecture

### File Structure
```
maestro-cli/src/
├── commands/
│   └── my.ts                    # NEW: registerMyCommands(program)
├── services/
│   └── my-context.ts            # NEW: MyContextService — aggregates data
├── prompts/
│   └── commands.ts              # MODIFY: Add CMD_DESC/CMD_SYNTAX for my:* commands
├── services/
│   └── command-permissions.ts   # MODIFY: Add my:* to COMMAND_REGISTRY + DEFAULT_COMMANDS_BY_MODE
└── index.ts                     # MODIFY: import + registerMyCommands(program)
```

### New: `commands/my.ts`

```typescript
import { Command } from 'commander';
import { guardCommand } from '../services/command-permissions';
import { MyContextService } from '../services/my-context';
import { config } from '../config';

export function registerMyCommands(program: Command) {
  const my = program.command('my').description('Context-aware commands for the current agent');

  my.command('status')
    .description('Show current agent status and task progress')
    .action(async () => {
      await guardCommand('my:status');
      const ctx = new MyContextService();
      const status = await ctx.getMyStatus();
      // output...
    });

  my.command('tasks')
    .description('List tasks assigned to this session')
    .action(async () => {
      await guardCommand('my:tasks');
      const ctx = new MyContextService();
      const tasks = await ctx.getMyTasks();
      // output...
    });

  my.command('commands')
    .description('List commands available to this agent')
    .action(async () => {
      await guardCommand('my:commands');
      const ctx = new MyContextService();
      const commands = await ctx.getMyCommands();
      // output...
    });

  my.command('siblings')
    .description('List peer sessions in this project')
    .action(async () => {
      await guardCommand('my:siblings');
      const ctx = new MyContextService();
      const siblings = await ctx.getMySiblings();
      // output...
    });

  my.command('identity')
    .description('Show agent identity and capabilities')
    .action(async () => {
      await guardCommand('my:identity');
      const ctx = new MyContextService();
      const identity = await ctx.getMyIdentity();
      // output...
    });

  my.command('context')
    .description('Show additional context and directives')
    .action(async () => {
      await guardCommand('my:context');
      const ctx = new MyContextService();
      const context = await ctx.getMyContext();
      // output...
    });

  my.command('mail')
    .description('Read unread messages')
    .action(async () => {
      await guardCommand('my:mail');
      const ctx = new MyContextService();
      const mail = await ctx.getMyMail();
      // output...
    });
}
```

### New: `services/my-context.ts`

Central service that aggregates data from manifest, API, and permissions:

```typescript
export class MyContextService {
  private manifest: MaestroManifest | null;

  constructor() {
    this.manifest = this.loadManifest();
  }

  async getMyStatus(): Promise<MyStatus> {
    // Combine: manifest mode/strategy + API task statuses + session status + mail count
  }

  async getMyTasks(): Promise<TaskData[]> {
    // Manifest task IDs → fetch latest from API
  }

  getMyCommands(): MyCommands {
    // getPermissionsFromManifest() → group + annotate
  }

  async getMySiblings(): Promise<SiblingInfo[]> {
    // API sessions → exclude self → enrich with task titles
  }

  getMyIdentity(): MyIdentity {
    // Manifest teamMember* fields + capabilities + workflow template
  }

  async getMyContext(): Promise<MyContext> {
    // Manifest context + referenceTaskIds + skills + directive + API docs
  }

  async getMyMail(): Promise<MailMessage[]> {
    // API mail endpoint for current session
  }
}
```

### Modifications Required

#### 1. `command-permissions.ts` — Add to COMMAND_REGISTRY

```typescript
// Add 7 new commands to COMMAND_REGISTRY
{ name: 'my:status', description: 'Show current agent status', allowedModes: ['execute', 'coordinate'], isCore: true },
{ name: 'my:tasks', description: 'List assigned tasks', allowedModes: ['execute', 'coordinate'], isCore: true },
{ name: 'my:commands', description: 'List available commands', allowedModes: ['execute', 'coordinate'], isCore: true },
{ name: 'my:siblings', description: 'List peer sessions', allowedModes: ['execute', 'coordinate'] },
{ name: 'my:identity', description: 'Show agent identity', allowedModes: ['execute', 'coordinate'], isCore: true },
{ name: 'my:context', description: 'Show session context', allowedModes: ['execute', 'coordinate'] },
{ name: 'my:mail', description: 'Read unread messages', allowedModes: ['execute', 'coordinate'] },
```

**Key decision:** `my:status`, `my:tasks`, `my:commands`, and `my:identity` should be **core commands** (always available, like `whoami`). The others are mode-default.

#### 2. `prompts/commands.ts` — Add CMD_DESC + CMD_SYNTAX

```typescript
// CMD_DESC
'my:status': 'Show current agent status and task progress',
'my:tasks': 'List tasks assigned to this session',
'my:commands': 'List commands available to this agent',
'my:siblings': 'List peer sessions in this project',
'my:identity': 'Show agent identity and capabilities',
'my:context': 'Show session context and directives',
'my:mail': 'Read unread messages',

// CMD_SYNTAX
'my:status': 'maestro my status',
'my:tasks': 'maestro my tasks',
'my:commands': 'maestro my commands',
'my:siblings': 'maestro my siblings',
'my:identity': 'maestro my identity',
'my:context': 'maestro my context',
'my:mail': 'maestro my mail',

// COMMAND_GROUP_META
my: { prefix: 'maestro my', description: 'Context-aware self commands' },
```

#### 3. `index.ts` — Register

```typescript
import { registerMyCommands } from './commands/my';
// ... in setup:
registerMyCommands(program);
```

#### 4. `prompt-builder.ts` — Add to commands_reference

Add `my` group to the compact command brief so agents see it in their system prompt:
```
maestro my {status|tasks|commands|siblings|identity|context|mail} — Self-awareness commands
```

---

## Prompt Integration

### In System Prompt (commands_reference block):
```
maestro my {status|tasks|commands|siblings|identity|context|mail} — Context-aware self commands
```

### In Workflow Phases:
Update `EXECUTE_INIT_PHASE` in `prompts/workflow-phases.ts` to recommend:
```
During init, run `maestro my status` to understand your current assignment and context.
```

---

## Migration & Backwards Compatibility

- **No breaking changes.** Existing commands (`whoami`, `task list`, `session siblings`, etc.) remain unchanged.
- `maestro my` is purely additive — a convenience layer on top of existing data.
- Agents using old commands continue to work.
- New system prompts can reference `maestro my` commands for cleaner agent behavior.

---

## Implementation Order

1. **Phase 1:** Create `services/my-context.ts` (data aggregation service)
2. **Phase 2:** Create `commands/my.ts` (command registration)
3. **Phase 3:** Update `command-permissions.ts` (COMMAND_REGISTRY + DEFAULT_COMMANDS_BY_MODE)
4. **Phase 4:** Update `prompts/commands.ts` (CMD_DESC, CMD_SYNTAX, GROUP_META)
5. **Phase 5:** Update `index.ts` (register)
6. **Phase 6:** Update `prompt-builder.ts` and `workflow-phases.ts` (prompt references)
7. **Phase 7:** Test all `maestro my *` commands end-to-end

---

## Token Impact

Adding `maestro my` to the commands_reference block in system prompts adds ~15 tokens (one compact line). The benefit is that agents can make fewer, more targeted API calls — reducing total token usage per session.

---

## Open Questions

1. Should `maestro my` be available as a standalone command (no subcommand) that returns everything? i.e., `maestro my` → full self-portrait combining status + tasks + identity?
2. Should we add `maestro my team` for coordinate-mode agents to see their spawned team?
3. Should `maestro my progress` be a convenience wrapper for `session report progress`?
