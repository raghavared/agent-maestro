# CLI Architecture

## Overview

The Maestro CLI is a Node.js command-line tool that bridges orchestration systems and Claude Code. It reads manifests, generates system prompts, and spawns Claude Code sessions with appropriate context.

## Core Design

### Single Responsibility

**The CLI does ONE thing**: Transform a manifest into a Claude Code session.

```
Manifest + Environment → CLI → Claude Code Session
```

Everything else (task management, progress tracking, UI) is external to the CLI.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      maestro CLI                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │            Command Layer                         │  │
│  │  • worker init                                   │  │
│  │  • orchestrator init                            │  │
│  │  • manifest generate                            │  │
│  │  • task commands (inc. hierarchy)               │  │
│  │  • context commands                             │  │
│  └────────────────┬────────────────────────────────┘  │
│                   │                                     │
│  ┌────────────────▼────────────────────────────────┐  │
│  │         Core Services                           │  │
│  │                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐   │  │
│  │  │ ManifestReader   │  │ PromptGenerator  │   │  │
│  │  │ • Read manifest  │  │ • Load template  │   │  │
│  │  │ • Validate       │  │ • Inject vars    │   │  │
│  │  │ • Parse          │  │ • Server fetch   │   │  │
│  │  └──────────────────┘  └──────────────────┘   │  │
│  │                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐   │  │
│  │  │  SkillLoader     │  │  ClaudeSpawner   │   │  │
│  │  │ • Discover       │  │ • Build args     │   │  │
│  │  │ • Validate       │  │ • Plugin dirs    │   │  │
│  │  │ • Load           │  │ • Spawn process  │   │  │
│  │  └──────────────────┘  └──────────────────┘   │  │
│  │                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐   │  │
│  │  │   HookExecutor   │  │   APIClient      │   │  │
│  │  │ • Execute cmds   │  │ • HTTP client    │   │  │
│  │  │ • Timeout        │  │ • Retry logic    │   │  │
│  │  │ • Error handling │  │ • Error handling │   │  │
│  │  └──────────────────┘  └──────────────────┘   │  │
│  │                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐   │  │
│  │  │ WhoamiRenderer   │  │SessionBriefGen.  │   │  │
│  │  │ • Identity hdr   │  │ • Task summary   │   │  │
│  │  │ • Template subs  │  │ • Criteria       │   │  │
│  │  │ • Commands list  │  │ • Config display │   │  │
│  │  └──────────────────┘  └──────────────────┘   │  │
│  │                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐   │  │
│  │  │  LocalStorage    │  │ CommandPerms     │   │  │
│  │  │ • Read ~/.maestro│  │ • Role defaults  │   │  │
│  │  │ • Projects cache │  │ • Guard commands │   │  │
│  │  │ • Tasks cache    │  │ • Generate brief │   │  │
│  │  └──────────────────┘  └──────────────────┘   │  │
│  └─────────────────────────────────────────────── ┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │              Utilities                           │  │
│  │  • Config loader                                │  │
│  │  • Logger                                       │  │
│  │  • Error handler                                │  │
│  │  • Validator                                    │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
maestro-cli/
├── bin/
│   └── maestro.js              # Executable entry point
│
├── src/
│   ├── commands/
│   │   ├── worker.ts           # maestro worker commands
│   │   ├── worker-init.ts      # WorkerInitCommand class
│   │   ├── orchestrator.ts     # maestro orchestrator commands
│   │   ├── orchestrator-init.ts # OrchestratorInitCommand class
│   │   ├── manifest-generator.ts # maestro manifest generate
│   │   ├── task.ts             # Task CRUD commands (inc. hierarchy)
│   │   ├── session.ts          # Session management
│   │   ├── queue.ts            # Queue strategy commands
│   │   ├── report.ts           # Report commands (progress, complete, etc.)
│   │   ├── project.ts          # Project management commands
│   │   └── skill.ts            # Skill discovery commands
│   │
│   ├── services/
│   │   ├── manifest-reader.ts      # Read and validate manifests
│   │   ├── prompt-generator.ts     # Generate system prompts (server + bundled)
│   │   ├── skill-loader.ts         # Discover and load skills
│   │   ├── claude-spawner.ts       # Spawn Claude Code with plugins
│   │   ├── hook-executor.ts        # Execute shell command hooks
│   │   ├── command-permissions.ts  # Command registry and permissions
│   │   ├── whoami-renderer.ts      # Render full session context
│   │   └── session-brief-generator.ts # Formatted session brief display
│   │
│   ├── types/
│   │   ├── manifest.ts         # Manifest types (source of truth)
│   │   └── storage.ts          # Storage entity types
│   │
│   ├── schemas/                 # JSON validation schemas
│   │
│   ├── api.ts                  # APIClient (HTTP with retry)
│   ├── storage.ts              # LocalStorage (read-only ~/.maestro/data/)
│   ├── config.ts               # Environment variable config + dotenv
│   └── index.ts                # Main CLI setup
│
├── templates/                   # System prompt templates
│   ├── worker-simple-prompt.md
│   ├── worker-queue-prompt.md
│   ├── worker-tree-prompt.md
│   └── orchestrator-prompt.md
│
├── plugins/                     # Claude Code plugin directories
│   ├── maestro-worker/
│   │   ├── hooks/
│   │   │   └── hooks.json      # SessionStart, SessionEnd, PostToolUse
│   │   └── bin/
│   │       └── track-file      # File tracking utility
│   └── maestro-orchestrator/
│       └── hooks/
│           └── hooks.json      # SessionStart, SessionEnd
│
├── package.json
└── tsconfig.json
```

## Data Flow

### Worker Initialization Flow

```
1. User executes: maestro worker init

