# Maestro Integration - Final Architecture

## The Clean Architecture: Server-Generated Manifests

This document describes the **final, clean architecture** where the server orchestrates manifest generation by calling the CLI as a child process.

---

## Complete Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS "TASK EXEC" IN UI                            │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. UI → Server                                               │
│    POST /api/sessions/spawn                                  │
│    {                                                         │
│      projectId: "proj_123",                                  │
│      taskIds: ["task_456"],                                  │
│      skills: ["maestro-worker"]                              │
│    }                                                         │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. SERVER PREPARATION                                        │
│    • Validates input                                         │
│    • Fetches project details (working directory)             │
│    • Fetches task details (description, criteria, etc.)      │
│    • Creates session record                                  │
│    • Updates task.sessionIds                                 │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. SERVER → CLI (Child Process)                             │
│    Executes: maestro manifest generate                       │
│              --project-id proj_123                           │
│              --task-id task_456                              │
│              --skills maestro-worker                         │
│              --output /tmp/manifest-sess_123.json            │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. CLI GENERATES MANIFEST                                    │
│    • Fetches task data from server API                       │
│    • Builds MaestroManifest object                           │
│    • Validates against schema                                │
│    • Writes to /tmp/manifest-sess_123.json                   │
│    • Exits with manifest path                                │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. SERVER RECEIVES MANIFEST                                  │
│    • Reads manifest from /tmp/manifest-sess_123.json         │
│    • Parses JSON                                             │
│    • Validates manifest                                      │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. SERVER PREPARES COMPLETE SPAWN DATA                       │
│    command = "maestro worker init"                           │
│    cwd = project.workingDir                                  │
│    envVars = {                                               │
│      MAESTRO_SESSION_ID: "sess_123",                         │
│      MAESTRO_PROJECT_ID: "proj_123",                         │
│      MAESTRO_TASK_IDS: "task_456",                           │
│      MAESTRO_MANIFEST_PATH: "/tmp/manifest-sess_123.json",   │
│      MAESTRO_SERVER_URL: "http://localhost:3000",            │
│      MAESTRO_SKILLS: "maestro-worker"                        │
│    }                                                         │
│    manifest = { ... } // The generated manifest              │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. SERVER → UI (WebSocket)                                   │
│    Emits: session:spawn_request                              │
│    {                                                         │
│      session: { ... },                                       │
│      command: "maestro worker init",                         │
│      cwd: "/path/to/project",                                │
│      envVars: { MAESTRO_* },                                 │
│      manifest: { ... }  // Pre-generated!                    │
│    }                                                         │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 9. UI RECEIVES EVENT                                         │
│    • WebSocket listener catches spawn_request                │
│    • Extracts: command, cwd, envVars                         │
│    • No additional API calls needed!                         │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 10. UI SPAWNS TERMINAL                                       │
│     invoke('create_session', {                               │
│       command: "maestro worker init",                        │
│       cwd: "/path/to/project",                               │
│       envVars: {                                             │
│         MAESTRO_MANIFEST_PATH: "/tmp/manifest-sess_123.json" │
│         // ... all other env vars                            │
│       }                                                      │
│     })                                                       │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 11. TERMINAL EXECUTES                                        │
│     $ maestro worker init                                    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 12. CLI (maestro worker init)                                │
│     • Reads MAESTRO_MANIFEST_PATH from env                   │
│     • Loads pre-generated manifest from file                 │
│     • Validates manifest                                     │
│     • Generates prompt from template + manifest              │
│     • Loads plugins (maestro-worker + skills)                │
│     • Spawns Claude with prompt and plugins                  │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 13. CLAUDE SESSION STARTS                                    │
│     • Reads system prompt with task context                  │
│     • Maestro commands available                             │
│     • Worker executes task                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### Server (maestro-server)

**Responsibilities:**
1. ✅ Receives spawn request via `POST /api/sessions/spawn`
2. ✅ Validates input (projectId, taskIds exist)
3. ✅ Fetches project and task data
4. ✅ Creates session record (status='spawning')
5. ✅ Updates task relationships
6. ✅ **Executes `maestro manifest generate` as child process**
7. ✅ **Reads generated manifest from file**
8. ✅ Prepares environment variables (including MAESTRO_MANIFEST_PATH)
9. ✅ Prepares command ("maestro worker init")
10. ✅ Emits `session:spawn_request` with complete data
11. ✅ Persists session to storage

