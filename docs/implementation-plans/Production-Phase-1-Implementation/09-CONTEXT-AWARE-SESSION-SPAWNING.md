# Context-Aware Session Spawning: Complete Guide

## Overview

This guide covers the complete implementation of intelligent session spawning where:
- **Orchestrators** spawn sessions with planning context
- **Workers** spawn with execution context and clear objectives
- **Initial prompts** are generated based on task data and assigned skill
- **CLI commands** are determined dynamically from task requirements

**Goal:** Enable fully autonomous agent workflows with proper context injection.

**Estimated Effort:** 12-16 hours

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR SESSION                      │
│  Running: claude --skill maestro-orchestrator               │
│                                                              │
│  Context:                                                    │
│  - Project overview                                          │
│  - All tasks in project                                      │
│  - Delegation capabilities                                   │
│                                                              │
│  Initial Prompt:                                             │
│  "You are the Maestro Orchestrator. Your objective is to    │
│   manage the project by breaking down tasks and spawning    │
│   specialized workers. Current tasks: [...]"                │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ $ maestro session spawn --task t1 --skill maestro-worker
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      WORKER SESSION                          │
│  Running: claude --skill maestro-worker                     │
│                                                              │
│  Context:                                                    │
│  - Task ID: t1                                               │
│  - Task Title: "Implement user authentication"              │
│  - Task Description: Full requirements                      │
│  - Subtasks: [st1, st2, st3]                                │
│  - Dependencies: None                                        │
│                                                              │
│  Initial Prompt:                                             │
│  "You are a Maestro Worker assigned to task t1:             │
│   'Implement user authentication'. Your objective is to...  │
│   Follow this workflow: 1. Run maestro task start..."       │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1: Data Model for Context-Aware Spawning

### Session Spawn Request Schema

**File:** `maestro-server/src/types.ts`

```typescript
export interface SessionSpawnRequest {
  // Basic identification
  projectId: string;
  taskIds: string[];
  sessionName?: string;

  // Skill assignment
  skill: 'maestro-orchestrator' | 'maestro-worker' | string;

  // Context data (for prompt generation)
  context: SessionContext;

  // Spawning metadata
  spawnedBy?: string; // Session ID of parent
  spawnReason?: string; // Why this session was spawned
}

export interface SessionContext {
  // Task-specific context
  primaryTask?: TaskWithContext;
  relatedTasks?: Task[];

  // Project context
  projectOverview?: string;
  projectGoals?: string[];

  // Execution context
  workflowSteps?: string[];
  dependencies?: string[];
  blockers?: string[];

  // Initial commands to run
  initialCommands?: string[];
}

export interface TaskWithContext extends Task {
  // Enhanced task data for prompt generation
  fullDescription?: string;
  acceptanceCriteria?: string[];
  technicalNotes?: string;
  estimatedComplexity?: 'simple' | 'medium' | 'complex';
}
```

---

## Part 2: Initial Prompt Generation

### Prompt Generator Service

**File:** `maestro-server/src/services/promptGenerator.ts`

```typescript
import { Task, SessionSpawnRequest, SessionContext } from '../types';
import { db } from '../db';
import { loadSkill } from '../skills';

export class PromptGenerator {
  /**
   * Generate initial prompt for a spawned session based on skill type
   */
  static generateInitialPrompt(spawnRequest: SessionSpawnRequest): string {
    const { skill, context } = spawnRequest;

    if (skill === 'maestro-orchestrator') {
      return this.generateOrchestratorPrompt(context);
    } else if (skill === 'maestro-worker') {
      return this.generateWorkerPrompt(context);
    } else {
      // Custom skill
      return this.generateCustomSkillPrompt(skill, context);
    }
  }

  /**
   * Generate prompt for Orchestrator sessions
   */
  private static generateOrchestratorPrompt(context: SessionContext): string {
    const { projectOverview, relatedTasks } = context;

    const tasksList = relatedTasks
      ?.map(t => `  - [${t.id}] ${t.title} (${t.status}, priority: ${t.priority})`)
      .join('\n') || 'No tasks yet';

    return `
# Maestro Orchestrator Session

## Your Role
You are the **Maestro Orchestrator**, responsible for managing this project's workflow by:
- Analyzing requirements and breaking them down into actionable tasks
- Creating subtasks with clear deliverables
- Spawning specialized Worker sessions to execute tasks
- Monitoring progress and unblocking workers when needed

## Project Overview
${projectOverview || 'No project overview available. Start by analyzing the current task list.'}

## Current Tasks
${tasksList}