2. CLI reads environment variables:
   ├─ MAESTRO_MANIFEST_PATH
   ├─ MAESTRO_PROJECT_ID
   ├─ MAESTRO_SESSION_ID
   └─ MAESTRO_API_URL

3. ManifestReader:
   ├─ Read manifest from MAESTRO_MANIFEST_PATH
   ├─ Validate schema
   └─ Parse JSON

4. PromptGenerator:
   ├─ Load worker-prompt.md template
   ├─ Extract variables from manifest.tasks[0]
   └─ Replace ${VARIABLES} in template

5. SkillLoader (if manifest.skills):
   ├─ For each skill in manifest.skills:
   │  ├─ Find skill in .skills/
   │  └─ Validate skill exists
   └─ Return list of skill paths

6. HookExecutor.SessionStart:
   ├─ Call server POST /api/sessions
   └─ Report session started

7. ClaudeSpawner:
   ├─ Build Claude CLI arguments:
   │  ├─ --model {manifest.session.model}
   │  ├─ --permission-mode {manifest.session.permissionMode}
   │  ├─ --plugin-dir {skillPath} (for each skill)
   │  └─ --append-system-prompt {generatedPrompt}
   ├─ Spawn claude process
   └─ Monitor process

8. Agent starts:
   ├─ Claude receives initial prompt: 'Run `maestro whoami`'
   ├─ Agent runs maestro whoami → WhoamiRenderer
   │  ├─ Renders identity header (role, strategy, session ID)
   │  ├─ Loads and substitutes template content
   │  └─ Generates available commands list
   └─ Agent understands full context and begins work

9. Process monitoring:
   ├─ Wait for Claude to exit
   └─ On exit: HookExecutor.SessionEnd

9. HookExecutor.SessionEnd:
   ├─ Call server PATCH /api/sessions/{id}
   └─ Report session completed