**Does NOT:**
- ❌ Generate prompts from templates (CLI's job)
- ❌ Load plugins (CLI's job)
- ❌ Spawn Claude (CLI's job)
- ❌ Spawn terminals (UI's job)

### CLI (maestro-cli)

**Two Commands:**

#### Command 1: `maestro manifest generate`
**Purpose:** Generate manifest from task data (called by server)

**Responsibilities:**
1. ✅ Accepts parameters: --project-id, --task-id, --skills, --output
2. ✅ Fetches task data from server API
3. ✅ Builds MaestroManifest object
4. ✅ Validates against schema
5. ✅ Writes manifest to output file
6. ✅ Returns exit code 0 on success

**Does NOT:**
- ❌ Generate prompts
- ❌ Load plugins
- ❌ Spawn Claude
- ❌ Spawn processes

#### Command 2: `maestro worker init`
**Purpose:** Initialize worker session (called by terminal)

**Responsibilities:**
1. ✅ Reads MAESTRO_MANIFEST_PATH from environment
2. ✅ Loads pre-generated manifest from file
3. ✅ Validates manifest
4. ✅ Generates prompt from template + manifest data
5. ✅ Loads plugins (maestro-worker + skills from manifest)
6. ✅ Spawns Claude with prompt and plugins
7. ✅ Updates session status in server

**Does NOT:**
- ❌ Generate manifest (already generated by server)
- ❌ Fetch task data (already in manifest)

### UI (maestro-ui)

**Responsibilities:**
1. ✅ Calls `POST /api/sessions/spawn` when user clicks "Work on Task"
2. ✅ Listens for `session:spawn_request` WebSocket events
3. ✅ Spawns terminal with provided command, cwd, envVars

**Does NOT:**
- ❌ Fetch project or task data
- ❌ Generate manifests
- ❌ Prepare environment variables
- ❌ Build commands
- ❌ Know anything about manifest structure

---

## New CLI Command: `maestro manifest generate`

### Implementation

**File: `maestro-cli/src/commands/manifest-generator.ts`**

```typescript
import { Command } from 'commander';
import { MaestroManifest, Task } from '../types/manifest.js';
import { writeFile } from 'fs/promises';
import fetch from 'node-fetch';

interface GenerateOptions {
  projectId: string;
  taskId: string;
  skills?: string;
  output?: string;
  apiUrl?: string;
}

export class ManifestGeneratorCommand {
  async execute(options: GenerateOptions): Promise<void> {
    try {
      const {
        projectId,
        taskId,
        skills = 'maestro-worker',
        output,
        apiUrl = process.env.MAESTRO_API_URL || 'http://localhost:3000',
      } = options;

      console.log('📝 Generating manifest...');
      console.log(`   Project: ${projectId}`);
      console.log(`   Task: ${taskId}`);
      console.log(`   Skills: ${skills}`);

      // Fetch task data from server
      const task = await this.fetchTask(taskId, apiUrl);

      // Generate manifest
      const manifest = this.buildManifest(task, projectId, skills.split(','));

      // Validate manifest
      this.validateManifest(manifest);

      // Write to output file or stdout
      if (output) {
        await writeFile(output, JSON.stringify(manifest, null, 2), 'utf-8');
        console.log(`✅ Manifest written to: ${output}`);
      } else {
        // Output to stdout for server to capture
        console.log(JSON.stringify(manifest));
      }

      process.exit(0);
    } catch (error) {
      console.error('❌ Manifest generation failed:', error.message);
      process.exit(1);
    }
  }

  private async fetchTask(taskId: string, apiUrl: string): Promise<Task> {
    const response = await fetch(`${apiUrl}/api/tasks/${taskId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch task: ${response.statusText}`);
    }

    return await response.json();
  }

  private buildManifest(
    task: Task,
    projectId: string,
    skills: string[]
  ): MaestroManifest {
    return {
      manifestVersion: '1.0',
      role: 'worker',
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        projectId,
        acceptanceCriteria: task.acceptanceCriteria || [],
        technicalNotes: task.technicalNotes,
        dependencies: task.dependencies || [],
        priority: task.priority || 'medium',
        complexity: task.complexity || 'medium',
        estimatedHours: task.estimatedHours,
        createdAt: new Date(task.createdAt).toISOString(),
        metadata: task.metadata,
      },
      session: {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
        thinkingMode: 'auto',
        workingDirectory: process.cwd(), // Will be overridden by server
      },
      context: {
        codebaseContext: task.codebaseContext,
        relatedTasks: task.relatedTasks || [],
        projectStandards: task.projectStandards,
      },
      skills,
    };
  }

  private validateManifest(manifest: MaestroManifest): void {
    if (!manifest.manifestVersion) {
      throw new Error('Manifest must have manifestVersion');
    }
    if (!manifest.role) {
      throw new Error('Manifest must have role');
    }
    if (!manifest.task) {
      throw new Error('Manifest must have task');
    }
    // Add more validation as needed
  }
}

// Register command
export function registerManifestCommands(program: Command): void {
  program
    .command('manifest')
    .description('Manifest generation commands')
    .command('generate')
    .description('Generate manifest from task data')
    .requiredOption('--project-id <id>', 'Project ID')
    .requiredOption('--task-id <id>', 'Task ID')
    .option('--skills <skills>', 'Comma-separated skill names', 'maestro-worker')
    .option('--output <path>', 'Output file path (default: stdout)')
    .option('--api-url <url>', 'Maestro API URL', process.env.MAESTRO_API_URL || 'http://localhost:3000')
    .action(async (options) => {
      const command = new ManifestGeneratorCommand();
      await command.execute(options);
    });
}
```

### Usage

```bash
# Generate manifest to file
maestro manifest generate \
  --project-id proj_123 \
  --task-id task_456 \
  --skills maestro-worker,git-helper \
  --output /tmp/manifest-sess_789.json

# Generate manifest to stdout (for server to capture)
maestro manifest generate \
  --project-id proj_123 \
  --task-id task_456 \
  --skills maestro-worker
```

---

## Server Implementation

### Updated spawn endpoint

**File: `maestro-server/src/api/sessions.ts`**

```typescript
import { spawn } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

router.post('/spawn', async (req, res) => {
  try {
    const { projectId, taskIds, skills, sessionName, spawnSource } = req.body;

    // ... validation ...

    // Fetch project and tasks
    const project = storage.getProject(projectId);
    const tasks = taskIds.map(id => storage.getTask(id)!);
    const primaryTask = tasks[0];

    // Create session
    const session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      taskIds,
      name: sessionName || `Worker: ${primaryTask.title}`,
      status: 'spawning',
      // ... rest of session
    };

    // === GENERATE MANIFEST VIA CLI ===
    const manifestPath = path.join(os.tmpdir(), `manifest-${session.id}.json`);

    console.log('📝 Generating manifest via CLI...');
    const manifest = await generateManifest({
      projectId,
      taskId: primaryTask.id,
      skills: (skills || ['maestro-worker']).join(','),
      output: manifestPath,
    });

    console.log('✅ Manifest generated');

    // Prepare environment variables
    const envVars = {
      MAESTRO_SESSION_ID: session.id,
      MAESTRO_PROJECT_ID: projectId,
      MAESTRO_TASK_IDS: taskIds.join(','),
      MAESTRO_PRIMARY_TASK_ID: taskIds[0],
      MAESTRO_SERVER_URL: process.env.SERVER_URL || 'http://localhost:3000',
      MAESTRO_API_URL: process.env.SERVER_URL || 'http://localhost:3000',
      MAESTRO_SKILLS: (skills || ['maestro-worker']).join(','),
      MAESTRO_MANIFEST_PATH: manifestPath,  // ← Path to pre-generated manifest
    };

    // Prepare command and working directory
    const command = 'maestro worker init';
    const cwd = project.workingDir;

    // Store session
    const createdSession = storage.createSession(session, { _suppressCreatedEvent: true });

    // Add session to all tasks
    for (const taskId of taskIds) {
      storage.addSessionToTask(taskId, session.id);
    }

    // Emit spawn_request with complete data
    storage.emit('session:spawn_request', {
      session: createdSession,
      projectId,
      taskIds,
      skillIds: skills || ['maestro-worker'],
      name: session.name,
      // Complete spawn data
      command,        // "maestro worker init"
      cwd,           // "/path/to/project"
      envVars,       // Including MAESTRO_MANIFEST_PATH
      manifest,      // Pre-generated manifest object
    });

    // Emit session:created
    storage.emit('session:created', createdSession);

    res.status(201).json({
      success: true,
      sessionId: session.id,
      message: 'Spawn request sent to Agents UI',
      session: createdSession,
    });

  } catch (error) {
    console.error('Spawn error:', error);
    res.status(500).json({
      error: 'spawn_error',
      message: error.message,
    });
  }
});

// Helper function to generate manifest via CLI
async function generateManifest(options: {
  projectId: string;
  taskId: string;
  skills: string;
  output: string;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [
      'manifest',
      'generate',
      '--project-id', options.projectId,
      '--task-id', options.taskId,
      '--skills', options.skills,
      '--output', options.output,
    ];

    const child = spawn('maestro', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('exit', async (code) => {
      if (code === 0) {
        // Read the generated manifest file
        try {
          const manifestContent = await readFile(options.output, 'utf-8');
          const manifest = JSON.parse(manifestContent);
          resolve(manifest);
        } catch (error) {
          reject(new Error(`Failed to read manifest: ${error.message}`));
        }
      } else {
        reject(new Error(`Manifest generation failed: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn maestro CLI: ${error.message}`));
    });
  });
}
```

---

## Updated `maestro worker init`

**File: `maestro-cli/src/commands/worker-init.ts`**

```typescript
export class WorkerInitCommand {
  async execute(): Promise<void> {
    try {
      console.log('🔧 Initializing Maestro Worker Session\n');

      // Read manifest path from environment
      const manifestPath = this.getRequiredEnv('MAESTRO_MANIFEST_PATH');
      const sessionId = this.getRequiredEnv('MAESTRO_SESSION_ID');

      console.log(`📋 Loading manifest: ${manifestPath}`);

      // Load pre-generated manifest
      const manifest = await this.loadManifest(manifestPath);

      console.log('✅ Manifest loaded');
      console.log(`   Task: ${manifest.task.title}`);
      console.log(`   Skills: ${manifest.skills.join(', ')}\n`);

      // Validate manifest
      this.validateManifest(manifest);

      // Spawn Claude Code session
      console.log('🚀 Spawning Claude Code session...\n');
      const spawner = new ClaudeSpawner();
      const result = await spawner.spawn(manifest, sessionId, { interactive: true });

      console.log('✅ Claude Code session started\n');

      // Wait for Claude to exit
      await new Promise<void>((resolve, reject) => {
        result.process.on('exit', async (code) => {
          // Clean up manifest file
          try {
            await fs.unlink(manifestPath);
            console.log('🧹 Cleaned up manifest file');
          } catch (error) {
            console.warn('Warning: Failed to clean up manifest:', error.message);
          }

          // Clean up prompt file
          try {
            await fs.unlink(result.promptFile);
            console.log('🧹 Cleaned up prompt file');
          } catch (error) {
            console.warn('Warning: Failed to clean up prompt:', error.message);
          }

          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Claude exited with code ${code}`));
          }
        });
      });

    } catch (error) {
      console.error('❌ Worker init failed:', error.message);
      process.exit(1);
    }
  }

  private async loadManifest(manifestPath: string): Promise<MaestroManifest> {
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }

  private validateManifest(manifest: MaestroManifest): void {
    if (!manifest.manifestVersion || manifest.manifestVersion !== '1.0') {
      throw new Error('Invalid manifest version');
    }
    if (manifest.role !== 'worker') {
      throw new Error('Manifest role must be "worker"');
    }
    // Add more validation...
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} environment variable is required but not set`);
    }
    return value;
  }
}
```