## Your Workflow

### Step 1: Analyze the Current State
\`\`\`bash
maestro whoami          # Understand your context
maestro task list       # See all tasks
maestro status          # Get project summary
\`\`\`

### Step 2: Plan the Work
For each task that needs decomposition:
1. Review the task details: \`maestro task get <id>\`
2. Break it down into subtasks: \`maestro subtask create <taskId> "<title>"\`
3. Ensure subtasks are atomic, testable, and independent

### Step 3: Delegate to Workers
For each task ready for implementation:
\`\`\`bash
maestro session spawn --task <id> --skill maestro-worker --name "Worker for <task-title>"
\`\`\`

### Step 4: Monitor Progress
- Check task status regularly: \`maestro task list --status in_progress\`
- Review worker updates: \`maestro task get <id>\` (check timeline)
- Unblock workers when they report blockers: \`maestro task start <id>\`

### Step 5: Validate Completion
Before marking tasks complete:
- Review the implementation
- Verify tests pass
- Ensure acceptance criteria are met

## Important Guidelines
- **DO NOT** implement tasks yourself (that's the workers' job)
- **DO** create clear, actionable subtasks
- **DO** spawn workers for each major task
- **DO** monitor and unblock workers proactively

## Get Started
Begin by running \`maestro status\` to understand the current project state, then decide which tasks need your attention.
`.trim();
  }

  /**
   * Generate prompt for Worker sessions
   */
  private static generateWorkerPrompt(context: SessionContext): string {
    const { primaryTask } = context;

    if (!primaryTask) {
      return this.generateWorkerPromptWithoutTask();
    }

    const subtasksList = primaryTask.subtasks
      ?.map((st, idx) => `  ${idx + 1}. [${st.completed ? '✅' : '⬜'}] ${st.title}`)
      .join('\n') || 'No subtasks defined yet';

    const dependenciesList = primaryTask.dependencies?.length
      ? primaryTask.dependencies.map(depId => {
          const depTask = db.tasks.get(depId);
          return `  - [${depId}] ${depTask?.title || 'Unknown'} (${depTask?.status || 'unknown'})`;
        }).join('\n')
      : 'None';

    return `
# Maestro Worker Session

## Your Assignment
You have been assigned to task **${primaryTask.id}**:

**Title:** ${primaryTask.title}

**Description:**
${primaryTask.description || 'No description provided'}

**Priority:** ${primaryTask.priority || 'medium'}
**Current Status:** ${primaryTask.status}

${primaryTask.fullDescription ? `\n**Full Requirements:**\n${primaryTask.fullDescription}\n` : ''}

${primaryTask.acceptanceCriteria?.length ? `\n**Acceptance Criteria:**\n${primaryTask.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n` : ''}

${primaryTask.technicalNotes ? `\n**Technical Notes:**\n${primaryTask.technicalNotes}\n` : ''}

## Subtasks
${subtasksList}

## Dependencies
${dependenciesList}

${primaryTask.dependencies?.length ? '\n**⚠️ Note:** This task has dependencies. Ensure they are completed before proceeding.\n' : ''}

## Your Workflow

### Step 1: Start the Task
\`\`\`bash
maestro task start
\`\`\`

This marks the task as in-progress and notifies the orchestrator.

### Step 2: Understand the Requirements
- Review the task description and acceptance criteria above
- If unclear, ask questions or mark the task as blocked:
  \`\`\`bash
  maestro task block ${primaryTask.id} --reason "Need clarification on <specific question>"
  \`\`\`

### Step 3: Execute the Subtasks
Work through each subtask systematically:

${primaryTask.subtasks?.map((st, idx) => `
**Subtask ${idx + 1}: ${st.title}**
1. Implement the requirement
2. Test your implementation
3. Mark complete when verified:
   \`\`\`bash
   maestro subtask complete ${primaryTask.id} ${st.id}
   maestro update "Completed: ${st.title}"
   \`\`\`
`).join('\n') || ''}

${!primaryTask.subtasks?.length ? `
**No subtasks defined.** Break down the work yourself:
\`\`\`bash
maestro subtask create ${primaryTask.id} "Your first step"
maestro subtask create ${primaryTask.id} "Your second step"
# ... etc
\`\`\`
` : ''}