```

**Note**: Hooks are implemented via plugin hooks.json files loaded as `--plugin-dir`. The CLI itself does not call hooks directly — Claude Code's plugin system handles hook execution.

### Complete Spawn Flow (UI → CLI → Claude)

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION UI                          │
│                  (Web UI, Desktop UI, etc.)                  │
├─────────────────────────────────────────────────────────────┤
│ 1. User configures task                                     │
│ 2. Optionally selects standard skills                       │
│ 3. Generates manifest.json                                  │
│    POST /api/sessions/spawn                                 │
│    {                                                         │
│      projectId, taskIds, role, skills,                     │
│      model, permissionMode                                  │
│    }                                                         │
│ 4. Server generates manifest via CLI:                       │
│    $ maestro manifest generate \                            │
│        --role worker \                                      │
│        --project-id proj-1 \                                │
│        --task-ids task-1,task-2 \                           │
│        --skills code-visualizer \                           │
│        --output ~/.maestro/sessions/sess-123/manifest.json  │
│ 5. Saves manifest to session directory                      │
│ 6. Spawns terminal with environment variables               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Spawns terminal:
                         │ MAESTRO_MANIFEST_PATH=~/.maestro/sessions/sess-123/manifest.json
                         │ MAESTRO_SESSION_ID=sess-123
                         │ MAESTRO_PROJECT_ID=proj-1
                         │ MAESTRO_API_URL=http://localhost:3000
                         │
                         │ $ maestro worker init
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      MAESTRO CLI                             │
├─────────────────────────────────────────────────────────────┤
│ maestro worker init:                                        │
│                                                              │
│ 1. Read manifest from MAESTRO_MANIFEST_PATH                 │
│ 2. Validate manifest structure (Ajv schema)                 │
│ 3. Generate system prompt from template                     │
│    - Load templates/worker-prompt.md                        │
│    - Replace ${VARIABLES} with manifest data                │
│ 4. Load standard skills from manifest.skills[]              │
│    - Discover in ~/.skills/ directory                       │
│    - Validate skill directories exist                       │
│    - Gracefully skip missing skills                         │
│ 5. Display session brief (formatted task info)              │
│    - Show task title, description, criteria                 │
│    - Show skills, model, permissions                        │
│ 6. Spawn Claude Code:                                       │
│    $ claude \                                               │
│        --model sonnet \                                     │
│        --permission-mode acceptEdits \                      │
│        --plugin-dir ~/.skills/code-visualizer \             │
│        --append-system-prompt /tmp/worker-prompt.txt        │
│ 7. Monitor Claude process                                   │
│ 8. On exit: cleanup and report                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP API calls during session:
                         │ - PATCH /api/tasks/{id} (sessionStatus)
                         │ - POST /api/sessions/{id}/timeline
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    MAESTRO SERVER                            │
│                   (Optional Component)                       │
├─────────────────────────────────────────────────────────────┤
│ • Task CRUD operations                                      │
│ • Session tracking                                          │
│ • Progress updates                                          │
│ • WebSocket broadcasting to UI                              │
│ • Database persistence                                      │
└─────────────────────────────────────────────────────────────┘
```

### Orchestrator → Worker Spawn Flow

```
┌─────────────────────────────────────────────────────────────┐
│              ORCHESTRATOR SESSION                            │
│           (Claude running as orchestrator)                   │
├─────────────────────────────────────────────────────────────┤
│ 1. Orchestrator analyzes task                               │
│ 2. Decides to delegate work to worker                        │
│ 3. Runs command:                                             │
│    $ maestro session spawn \                                │
│        --task task-123 \                                    │
│        --skill code-visualizer                              │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MAESTRO CLI                                │
│              (maestro session spawn)                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Fetch task data from server:                             │
│    GET /api/tasks/task-123                                  │
│                                                              │
│ 2. Create session via server:                               │
│    POST /api/sessions/spawn                                 │
│    {                                                         │
│      projectId: task.projectId,                            │
│      taskIds: ['task-123'],                                │
│      role: 'worker',                                        │
│      skills: ['code-visualizer'],                          │
│      spawnedBy: process.env.MAESTRO_SESSION_ID,            │
│      spawnSource: 'orchestrator'                            │
│    }                                                         │
│                                                              │
│ 3. Server generates manifest                                 │
│ 4. Server creates session record                            │
│ 5. Server emits session:created event via WebSocket         │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      UI (WebSocket)                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Receives session:created event                           │
│ 2. Creates new terminal session                             │
│ 3. Sets environment variables:                              │
│    - MAESTRO_MANIFEST_PATH                                  │
│    - MAESTRO_SESSION_ID                                     │
│    - MAESTRO_PROJECT_ID                                     │
│ 4. Runs: maestro worker init                                │
│ 5. Worker session starts (follows worker flow above)        │
└─────────────────────────────────────────────────────────────┘
```

