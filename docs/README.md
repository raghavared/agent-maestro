# Maestro Integration Guide

Complete documentation for integrating UI → Server → CLI → Claude Worker using **server-generated manifests**.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Complete Flow](#complete-flow)
3. [Implementation Guide](#implementation-guide)
4. [Environment Variables](#environment-variables)
5. [API Contracts](#api-contracts)
6. [Troubleshooting](#troubleshooting)
7. [Examples](#examples)

---

## Architecture Overview

The Maestro system uses a **server-orchestrated, manifest-driven architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENTS UI (Tauri)                        │
│  • Terminal spawning                                            │
│  • WebSocket client                                             │
│  • NO business logic, NO manifest generation                    │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP API (CRUD)
             │ WebSocket (Events)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MAESTRO SERVER (Node.js)                    │
│  • JSON file storage (~/.maestro/)                              │
│  • Calls CLI for manifest generation                            │
│  • WebSocket broadcaster                                        │
│  • REST API endpoints                                           │
│  • Orchestrates spawn flow                                      │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Executes CLI
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAESTRO CLI (Commander.js)                   │
│  • maestro manifest generate (called by server)                 │
│  • maestro worker init (called by terminal)                     │
│  • Prompt generation from templates                             │
│  • Plugin/skill loading                                         │
│  • Claude spawning                                              │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Process spawn
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLAUDE CODE SESSION                        │
│  • Interactive AI agent                                         │
│  • Maestro commands available (via plugins)                     │
│  • Task execution                                               │
│  • Progress reporting to server                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Server Orchestrates**: Server controls manifest generation by calling CLI
2. **Manifest-Driven**: All spawn data in pre-generated manifest file
3. **Minimal Env Vars**: Only MAESTRO_SESSION_ID and MAESTRO_MANIFEST_PATH
4. **Event-Driven UI**: UI responds to WebSocket events to spawn sessions
5. **CLI as Tool**: CLI commands are pure tools, called by server or terminal

---

## Complete Flow

### From UI Click to Claude Worker Execution

```
USER CLICKS "START TASK" IN UI
    │
    ├─ Step 1: UI calls server spawn endpoint
    │           POST /api/sessions/spawn
    │           {
    │             "projectId": "proj_123",
    │             "taskIds": ["task_456"],
    │             "role": "worker",
    │             "skills": ["maestro-worker"],
    │             "spawnSource": "manual"
    │           }
    │
    ├─ Step 2: Server validates input
    │           • Validates project exists
    │           • Validates tasks exist
    │           • Creates session record
    │
    ├─ Step 3: Server generates manifest via CLI
    │           Executes: maestro manifest generate \
    │                      --role worker \
    │                      --project-id proj_123 \
    │                      --task-ids task_456 \
    │                      --skills maestro-worker \
    │                      --api-url http://localhost:3000 \
    │                      --output ~/.maestro/sessions/sess_789/manifest.json
    │
    ├─ Step 4: CLI generates manifest
    │           • Fetches task data from server API
    │           • Fetches project data for working directory
    │           • Builds MaestroManifest object
    │           • Validates against schema
    │           • Writes to ~/.maestro/sessions/sess_789/manifest.json
    │           • Exits with code 0
    │
    ├─ Step 5: Server prepares spawn data
    │           command = "maestro worker init"
    │           cwd = project.workingDir (from manifest)
    │           envVars = {
    │             MAESTRO_SESSION_ID: "sess_789",
    │             MAESTRO_MANIFEST_PATH: "~/.maestro/sessions/sess_789/manifest.json",
    │             MAESTRO_SERVER_URL: "http://localhost:3000"
    │           }
    │
    ├─ Step 6: Server broadcasts WebSocket event
    │           Event: 'session:spawn_request'
    │           Data: {
    │             session: { ... },
    │             command: "maestro worker init",
    │             cwd: "/path/to/project",
    │             envVars: { MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, ... }
    │           }
    │
    ├─ Step 7: UI receives spawn request event
    │           • WebSocket listener catches event
    │           • Extracts: command, cwd, envVars
    │
    ├─ Step 8: UI spawns terminal
    │           invoke('create_session', {
    │             command: "maestro worker init",
    │             cwd: "/path/to/project",
    │             envVars: {
    │               MAESTRO_SESSION_ID: "sess_789",
    │               MAESTRO_MANIFEST_PATH: "~/.maestro/sessions/sess_789/manifest.json",
    │               MAESTRO_SERVER_URL: "http://localhost:3000"
    │             }
    │           })
    │
    ├─ Step 9: Terminal executes "maestro worker init"
    │           CLI worker init command starts
    │
    ├─ Step 10: CLI reads pre-generated manifest
    │            • Reads MAESTRO_MANIFEST_PATH from env
    │            • Loads manifest from file
    │            • Validates manifest
    │            • All task/project data is in manifest
    │
    ├─ Step 11: CLI generates prompt from template
    │            • Loads /maestro-cli/templates/worker-prompt.md
    │            • Substitutes variables from manifest
    │            • Writes to /tmp/maestro-prompt-{id}.md
    │
    ├─ Step 12: CLI loads plugins and skills
    │            • Loads maestro-worker plugin
    │            • Loads additional skills from manifest
    │            • Prepares --plugin-dir arguments
    │
    ├─ Step 13: CLI spawns Claude Code
    │            spawn('claude', [
    │              '--plugin-dir', '/path/to/maestro-worker',
    │              '--model', manifest.session.model,
    │              '/tmp/maestro-prompt-{id}.md'
    │            ], {
    │              cwd: manifest.session.workingDirectory,
    │              env: { MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, ... },
    │              stdio: 'inherit'
    │            })
    │
    ├─ Step 14: CLI updates session status
    │            PATCH /api/sessions/:id { status: 'running' }
    │            • Server broadcasts session:updated event
    │
    ├─ Step 15: Claude session executes task
    │            • Claude reads task from manifest
    │            • Calls: maestro task-start
    │            • Makes code changes
    │            • Calls: maestro update "Progress message"
    │            • Runs tests
    │            • Calls: maestro task-complete
    │
    └─ Step 16: Session completes
               • Claude exits
               • SessionEnd hook executes
               • PATCH /api/sessions/:id { status: 'completed' }
               • Manifest file cleaned up (optional)
```

---

## Implementation Guide

### 1. Server Implementation

#### A. Spawn Endpoint with CLI Manifest Generation

**File: `maestro-server/src/api/sessions.ts`**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

const execAsync = promisify(exec);

router.post('/spawn', async (req, res) => {
  try {
    const { projectId, taskIds, role, skills, spawnSource, spawnedBy } = req.body;

    // Validate required fields
    if (!projectId || !taskIds || !role || !spawnSource) {
      return res.status(400).json({
        error: 'missing_required_fields',
        message: 'projectId, taskIds, role, and spawnSource are required',
      });
    }

    // Validate spawn source
    if (!['manual', 'orchestrator'].includes(spawnSource)) {
      return res.status(400).json({
        error: 'invalid_spawn_source',
        message: 'spawnSource must be "manual" or "orchestrator"',
      });
    }

    // Validate project and tasks exist
    const project = storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'project_not_found' });
    }

    for (const taskId of taskIds) {
      if (!storage.getTask(taskId)) {
        return res.status(404).json({ error: 'task_not_found', taskId });
      }
    }

    // Create session ID and manifest path
    const sessionId = storage.makeId('sess');
    const manifestDir = path.join(os.homedir(), '.maestro', 'sessions', sessionId);
    const manifestPath = path.join(manifestDir, 'manifest.json');

    // Create directory
    await fs.mkdir(manifestDir, { recursive: true });

    // Call CLI to generate manifest
    const cliCommand = `maestro manifest generate \
      --role ${role} \
      --project-id ${projectId} \
      --task-ids ${taskIds.join(',')} \
      ${skills ? `--skills ${skills.join(',')}` : ''} \
      --api-url ${process.env.API_URL || 'http://localhost:3000'} \
      --output ${manifestPath}`;

    try {
      await execAsync(cliCommand);
    } catch (error) {
      return res.status(500).json({
        error: 'manifest_generation_failed',
        message: error.message,
      });
    }

    // Read generated manifest to get working directory
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Create session record
    const session = {
      id: sessionId,
      projectId,
      taskIds,
      name: req.body.sessionName || `Worker: ${manifest.task.title}`,
      status: 'spawning',
      metadata: {
        spawnSource,
        spawnedBy,
        skills: skills || [],
      },
      env: {},
      events: [],
      startedAt: Date.now(),
      lastActivity: Date.now(),
      completedAt: null,
      hostname: os.hostname(),
      platform: os.platform(),
    };

    storage.createSession(session);

    // Add session to tasks
    for (const taskId of taskIds) {
      storage.addSessionToTask(taskId, sessionId);
    }

    // Prepare spawn data
    const command = 'maestro worker init';
    const cwd = manifest.session.workingDirectory;
    const envVars = {
      MAESTRO_SESSION_ID: sessionId,
      MAESTRO_MANIFEST_PATH: manifestPath,
      MAESTRO_SERVER_URL: process.env.SERVER_URL || 'http://localhost:3000',
    };

    // Broadcast spawn request
    storage.emit('session:spawn_request', {
      session,
      command,
      cwd,
      envVars,
    });

    res.status(201).json({
      success: true,
      sessionId,
      manifestPath,
      session,
    });

  } catch (error) {
    console.error('Spawn error:', error);
    res.status(500).json({
      error: 'spawn_error',
      message: error.message,
    });
  }
});
```

---

### 2. CLI Implementation

#### A. Manifest Generate Command

**File: `maestro-cli/src/commands/manifest-generator.ts`**

```typescript
import { Command } from 'commander';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import fetch from 'node-fetch';

export function registerManifestCommands(program: Command) {
  program
    .command('manifest')
    .description('Manifest generation commands')
    .command('generate')
    .description('Generate manifest from task data')
    .requiredOption('--role <role>', 'Session role: worker or orchestrator')
    .requiredOption('--project-id <id>', 'Project ID')
    .requiredOption('--task-ids <ids>', 'Comma-separated task IDs')
    .requiredOption('--api-url <url>', 'Maestro server API URL')
    .requiredOption('--output <path>', 'Output manifest path')
    .option('--skills <skills>', 'Comma-separated skill names')
    .option('--model <model>', 'Claude model', 'sonnet')
    .option('--permission-mode <mode>', 'Permission mode', 'acceptEdits')
    .action(async (options) => {
      try {
        // Parse inputs
        const taskIds = options.taskIds.split(',').map(id => id.trim());
        const skills = options.skills ? options.skills.split(',').map(s => s.trim()) : [];

        // Fetch project data
        const projectRes = await fetch(`${options.apiUrl}/api/projects/${options.projectId}`);
        if (!projectRes.ok) throw new Error('Failed to fetch project');
        const project = await projectRes.json();

        // Fetch task data
        const tasks = [];
        for (const taskId of taskIds) {
          const taskRes = await fetch(`${options.apiUrl}/api/tasks/${taskId}`);
          if (!taskRes.ok) throw new Error(`Failed to fetch task ${taskId}`);
          tasks.push(await taskRes.json());
        }

        const primaryTask = tasks[0];

        // Build manifest
        const manifest = {
          manifestVersion: '1.0',
          role: options.role,
          task: {
            id: primaryTask.id,
            title: primaryTask.title,
            description: primaryTask.description,
            projectId: options.projectId,
            acceptanceCriteria: primaryTask.acceptanceCriteria || [],
            technicalNotes: primaryTask.technicalNotes,
            dependencies: primaryTask.dependencies || [],
            priority: primaryTask.priority || 'medium',
            complexity: primaryTask.complexity || 'medium',
            createdAt: new Date(primaryTask.createdAt).toISOString(),
          },
          session: {
            model: options.model,
            permissionMode: options.permissionMode,
            thinkingMode: 'auto',
            workingDirectory: project.workingDir,
          },
          context: {
            codebaseContext: primaryTask.codebaseContext || {},
            relatedTasks: primaryTask.relatedTasks || [],
            projectStandards: primaryTask.projectStandards,
          },
          skills,
        };

        // Write to file
        await mkdir(dirname(options.output), { recursive: true });
        await writeFile(options.output, JSON.stringify(manifest, null, 2), 'utf-8');

        console.log('✅ Manifest generated successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Manifest generation failed:', error.message);
        process.exit(1);
      }
    });
}
```

#### B. Worker Init Command (Updated)

**File: `maestro-cli/src/commands/worker-init.ts`**

```typescript
export class WorkerInitCommand {
  async execute(): Promise<void> {
    try {
      console.log('🔧 Initializing Maestro Worker Session\n');

      // Read manifest path from environment
      const manifestPath = process.env.MAESTRO_MANIFEST_PATH;
      if (!manifestPath) {
        throw new Error('MAESTRO_MANIFEST_PATH not set');
      }

      const sessionId = process.env.MAESTRO_SESSION_ID;
      if (!sessionId) {
        throw new Error('MAESTRO_SESSION_ID not set');
      }

      console.log(`📋 Loading manifest: ${manifestPath}`);

      // Load pre-generated manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      console.log('✅ Manifest loaded');
      console.log(`   Task: ${manifest.task.title}`);
      console.log(`   Skills: ${manifest.skills.join(', ')}\n`);

      // Generate prompt from template
      const promptGenerator = new PromptGenerator();
      const prompt = await promptGenerator.generate(manifest);

      // Spawn Claude
      console.log('🚀 Spawning Claude Code session...\n');
      const spawner = new ClaudeSpawner();
      await spawner.spawn(manifest, sessionId, prompt);

      console.log('✅ Worker session completed\n');

    } catch (error) {
      console.error('❌ Worker init failed:', error.message);
      process.exit(1);
    }
  }
}
```

---

### 3. UI Implementation

#### A. WebSocket Spawn Request Handler

**File: `maestro-ui/src/contexts/MaestroContext.tsx`**

```typescript
useEffect(() => {
  if (!ws) return;

  const handleMessage = async (event: MessageEvent) => {
    const message = JSON.parse(event.data);

    if (message.type === 'session:spawn_request') {
      const { command, cwd, envVars } = message.data;

      console.log(`🚀 Spawning session: ${envVars.MAESTRO_SESSION_ID}`);
      console.log(`   Command: ${command}`);
      console.log(`   Working directory: ${cwd}`);
      console.log(`   Manifest: ${envVars.MAESTRO_MANIFEST_PATH}`);

      try {
        // Just spawn terminal with provided data
        await invoke('create_session', {
          command,
          cwd,
          envVars,
        });

        console.log('✅ Terminal spawned successfully');
      } catch (error) {
        console.error('❌ Failed to spawn terminal:', error);
      }
    }
  };

  ws.addEventListener('message', handleMessage);
  return () => ws.removeEventListener('message', handleMessage);
}, [ws]);
```

#### B. Spawn Request from UI

**File: `maestro-ui/src/components/maestro/MaestroPanel.tsx`**

```typescript
const handleStartTask = async (task: Task) => {
  try {
    const response = await fetch(`${apiUrl}/api/sessions/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: currentProject.id,
        taskIds: [task.id],
        role: 'worker',
        skills: ['maestro-worker'],
        spawnSource: 'manual',
      }),
    });

    if (!response.ok) {
      throw new Error('Spawn failed');
    }

    console.log('✅ Spawn request sent');
  } catch (error) {
    console.error('Failed to spawn:', error);
  }
};
```

---

## Environment Variables

### Minimal Set (Set by Server, Passed to Terminal)

| Variable | Example | Description |
|----------|---------|-------------|
| `MAESTRO_SESSION_ID` | `sess_1707019200000_abc123` | Unique session identifier |
| `MAESTRO_MANIFEST_PATH` | `~/.maestro/sessions/sess_123/manifest.json` | Path to pre-generated manifest |
| `MAESTRO_SERVER_URL` | `http://localhost:3000` | Maestro server base URL |

**That's it!** All task data, project data, skills, etc. are in the manifest file.

### Why Only These Variables?

1. **MAESTRO_SESSION_ID** - Identifies the session for API calls
2. **MAESTRO_MANIFEST_PATH** - Points CLI to the complete manifest
3. **MAESTRO_SERVER_URL** - For API communication

Everything else (task IDs, project ID, skills, working directory, etc.) is in the manifest.

---

## API Contracts

### POST /api/sessions/spawn

**Request:**
```json
{
  "projectId": "proj_123",
  "taskIds": ["task_456"],
  "role": "worker",
  "skills": ["maestro-worker"],
  "spawnSource": "manual",
  "sessionName": "Fix auth bug"
}
```

**Response (201):**
```json
{
  "success": true,
  "sessionId": "sess_789",
  "manifestPath": "~/.maestro/sessions/sess_789/manifest.json",
  "session": {
    "id": "sess_789",
    "status": "spawning",
    "metadata": {
      "spawnSource": "manual"
    }
  }
}
```

### WebSocket: session:spawn_request

```json
{
  "type": "session:spawn_request",
  "data": {
    "session": { "id": "sess_789", "status": "spawning" },
    "command": "maestro worker init",
    "cwd": "/path/to/project",
    "envVars": {
      "MAESTRO_SESSION_ID": "sess_789",
      "MAESTRO_MANIFEST_PATH": "~/.maestro/sessions/sess_789/manifest.json",
      "MAESTRO_SERVER_URL": "http://localhost:3000"
    }
  }
}
```

---

## Troubleshooting

### Problem: "MAESTRO_MANIFEST_PATH not set"

**Solution:** Ensure terminal is spawned with correct env vars from WebSocket event.

### Problem: "Manifest file not found"

**Cause:** CLI manifest generation failed or file was deleted.

**Solution:**
```bash
# Check if file exists
ls -la ~/.maestro/sessions/sess_*/manifest.json

# Regenerate manually
maestro manifest generate \
  --role worker \
  --project-id proj_123 \
  --task-ids task_456 \
  --api-url http://localhost:3000 \
  --output ~/.maestro/sessions/sess_789/manifest.json
```

### Problem: "maestro: command not found"

**Solution:**
```bash
cd maestro-cli
npm install
npm run build
npm link
```

---

## Summary

**The Clean Manifest-Driven Flow:**

1. ✅ UI calls `POST /api/sessions/spawn`
2. ✅ Server executes `maestro manifest generate` (CLI)
3. ✅ CLI fetches data and writes manifest file
4. ✅ Server broadcasts spawn request with manifest path
5. ✅ UI spawns terminal with minimal env vars
6. ✅ Terminal runs `maestro worker init`
7. ✅ CLI reads pre-generated manifest
8. ✅ CLI spawns Claude with full context
9. ✅ Worker executes task

**Key Benefits:**
- Single source of truth (manifest file)
- Minimal environment variables
- Reusable manifest generation
- Server controls orchestration
- Clean separation of concerns