### Step 4: Report Progress Frequently
Every 5-10 minutes or at major milestones:
\`\`\`bash
maestro update "Current progress: <what you just did>"
\`\`\`

This helps the orchestrator track your work.

### Step 5: Complete the Task
Only after:
- ✅ All subtasks are complete
- ✅ Tests pass
- ✅ Code quality is good
- ✅ Acceptance criteria are met

Then:
\`\`\`bash
maestro task complete
maestro update "Task completed. Summary: <brief summary of what was done>"
\`\`\`

## If You Get Blocked
If you encounter an insurmountable issue:
\`\`\`bash
maestro task block ${primaryTask.id} --reason "<clear explanation of the blocker>"
maestro update "Blocked: <details of what you tried and why it didn't work>"
\`\`\`

Then wait for the orchestrator to resolve the blocker.

## Important Guidelines
- **DO** implement the requirements completely
- **DO** test your work thoroughly
- **DO** report progress frequently
- **DO NOT** mark the task complete unless everything is done and verified
- **DO NOT** skip subtasks without good reason

## Get Started
Begin by running \`maestro task start\` to mark yourself as active, then start working through the subtasks above.
`.trim();
  }

  /**
   * Generate prompt for Worker without assigned task
   */
  private static generateWorkerPromptWithoutTask(): string {
    return `
# Maestro Worker Session

## Your Role
You are a **Maestro Worker** ready to execute tasks.

## Current Status
No task has been assigned to you yet.

## What to Do
Check your assigned tasks:
\`\`\`bash
maestro whoami          # See if you have task context
maestro task list       # See available tasks
\`\`\`

If you have tasks in your context (\`MAESTRO_TASK_IDS\`), pick one and start working:
\`\`\`bash
maestro task start <id>
\`\`\`

If you have no assigned tasks, wait for the orchestrator to assign work to you.
`.trim();
  }

  /**
   * Generate prompt for custom skills
   */
  private static generateCustomSkillPrompt(skillName: string, context: SessionContext): string {
    // Load custom skill instructions
    const skill = loadSkill(skillName);

    if (!skill) {
      return `
# Custom Skill: ${skillName}

Skill "${skillName}" was requested but not found.

Please check:
1. Skill exists at: ~/.agents-ui/maestro-skills/${skillName}/
2. Skill has manifest.json and skill.md files

Available context:
${JSON.stringify(context, null, 2)}
`.trim();
    }

    // Combine skill instructions with context
    return `
# ${skill.manifest.name}

${skill.instructions}

---

## Current Context

**Session Type:** ${skillName}
**Project:** ${context.projectOverview || 'No overview'}
**Primary Task:** ${context.primaryTask ? `${context.primaryTask.id} - ${context.primaryTask.title}` : 'None'}

${context.initialCommands?.length ? `
## Initial Commands

Run these commands to get started:
\`\`\`bash
${context.initialCommands.join('\n')}
\`\`\`
` : ''}
`.trim();
  }

  /**
   * Generate initial commands based on context
   */
  static generateInitialCommands(context: SessionContext): string[] {
    const commands: string[] = [];

    // Always start with context check
    commands.push('maestro whoami');

    if (context.primaryTask) {
      // Worker with assigned task
      commands.push(`maestro task get ${context.primaryTask.id}`);
      commands.push(`maestro task start ${context.primaryTask.id}`);
    } else if (context.relatedTasks?.length) {
      // Orchestrator with tasks to manage
      commands.push('maestro task list');
      commands.push('maestro status');
    }

    return commands;
  }
}
```

---

## Part 3: Enhanced CLI Session Spawn Command

### CLI Implementation with Context Building

**File:** `maestro-cli/src/commands/session.ts`