### Session Lifecycle States

```
┌─────────────────────────────────────────────────────────────┐
│                  SESSION LIFECYCLE                           │
└─────────────────────────────────────────────────────────────┘

CREATION
  ↓
  POST /api/sessions/spawn
  • Server creates session record (status: 'spawning')
  • Server generates manifest
  • Server emits session:created event
  ↓
SPAWNING
  ↓
  UI creates terminal with environment variables
  ↓
INITIALIZATION
  ↓
  $ maestro worker init
  • Read manifest
  • Validate manifest
  • Generate prompt
  • Load skills
  • Display session brief
  • Task status auto-updated to 'in_progress'
  ↓
RUNNING
  ↓
  $ claude --model sonnet ... (session active)
  • Agent reports progress via CLI commands
  • Updates sent to server via API
  • Task status updates based on agent reports
  ↓
COMPLETION
  ↓
  Agent runs: maestro report complete "..."
  • sessionStatus → 'completed'
  • status remains 'in_progress' (worker cannot change)
  ↓
REVIEW
  ↓
  User/Orchestrator reviews work
  ├─ Approves → status: 'completed' (user/orchestrator sets)
  └─ Cancels → status: 'cancelled' (user only)
  ↓
TERMINAL STATE
  • status: 'completed' | 'cancelled'
  • Session marked as completed
```

### Spawn Relationship Tracking

When orchestrator spawns worker, relationship is tracked:

```typescript
// Orchestrator session
{
  "id": "sess-orch-789",
  "role": "orchestrator",
  "taskIds": ["task-project-init"],
  "spawnedSessions": ["sess-worker-123", "sess-worker-456"]
}

// Worker session (spawned by orchestrator)
{
  "id": "sess-worker-123",
  "role": "worker",
  "taskIds": ["task-123"],
  "spawnedBy": "sess-orch-789",
  "spawnSource": "orchestrator",
  "parentSessionId": "sess-orch-789"
}
```

## Core Components

### 1. ManifestReader

**Responsibility**: Read, validate, and parse manifests

```typescript
// src/services/manifest-reader.ts

import { readFile } from 'fs/promises';
import { validateManifest } from '../utils/validator';
import { MaestroManifest } from '../types/manifest';

export class ManifestReader {
  async read(manifestPath: string): Promise<MaestroManifest> {
    // Read file
    const content = await readFile(manifestPath, 'utf-8');

    // Parse JSON
    let manifest: unknown;
    try {
      manifest = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse manifest: ${error.message}`);
    }

    // Validate schema
    if (!validateManifest(manifest)) {
      throw new Error('Invalid manifest structure');
    }

    return manifest;
  }
}
```

### 2. PromptGenerator

**Responsibility**: Generate system prompts from templates

```typescript
// src/services/prompt-generator.ts

import { readFile } from 'fs/promises';
import { join } from 'path';
import { MaestroManifest } from '../types/manifest';

export class PromptGenerator {
  private templatesDir = join(__dirname, '..', 'templates');