---

## Environment Variables

### Set by Server (passed to UI → Terminal)

```bash
MAESTRO_SESSION_ID=sess_1707019200000_abc123
MAESTRO_PROJECT_ID=proj_123
MAESTRO_TASK_IDS=task_456,task_789
MAESTRO_PRIMARY_TASK_ID=task_456
MAESTRO_SERVER_URL=http://localhost:3000
MAESTRO_API_URL=http://localhost:3000
MAESTRO_SKILLS=maestro-worker,git-helper
MAESTRO_MANIFEST_PATH=/tmp/manifest-sess_1707019200000_abc123.json  # ← NEW!
```

---

## Benefits of This Architecture

### 1. Server Orchestrates Everything
- Server controls when and how manifests are generated
- Server can validate manifests before sending to UI
- Server can modify manifests if needed
- Server is the single source of truth

### 2. CLI is a Pure Tool
- `maestro manifest generate` - generates manifests (called by server)
- `maestro worker init` - initializes sessions (called by terminal)
- Each command has a single, clear purpose
- No overlap in responsibilities

### 3. UI is Extremely Simple
- Just receives spawn data and spawns terminal
- No knowledge of manifest structure
- No API calls for data preparation
- Pure view layer

### 4. Manifest is Pre-Generated
- Terminal doesn't need to fetch task data
- Terminal doesn't need to generate manifest
- Faster startup time
- Consistent manifests (same task = same manifest)

### 5. Easy to Test
```bash
# Test manifest generation
maestro manifest generate --project-id proj_123 --task-id task_456 --output /tmp/test.json

# Inspect manifest
cat /tmp/test.json

# Test worker init with pre-generated manifest
export MAESTRO_MANIFEST_PATH=/tmp/test.json
export MAESTRO_SESSION_ID=test_123
maestro worker init
```

---

## Summary

**The Clean Architecture:**

1. ✅ Server receives spawn request
2. ✅ Server calls `maestro manifest generate` (child process)
3. ✅ CLI generates manifest and returns to server
4. ✅ Server packages everything (command, cwd, envVars, manifest)
5. ✅ Server sends to UI via WebSocket
6. ✅ UI spawns terminal with `maestro worker init`
7. ✅ Terminal uses pre-generated manifest
8. ✅ Claude starts with complete context

**Each component has a single, clear responsibility:**
- **Server**: Orchestrates and prepares
- **CLI**: Generates manifests and spawns Claude
- **UI**: Displays and spawns terminals

**This is the cleanest architecture!** 🎉