```typescript
import { validateRequired } from '../utils/validation.js';
import { handleError } from '../utils/errors.js';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON } from '../utils/formatter.js';

export function registerSessionCommands(program: Command): void {
  const sessionCommand = program.command('session').description('Manage sessions');

  // ... existing commands (info, list) ...

  sessionCommand
    .command('spawn')
    .description('Spawn a new session with full task context')
    .requiredOption('--task <id>', 'Task ID to assign to the new session')
    .option('--skill <skill>', 'Skill to load (defaults to maestro-worker)', 'maestro-worker')
    .option('--name <name>', 'Session name (auto-generated if not provided)')
    .option('--reason <reason>', 'Reason for spawning this session')
    .option('--include-related', 'Include related tasks in context')
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const taskId = validateRequired(options.task, 'task');
        const skill = options.skill;

        // Fetch full task details to build context
        console.log(`📋 Fetching task details for ${taskId}...`);
        const task = await api.get(`/api/tasks/${taskId}`);

        // Build session context
        const context = await buildSessionContext(task, {
          includeRelated: options.includeRelated,
          skill: skill
        });

        // Generate session name if not provided
        const sessionName = options.name || generateSessionName(task, skill);

        // Prepare spawn request
        const spawnRequest = {
          projectId: globalOpts.project || config.projectId,
          taskIds: [taskId],
          skill: skill,
          sessionName: sessionName,
          context: context,
          spawnedBy: config.sessionId,
          spawnReason: options.reason || `Execute task: ${task.title}`
        };

        console.log(`🚀 Spawning ${skill} session: ${sessionName}`);
        if (!globalOpts.json) {
          console.log(`   Task: ${task.title}`);
          console.log(`   Priority: ${task.priority}`);
          console.log(`   Subtasks: ${task.subtasks?.length || 0}`);
        }

        // Send spawn request
        const result = await api.post('/api/sessions/spawn', spawnRequest);

        if (globalOpts.json) {
          outputJSON(result);
        } else {
          console.log(`✅ Session spawned successfully`);
          console.log(`   Session ID: ${result.sessionId}`);
          console.log(`   Skill: ${skill}`);
          console.log('');
          console.log('   Waiting for Agents UI to open terminal window...');
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}

/**
 * Build comprehensive session context
 */
async function buildSessionContext(task: any, options: any): Promise<any> {
  const context: any = {
    primaryTask: task
  };

  // Add related tasks if requested
  if (options.includeRelated) {
    const relatedTasks = [];

    // Include dependency tasks
    if (task.dependencies?.length) {
      for (const depId of task.dependencies) {
        try {
          const depTask = await api.get(`/api/tasks/${depId}`);
          relatedTasks.push(depTask);
        } catch (err) {
          console.warn(`Could not fetch dependency task ${depId}`);
        }
      }
    }

    context.relatedTasks = relatedTasks;
  }

  // Add workflow steps based on skill
  if (options.skill === 'maestro-worker') {
    context.workflowSteps = [
      'Run maestro task start to mark task as in-progress',
      'Work through each subtask systematically',
      'Report progress using maestro update',
      'Complete subtasks using maestro subtask complete',
      'Run maestro task complete when all work is verified'
    ];
  } else if (options.skill === 'maestro-orchestrator') {
    context.workflowSteps = [
      'Run maestro status to see project overview',
      'Analyze tasks that need decomposition',
      'Create subtasks using maestro subtask create',
      'Spawn workers using maestro session spawn',
      'Monitor progress and unblock workers as needed'
    ];
  }

  // Add initial commands
  context.initialCommands = [
    'maestro whoami',
    `maestro task get ${task.id}`
  ];

  if (options.skill === 'maestro-worker') {
    context.initialCommands.push(`maestro task start ${task.id}`);
  }

  return context;
}

/**
 * Generate session name from task and skill
 */
function generateSessionName(task: any, skill: string): string {
  const skillName = skill === 'maestro-worker' ? 'Worker' :
                    skill === 'maestro-orchestrator' ? 'Orchestrator' : skill;

  // Truncate task title if too long
  const maxTitleLength = 30;
  let title = task.title;
  if (title.length > maxTitleLength) {
    title = title.substring(0, maxTitleLength) + '...';
  }

  return `${skillName}: ${title}`;
}
```

---

## Part 4: Server-Side Spawn Handler with Prompt Generation

### Updated Spawn Endpoint

**File:** `maestro-server/src/api/sessions.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { Session, SessionSpawnRequest } from '../types';
import { db } from '../db';
import { wss } from '../websocket';
import { PromptGenerator } from '../services/promptGenerator';

// POST /api/sessions/spawn
router.post('/spawn', (req, res) => {
  const spawnRequest: SessionSpawnRequest = req.body;

  // Validation
  if (!spawnRequest.projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }
  if (!spawnRequest.taskIds || spawnRequest.taskIds.length === 0) {
    return res.status(400).json({ error: 'taskIds is required' });
  }
  if (!spawnRequest.skill) {
    return res.status(400).json({ error: 'skill is required' });
  }

  // Generate initial prompt
  const initialPrompt = PromptGenerator.generateInitialPrompt(spawnRequest);

  // Generate initial commands
  const initialCommands = spawnRequest.context.initialCommands ||
                         PromptGenerator.generateInitialCommands(spawnRequest.context);

  // Create session record
  const sessionId = uuidv4();
  const session: Session = {
    id: sessionId,
    projectId: spawnRequest.projectId,
    taskIds: spawnRequest.taskIds,
    name: spawnRequest.sessionName || `Session ${sessionId.slice(0, 8)}`,
    status: 'spawning',
    createdAt: new Date().toISOString(),
    metadata: {
      skill: spawnRequest.skill,
      spawnedBy: spawnRequest.spawnedBy,
      spawnReason: spawnRequest.spawnReason,
      context: spawnRequest.context
    }
  };

  // Save to database
  db.sessions.set(sessionId, session);

  // Broadcast spawn request via WebSocket
  wss.broadcast({
    type: 'session:spawn_request',
    data: {
      sessionId,
      projectId: spawnRequest.projectId,
      taskIds: spawnRequest.taskIds,
      name: session.name,
      skill: spawnRequest.skill,
      initialPrompt,       // <-- The generated prompt
      initialCommands,     // <-- Commands to run on start
      context: spawnRequest.context
    }
  });

  console.log(`📤 Spawn request broadcasted for session ${sessionId}`);
  console.log(`   Skill: ${spawnRequest.skill}`);
  console.log(`   Tasks: ${spawnRequest.taskIds.join(', ')}`);
  console.log(`   Initial commands: ${initialCommands.length}`);

  res.status(201).json({
    success: true,
    sessionId,
    initialPrompt, // Return to CLI for debugging
    message: 'Spawn request sent to Agents UI'
  });
});

export default router;
```