  async generate(manifest: MaestroManifest): Promise<string> {
    // Load appropriate template
    const templateFile = manifest.role === 'worker'
      ? 'worker-prompt.md'
      : 'orchestrator-prompt.md';

    const templatePath = join(this.templatesDir, templateFile);
    let template = await readFile(templatePath, 'utf-8');

    // Build variable map
    const variables = this.extractVariables(manifest);

    // Replace all variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      template = template.replace(regex, value);
    }

    return template;
  }

  private extractVariables(manifest: MaestroManifest): Record<string, string> {
    const task = manifest.tasks[0]; // Primary task

    return {
      MAESTRO_TASK_ID: task.id,
      TASK_TITLE: task.title,
      TASK_DESCRIPTION: task.description,
      PARENT_TASK_ID: task.parentId || 'None (root task)',
      ACCEPTANCE_CRITERIA_LIST: this.formatCriteria(task.acceptanceCriteria),
      MAESTRO_API_URL: process.env.MAESTRO_API_URL || 'Not configured',
      PROJECT_ID: task.projectId,
      SESSION_ID: process.env.MAESTRO_SESSION_ID || 'Unknown'
    };
  }

  private formatCriteria(criteria: string[]): string {
    return criteria
      .map((c, idx) => `${idx + 1}. ${c}`)
      .join('\n');
  }
}
```

### 3. SkillLoader

**Responsibility**: Discover and load standard skills

```typescript
// src/services/skill-loader.ts

import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export class SkillLoader {
  private skillsDir = join(homedir(), '.skills');

  async discover(): Promise<string[]> {
    // List all directories in .skills/
    if (!existsSync(this.skillsDir)) {
      return [];
    }

    const entries = await readdir(this.skillsDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  }

  async load(skillNames: string[]): Promise<string[]> {
    const skillPaths: string[] = [];

    for (const skillName of skillNames) {
      const skillPath = join(this.skillsDir, skillName);

      if (!existsSync(skillPath)) {
        console.warn(`⚠️  Skill not found: ${skillName}`);
        continue;
      }

      // Validate it's a valid skill directory
      const skillFile = join(skillPath, 'skill.md');
      if (!existsSync(skillFile)) {
        console.warn(`⚠️  Invalid skill directory: ${skillName} (missing skill.md)`);
        continue;
      }

      skillPaths.push(skillPath);
    }

    return skillPaths;
  }
}
```

### 4. ClaudeSpawner

**Responsibility**: Spawn and manage Claude Code process

```typescript
// src/services/claude-spawner.ts

import { spawn, ChildProcess } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

interface SpawnConfig {
  model: string;
  permissionMode: string;
  thinkingMode?: string;
  systemPrompt: string;
  skillPaths: string[];
  workingDirectory?: string;
}

export class ClaudeSpawner {
  async spawn(config: SpawnConfig): Promise<ChildProcess> {
    // Save system prompt to temp file
    const promptFile = join(tmpdir(), `maestro-prompt-${Date.now()}.md`);
    await writeFile(promptFile, config.systemPrompt);

    // Build Claude CLI arguments
    const args = [
      '--model', config.model,
      '--permission-mode', config.permissionMode,
      '--append-system-prompt', promptFile
    ];

    // Add thinking mode if specified
    if (config.thinkingMode) {
      args.push('--thinking-mode', config.thinkingMode);
    }

    // Add skill directories
    for (const skillPath of config.skillPaths) {
      args.push('--plugin-dir', skillPath);
    }

    // Spawn Claude process
    const claudeProcess = spawn('claude', args, {
      cwd: config.workingDirectory || process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        // Preserve Maestro env vars for CLI commands
        MAESTRO_PROJECT_ID: process.env.MAESTRO_PROJECT_ID,
        MAESTRO_SESSION_ID: process.env.MAESTRO_SESSION_ID,
        MAESTRO_API_URL: process.env.MAESTRO_API_URL,
        MAESTRO_MANIFEST_PATH: process.env.MAESTRO_MANIFEST_PATH
      }
    });

    // Clean up temp file when process exits
    claudeProcess.on('exit', async () => {
      try {
        await unlink(promptFile);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    return claudeProcess;
  }
}
```

### 5. HookExecutor

**Responsibility**: Execute lifecycle hooks

```typescript
// src/services/hook-executor.ts

import { ServerClient } from './server-client';
import { MaestroManifest } from '../types/manifest';

export class HookExecutor {
  constructor(private serverClient: ServerClient) {}

  async sessionStart(manifest: MaestroManifest): Promise<void> {
    const sessionId = process.env.MAESTRO_SESSION_ID;
    const projectId = process.env.MAESTRO_PROJECT_ID;

    if (!sessionId || !projectId) {
      console.warn('⚠️  Missing session/project ID, skipping server report');
      return;
    }

    try {
      await this.serverClient.createSession({
        id: sessionId,
        projectId,
        taskIds: manifest.tasks.map(t => t.id),
        status: 'running',
        startedAt: new Date().toISOString(),
        role: manifest.role
      });

      console.log(`✅ Session ${sessionId} reported to server`);
    } catch (error) {
      console.warn(`⚠️  Failed to report session start: ${error.message}`);
      // Don't fail - continue even if server is unreachable
    }
  }

  async sessionEnd(exitCode: number | null): Promise<void> {
    const sessionId = process.env.MAESTRO_SESSION_ID;

    if (!sessionId) {
      return;
    }

    try {
      await this.serverClient.updateSession(sessionId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        exitCode: exitCode || 0
      });

      console.log(`✅ Session ${sessionId} completion reported to server`);
    } catch (error) {
      console.warn(`⚠️  Failed to report session end: ${error.message}`);
    }
  }
}
```

### 6. ServerClient

**Responsibility**: HTTP client for Maestro server

```typescript
// src/services/server-client.ts

export class ServerClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.MAESTRO_API_URL || 'http://localhost:3000';
  }

  async createSession(data: SessionCreateData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
  }

  async updateSession(sessionId: string, data: SessionUpdateData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
  }

  async getTask(taskId: string): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}`);

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    return response.json();
  }

  // ... more API methods
}
```