---

## Part 5: Tauri WebSocket Handler with Prompt Injection

### Enhanced Spawn Handler

**File:** `src-tauri/src/websocket.rs`

```rust
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpawnRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    #[serde(rename = "taskIds")]
    pub task_ids: Vec<String>,

    pub name: String,
    pub skill: String,

    // NEW: Initial prompt and commands
    #[serde(rename = "initialPrompt")]
    pub initial_prompt: String,

    #[serde(rename = "initialCommands")]
    pub initial_commands: Vec<String>,

    #[serde(default)]
    pub context: serde_json::Value,
}

pub async fn handle_spawn_request(app: AppHandle, spawn: SpawnRequest) {
    use crate::pty::spawn_session_with_prompt;

    println!("🚀 Handling spawn request: {}", spawn.name);
    println!("   Skill: {}", spawn.skill);
    println!("   Task IDs: {:?}", spawn.task_ids);
    println!("   Initial commands: {:?}", spawn.initial_commands);

    // Build environment variables
    let mut env_vars = std::collections::HashMap::new();
    env_vars.insert("MAESTRO_API_URL".to_string(), "http://localhost:3000".to_string());
    env_vars.insert("MAESTRO_PROJECT_ID".to_string(), spawn.project_id.clone());
    env_vars.insert("MAESTRO_SESSION_ID".to_string(), spawn.session_id.clone());
    env_vars.insert("MAESTRO_TASK_IDS".to_string(), spawn.task_ids.join(","));
    env_vars.insert("MAESTRO_SKILL".to_string(), spawn.skill.clone());

    // Save initial prompt to a temporary file
    let prompt_file = save_initial_prompt(&spawn.session_id, &spawn.initial_prompt);

    // Spawn the session
    match spawn_session_with_prompt(
        &app,
        spawn.name.clone(),
        env_vars,
        spawn.skill.clone(),
        prompt_file,
        spawn.initial_commands.clone()
    ).await {
        Ok(_) => {
            println!("✅ Successfully spawned session: {}", spawn.name);

            // Notify server that spawn succeeded
            update_session_status(&spawn.session_id, "active").await;
        }
        Err(e) => {
            eprintln!("❌ Failed to spawn session: {}", e);

            // Notify server that spawn failed
            update_session_status(&spawn.session_id, "failed").await;
        }
    }
}

/// Save initial prompt to temporary file
fn save_initial_prompt(session_id: &str, prompt: &str) -> String {
    use std::fs;
    use std::path::PathBuf;

    let temp_dir = std::env::temp_dir();
    let prompt_file = temp_dir.join(format!("maestro_prompt_{}.md", session_id));

    fs::write(&prompt_file, prompt).expect("Failed to write prompt file");

    prompt_file.to_string_lossy().to_string()
}

/// Update session status on server
async fn update_session_status(session_id: &str, status: &str) {
    let client = reqwest::Client::new();
    let url = format!("http://localhost:3000/api/sessions/{}", session_id);

    let _ = client
        .patch(&url)
        .json(&serde_json::json!({ "status": status }))
        .send()
        .await;
}
```

---

## Part 6: PTY Module with Prompt Injection

### Enhanced PTY Spawning

**File:** `src-tauri/src/pty.rs`