## Command Implementation

### Worker Init Command

```typescript
// src/commands/worker.ts

import { Command } from 'commander';
import { ManifestReader } from '../services/manifest-reader';
import { PromptGenerator } from '../services/prompt-generator';
import { SkillLoader } from '../services/skill-loader';
import { ClaudeSpawner } from '../services/claude-spawner';
import { HookExecutor } from '../services/hook-executor';
import { ServerClient } from '../services/server-client';
import { validateEnvironment } from '../utils/config';

export function registerWorkerCommands(program: Command) {
  const worker = program.command('worker').description('Worker session management');

  worker
    .command('init')
    .description('Initialize Maestro worker session')
    .action(async () => {
      try {
        // 1. Validate environment
        validateEnvironment(['MAESTRO_MANIFEST_PATH', 'MAESTRO_SESSION_ID', 'MAESTRO_PROJECT_ID']);

        const manifestPath = process.env.MAESTRO_MANIFEST_PATH!;

        console.log('🚀 Maestro Worker Initialization\n');

        // 2. Read and validate manifest
        const manifestReader = new ManifestReader();
        console.log('📄 Reading manifest...');
        const manifest = await manifestReader.read(manifestPath);
        console.log(`✅ Manifest loaded: ${manifest.tasks[0].title}\n`);

        // 3. Generate system prompt
        const promptGenerator = new PromptGenerator();
        console.log('📝 Generating system prompt...');
        const systemPrompt = await promptGenerator.generate(manifest);
        console.log('✅ System prompt generated\n');

        // 4. Load skills (if any)
        let skillPaths: string[] = [];
        if (manifest.skills && manifest.skills.length > 0) {
          const skillLoader = new SkillLoader();
          console.log(`🔌 Loading ${manifest.skills.length} skill(s)...`);
          skillPaths = await skillLoader.load(manifest.skills);
          console.log(`✅ Loaded ${skillPaths.length} skill(s)\n`);
        }

        // 5. Execute SessionStart hook
        const serverClient = new ServerClient();
        const hookExecutor = new HookExecutor(serverClient);
        await hookExecutor.sessionStart(manifest);
        console.log('');

        // 6. Spawn Claude Code
        const spawner = new ClaudeSpawner();
        console.log('🤖 Spawning Claude Code session...\n');
        console.log('─'.repeat(60));

        const claudeProcess = await spawner.spawn({
          model: manifest.session.model,
          permissionMode: manifest.session.permissionMode,
          thinkingMode: manifest.session.thinkingMode,
          systemPrompt,
          skillPaths,
          workingDirectory: manifest.session.workingDirectory
        });

        // 7. Handle process exit
        claudeProcess.on('exit', async (code) => {
          console.log('─'.repeat(60));
          console.log(`\n✅ Claude session exited with code ${code || 0}\n`);

          // Execute SessionEnd hook
          await hookExecutor.sessionEnd(code);

          process.exit(code || 0);
        });

      } catch (error) {
        console.error(`\n❌ Worker initialization failed:\n${error.message}\n`);
        process.exit(1);
      }
    });
}
```

## Error Handling

### Error Classes

```typescript
// src/utils/errors.ts

export class MaestroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaestroError';
  }
}

export class ManifestError extends MaestroError {
  constructor(message: string) {
    super(`Manifest error: ${message}`);
    this.name = 'ManifestError';
  }
}

export class EnvironmentError extends MaestroError {
  constructor(variable: string) {
    super(`Missing required environment variable: ${variable}`);
    this.name = 'EnvironmentError';
  }
}

export class SkillError extends MaestroError {
  constructor(skillName: string, reason: string) {
    super(`Skill error (${skillName}): ${reason}`);
    this.name = 'SkillError';
  }
}
```

### Validation

```typescript
// src/utils/config.ts

import { EnvironmentError } from './errors';

export function validateEnvironment(required: string[]): void {
  for (const variable of required) {
    if (!process.env[variable]) {
      throw new EnvironmentError(variable);
    }
  }
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new EnvironmentError(name);
  }
  return value;
}

export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}
```

## Configuration

### Environment Variables

```typescript
// src/utils/config.ts

export interface MaestroConfig {
  manifestPath: string;
  projectId: string;
  sessionId: string;
  apiUrl: string;
  debug: boolean;
}

export function loadConfig(): MaestroConfig {
  return {
    manifestPath: getRequiredEnv('MAESTRO_MANIFEST_PATH'),
    projectId: getRequiredEnv('MAESTRO_PROJECT_ID'),
    sessionId: getRequiredEnv('MAESTRO_SESSION_ID'),
    apiUrl: getOptionalEnv('MAESTRO_API_URL', 'http://localhost:3000'),
    debug: process.env.MAESTRO_DEBUG === 'true'
  };
}
```

## Logging

```typescript
// src/utils/logger.ts

export class Logger {
  constructor(private debug: boolean = false) {}

  info(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.warn(`⚠️  ${message}`);
  }

  error(message: string): void {
    console.error(`❌ ${message}`);
  }

  debug(message: string): void {
    if (this.debug) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  success(message: string): void {
    console.log(`✅ ${message}`);
  }
}
```

## Summary

The CLI architecture is:
- ✅ **Simple**: One clear data flow
- ✅ **Modular**: Independent services
- ✅ **Testable**: Each component in isolation
- ✅ **Robust**: Comprehensive error handling
- ✅ **Extensible**: Easy to add new commands

Next: [03-SYSTEM-PROMPTS.md](./03-SYSTEM-PROMPTS.md) - System prompt templates