```rust
use std::collections::HashMap;
use std::process::Command;
use tauri::{AppHandle, Manager};

pub async fn spawn_session_with_prompt(
    app: &AppHandle,
    name: String,
    env_vars: HashMap<String, String>,
    skill: String,
    prompt_file: String,
    initial_commands: Vec<String>,
) -> Result<(), String> {
    // Get the main window
    let window = app.get_window("main").ok_or("Main window not found")?;

    // Prepare the terminal command
    // Option 1: If using Claude Code CLI
    let terminal_command = format!(
        "claude --skill {} --context-file {}",
        skill, prompt_file
    );

    // Option 2: If using custom terminal setup
    // Emit event to frontend to create terminal with specific setup
    window.emit("spawn-terminal", SpawnTerminalPayload {
        name,
        env_vars,
        skill,
        prompt_file,
        initial_commands,
    }).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Clone, serde::Serialize)]
struct SpawnTerminalPayload {
    name: String,
    env_vars: HashMap<String, String>,
    skill: String,
    prompt_file: String,
    initial_commands: Vec<String>,
}
```

---

## Part 7: Frontend Terminal Initialization

### Terminal Manager with Prompt Display

**File:** `src/components/TerminalManager.tsx`

```typescript
import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface SpawnTerminalEvent {
  name: string;
  env_vars: Record<string, string>;
  skill: string;
  prompt_file: string;
  initial_commands: string[];
}

export function TerminalManager() {
  const [terminals, setTerminals] = useState<Map<string, Terminal>>(new Map());

  useEffect(() => {
    const unlisten = listen<SpawnTerminalEvent>('spawn-terminal', async (event) => {
      const { name, env_vars, skill, prompt_file, initial_commands } = event.payload;

      console.log('🚀 Spawning terminal:', name);
      console.log('   Skill:', skill);
      console.log('   Initial commands:', initial_commands);

      // Create new terminal instance
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4'
        }
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Create PTY session with env vars
      const ptyId = await invoke<string>('create_pty_session', {
        envVars: env_vars
      });

      // Connect terminal to PTY
      terminal.onData((data) => {
        invoke('write_to_pty', { ptyId, data });
      });

      // Listen for PTY output
      const ptyUnlisten = await listen(`pty-output-${ptyId}`, (event) => {
        terminal.write(event.payload as string);
      });

      // Display initial prompt
      await displayInitialPrompt(terminal, prompt_file);

      // Run initial commands
      await runInitialCommands(terminal, ptyId, initial_commands);

      // Store terminal instance
      setTerminals(prev => new Map(prev).set(name, terminal));

      // Add to UI
      addTerminalTab(name, terminal, fitAddon);

      return () => {
        ptyUnlisten();
      };
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  async function displayInitialPrompt(terminal: Terminal, promptFile: string) {
    // Read prompt file
    const promptContent = await invoke<string>('read_file', { path: promptFile });

    // Display prompt in terminal with nice formatting
    terminal.writeln('\x1b[1;36m╔═══════════════════════════════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[1;36m║                    MAESTRO SESSION BRIEF                      ║\x1b[0m');
    terminal.writeln('\x1b[1;36m╚═══════════════════════════════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');

    // Write prompt content (formatted as markdown in terminal)
    const lines = promptContent.split('\n');
    lines.forEach(line => {
      if (line.startsWith('# ')) {
        terminal.writeln('\x1b[1;33m' + line + '\x1b[0m'); // Yellow for headers
      } else if (line.startsWith('## ')) {
        terminal.writeln('\x1b[1;32m' + line + '\x1b[0m'); // Green for subheaders
      } else if (line.startsWith('**')) {
        terminal.writeln('\x1b[1m' + line + '\x1b[0m'); // Bold
      } else {
        terminal.writeln(line);
      }
    });

    terminal.writeln('');
    terminal.writeln('\x1b[1;36m═══════════════════════════════════════════════════════════════\x1b[0m');
    terminal.writeln('');
  }

  async function runInitialCommands(terminal: Terminal, ptyId: string, commands: string[]) {
    if (commands.length === 0) return;

    terminal.writeln('\x1b[1;35m🤖 Running initial commands...\x1b[0m');
    terminal.writeln('');

    for (const cmd of commands) {
      terminal.writeln(`\x1b[1;34m$\x1b[0m ${cmd}`);

      // Send command to PTY
      await invoke('write_to_pty', {
        ptyId,
        data: cmd + '\n'
      });

      // Wait a bit for command to execute
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    terminal.writeln('');
    terminal.writeln('\x1b[1;32m✅ Initial setup complete. You can now begin working.\x1b[0m');
    terminal.writeln('');
  }

  function addTerminalTab(name: string, terminal: Terminal, fitAddon: FitAddon) {
    // Implementation depends on your UI framework
    // This is where you add the terminal to your tab bar
  }

  return (
    <div className="terminal-manager">
      {/* Render terminals */}
    </div>
  );
}
```

---

## Part 8: Complete Flow Example

### Orchestrator Spawns Worker Flow

```bash
# Terminal 1: Orchestrator Session
$ claude --skill maestro-orchestrator

╔═══════════════════════════════════════════════════════════════╗
║                    MAESTRO SESSION BRIEF                      ║
╚═══════════════════════════════════════════════════════════════╝

# Maestro Orchestrator Session

## Your Role
You are the **Maestro Orchestrator**, responsible for managing this project...

## Current Tasks
  - [t1] Implement user authentication (pending, priority: high)
  - [t2] Add dark mode toggle (pending, priority: medium)

## Your Workflow
...

🤖 Running initial commands...

$ maestro whoami
Server: http://localhost:3000
Project ID: p1
Session ID: s-orch-001
Task IDs:

$ maestro task list
ID    Title                          Status    Priority
t1    Implement user authentication  pending   high
t2    Add dark mode toggle           pending   medium

✅ Initial setup complete. You can now begin working.

# Orchestrator analyzes t1 and creates subtasks
$ maestro task get t1
...

$ maestro subtask create t1 "Install and configure passport.js"
✅ Subtask created: st1

$ maestro subtask create t1 "Create User model with password hashing"
✅ Subtask created: st2

$ maestro subtask create t1 "Implement login endpoint"
✅ Subtask created: st3

# Orchestrator spawns a worker
$ maestro session spawn --task t1 --skill maestro-worker

🚀 Spawning maestro-worker session: Worker: Implement user authentication
   Task: Implement user authentication
   Priority: high
   Subtasks: 3

✅ Session spawned successfully
   Session ID: s-worker-001
   Skill: maestro-worker

   Waiting for Agents UI to open terminal window...
```

```bash
# Terminal 2: Worker Session (auto-opened)
$ claude --skill maestro-worker --context-file /tmp/maestro_prompt_s-worker-001.md

╔═══════════════════════════════════════════════════════════════╗
║                    MAESTRO SESSION BRIEF                      ║
╚═══════════════════════════════════════════════════════════════╝

# Maestro Worker Session

## Your Assignment
You have been assigned to task **t1**:

**Title:** Implement user authentication

**Description:**
Add JWT-based authentication to the API with login and signup endpoints.

**Priority:** high
**Current Status:** pending

**Acceptance Criteria:**
1. Users can sign up with email and password
2. Users can log in and receive a JWT token
3. Protected routes require valid JWT
4. Passwords are hashed with bcrypt

## Subtasks
  1. [⬜] Install and configure passport.js
  2. [⬜] Create User model with password hashing
  3. [⬜] Implement login endpoint

## Dependencies
None

## Your Workflow

### Step 1: Start the Task
...

🤖 Running initial commands...

$ maestro whoami
Server: http://localhost:3000
Project ID: p1
Session ID: s-worker-001
Task IDs: t1

$ maestro task get t1
{
  "id": "t1",
  "title": "Implement user authentication",
  ...
}

$ maestro task start t1
🚀 Task t1 started

✅ Initial setup complete. You can now begin working.

# Worker proceeds to implement...
$ npm install passport passport-jwt bcryptjs
$ maestro update "Installing authentication dependencies"

$ # Create User model...
$ maestro subtask complete t1 st1
$ maestro update "Completed passport.js setup"

$ # Continue implementation...
```

---

## Part 9: Testing Context-Aware Spawning

### Test Script

**File:** `tests/test-context-spawning.sh`

```bash
#!/bin/bash

set -e

echo "🧪 Testing Context-Aware Session Spawning"
echo ""

# 1. Create a test task
echo "1️⃣ Creating test task..."
TASK_RESPONSE=$(maestro task create "Test Context Spawning" \
  --desc "Verify that spawned sessions receive proper context and initial prompts" \
  --priority high \
  --json)

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.data.id')
echo "   Created task: $TASK_ID"

# 2. Add subtasks
echo "2️⃣ Adding subtasks..."
maestro subtask create $TASK_ID "First subtask" > /dev/null
maestro subtask create $TASK_ID "Second subtask" > /dev/null
maestro subtask create $TASK_ID "Third subtask" > /dev/null
echo "   Added 3 subtasks"

# 3. Spawn worker session
echo "3️⃣ Spawning worker session..."
SPAWN_RESPONSE=$(maestro session spawn \
  --task $TASK_ID \
  --skill maestro-worker \
  --reason "Test context injection" \
  --json)

SESSION_ID=$(echo $SPAWN_RESPONSE | jq -r '.data.sessionId')
echo "   Spawned session: $SESSION_ID"

# 4. Verify initial prompt was generated
INITIAL_PROMPT=$(echo $SPAWN_RESPONSE | jq -r '.data.initialPrompt')
if [[ $INITIAL_PROMPT == *"Maestro Worker Session"* ]]; then
  echo "   ✅ Initial prompt generated correctly"
else
  echo "   ❌ Initial prompt missing or invalid"
  exit 1
fi

# 5. Check if prompt includes task details
if [[ $INITIAL_PROMPT == *"Test Context Spawning"* ]]; then
  echo "   ✅ Prompt includes task title"
else
  echo "   ❌ Prompt missing task title"
  exit 1
fi

# 6. Check if prompt includes subtasks
if [[ $INITIAL_PROMPT == *"First subtask"* ]]; then
  echo "   ✅ Prompt includes subtasks"
else
  echo "   ❌ Prompt missing subtasks"
  exit 1
fi

# 7. Check if prompt includes workflow steps
if [[ $INITIAL_PROMPT == *"maestro task start"* ]]; then
  echo "   ✅ Prompt includes workflow steps"
else
  echo "   ❌ Prompt missing workflow steps"
  exit 1
fi

echo ""
echo "✅ All tests passed! Context-aware spawning is working correctly."
```

Run the test:
```bash
chmod +x tests/test-context-spawning.sh
./tests/test-context-spawning.sh
```

---

## Part 10: Implementation Checklist

### Phase 1: Data Model & Prompt Generation (4 hours)
- [ ] Add `SessionSpawnRequest` and `SessionContext` types to `types.ts`
- [ ] Create `promptGenerator.ts` service
- [ ] Implement `generateOrchestratorPrompt()`
- [ ] Implement `generateWorkerPrompt()`
- [ ] Implement `generateInitialCommands()`
- [ ] Test prompt generation with sample tasks

### Phase 2: CLI Enhancement (3 hours)
- [ ] Update `maestro session spawn` command with context building
- [ ] Implement `buildSessionContext()` function
- [ ] Implement `generateSessionName()` function
- [ ] Add `--include-related` flag
- [ ] Add `--reason` flag
- [ ] Test CLI spawn with various task types

### Phase 3: Server Integration (2 hours)
- [ ] Update `POST /api/sessions/spawn` endpoint
- [ ] Integrate `PromptGenerator` into spawn handler
- [ ] Include `initialPrompt` and `initialCommands` in WebSocket broadcast
- [ ] Test WebSocket broadcast includes all context data

### Phase 4: Tauri Handler (3 hours)
- [ ] Update `SpawnRequest` struct with new fields
- [ ] Implement `save_initial_prompt()` function
- [ ] Update `handle_spawn_request()` to use prompt file
- [ ] Implement `update_session_status()` API call
- [ ] Test Tauri receives and processes spawn requests

### Phase 5: Frontend Terminal (4 hours)
- [ ] Create `TerminalManager` component
- [ ] Implement `displayInitialPrompt()` function
- [ ] Implement `runInitialCommands()` function
- [ ] Add terminal tab management
- [ ] Test terminal displays prompt and runs commands

### Phase 6: Testing & Validation (2 hours)
- [ ] Create `test-context-spawning.sh` script
- [ ] Test orchestrator spawn flow
- [ ] Test worker spawn flow
- [ ] Test prompt includes all expected sections
- [ ] Test initial commands execute correctly
- [ ] Verify session status updates

---

## Summary

This implementation provides:

✅ **Context-Aware Spawning** - Sessions receive full task context
✅ **Intelligent Prompts** - Generated based on skill type and task data
✅ **Initial Commands** - Auto-executed to set up the agent
✅ **Skill Differentiation** - Orchestrator vs Worker prompts
✅ **Complete CLI Integration** - `maestro session spawn` with context building
✅ **WebSocket Flow** - Server → Tauri → Terminal with full context
✅ **Terminal Prompt Display** - Beautiful formatting of initial brief
✅ **Testable** - Script to verify end-to-end flow

**Total Effort:** 12-16 hours
**Dependencies:** Modules 01 (Skill System), 02 (CLI Enhancements)
**Enables:** Fully autonomous agent workflows

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
**Implementation Status:** 📋 Ready to Implement
