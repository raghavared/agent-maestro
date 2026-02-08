# Phase 6: Robust Terminal Spawning Architecture

## Overview

Phase 6 redesigns the terminal spawning mechanism to use **environment variables** for passing task context instead of simple prompt arguments. This architecture enables:

1. **Rich Task Context**: Pass entire task data structure via environment variables
2. **Worker Prompt Templates**: Templates that inject environment variables into system prompts
3. **Claude CLI Orchestration**: Use multiple Claude Code CLI arguments for optimal configuration
4. **Flexible Communication**: Support both interactive and non-interactive modes

---

## Current Approach (Phase 4a)

**Problem**: Currently, we only pass the initial prompt as an argument when spawning sessions:

```typescript
// Simplified current approach
await invoke('spawn_session', {
  command: 'claude',
  args: [task.prompt],  // Just the prompt
  envVars: {
    MAESTRO_TASK_ID: task.id,
  }
});
```

**Limitations**:
- Only the prompt is passed, losing rich task context
- Limited ability to configure Claude CLI behavior
- No structured way to pass Maestro task list or system prompts
- Hard to support different modes (interactive, non-interactive, agent-specific)

---

## New Architecture (Phase 6)

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Maestro UI: User clicks "Work on Task"                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Prepare Environment Variables                            │
│    - MAESTRO_TASK_DATA (JSON)                               │
│    - MAESTRO_TASK_IDS (comma-separated)                     │
│    - MAESTRO_SESSION_ID, PROJECT_ID                         │
│    - MAESTRO_SYSTEM_PROMPT                                  │
│    - CLAUDE_CLI_ARGS (additional CLI arguments)             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Worker Prompt Template                                   │
│    - Reads environment variables                            │
│    - Constructs system prompt from template                 │
│    - Builds Claude CLI invocation                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Spawn Terminal with Claude CLI                           │
│    claude [options] [prompt]                                │
│    - Uses environment variables for configuration           │
│    - Supports interactive and non-interactive modes         │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Strategy

### Core Maestro Environment Variables

```bash
# Task Context
MAESTRO_TASK_DATA='{"id":"task_123","title":"Implement login","description":"...","prompt":"...","status":"in_progress","priority":"high"}'
MAESTRO_TASK_IDS="task_123,task_456,task_789"  # For multi-task sessions
MAESTRO_PRIMARY_TASK_ID="task_123"             # Backward compatibility

# Session Context
MAESTRO_SESSION_ID="sess_abc123"
MAESTRO_PROJECT_ID="proj_xyz789"
MAESTRO_API_URL="http://localhost:3000/api"

# Skills & Agents
MAESTRO_SKILL_IDS="skill_test_agent,skill_worker"
MAESTRO_AGENT_ID="agent_claude"
MAESTRO_AGENT_CONFIG='{"model":"sonnet","temperature":0.7}'

# System Prompts
MAESTRO_SYSTEM_PROMPT="You are working on task: {task.title}. {task.description}"
MAESTRO_APPEND_SYSTEM_PROMPT="Always update task progress via Maestro hooks."

# Claude CLI Configuration
CLAUDE_CLI_ARGS="--permission-mode acceptEdits --model sonnet --tools default"
CLAUDE_CLI_MODE="interactive"  # or "non-interactive"
```

### Parsing Strategy

Environment variables use different formats based on complexity:

1. **Simple strings**: `MAESTRO_SESSION_ID="sess_123"`
2. **Comma-separated**: `MAESTRO_TASK_IDS="id1,id2,id3"`
3. **JSON objects**: `MAESTRO_TASK_DATA='{"id":"...","title":"..."}'`
4. **Template strings**: `MAESTRO_SYSTEM_PROMPT="Task: {task.title}"`

**Why this approach?**
- Simple to parse in shell scripts and Node.js
- JSON for complex structured data
- Templates for dynamic prompt generation
- Backward compatible with existing environment variables

---

## Claude Code CLI Options Reference

### Complete CLI Options

Based on `claude --help` output:

#### **Core Options**

| Option | Description | Use Case |
|--------|-------------|----------|
| `-p, --print` | Non-interactive mode, print and exit | Automation, CI/CD, batch processing |
| `--model <model>` | Specify model (sonnet, opus, haiku) | Control which Claude model to use |
| `--agent <agent>` | Use specific agent | Select agent for task |
| `--agents <json>` | Define custom agents | Multi-agent orchestration |

#### **System Prompts**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--system-prompt <prompt>` | Override default system prompt | Custom task-specific instructions |
| `--append-system-prompt <prompt>` | Append to system prompt | Add Maestro-specific instructions |

#### **Tool Control**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--tools <tools>` | Specify available tools | Limit tool access |
| `--allowedTools <tools>` | Whitelist specific tools | Security, controlled execution |
| `--disallowedTools <tools>` | Blacklist specific tools | Prevent dangerous operations |

#### **Permission & Security**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--permission-mode <mode>` | Set permission mode | Control how Claude asks for permissions |
| `--dangerously-skip-permissions` | Bypass all permission checks | Sandboxed environments only |
| `--allow-dangerously-skip-permissions` | Enable skip option | Make bypass available but not default |

**Permission Modes**:
- `default`: Normal interactive permissions
- `plan`: Plan mode (requires approval before implementation)
- `acceptEdits`: Auto-accept edit operations
- `bypassPermissions`: Skip all permission checks
- `dontAsk`: Don't ask for permissions (use defaults)
- `delegate`: Delegate permission decisions

#### **Session Management**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--session-id <uuid>` | Use specific session ID | Resume or track sessions |
| `-c, --continue` | Continue most recent conversation | Resume work |
| `-r, --resume [value]` | Resume by session ID | Continue specific session |
| `--fork-session` | Create new session from resumed | Branch conversations |
| `--no-session-persistence` | Don't save session | Ephemeral sessions |

#### **MCP & Plugins**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--mcp-config <configs>` | Load MCP servers from JSON | External tool integration |
| `--strict-mcp-config` | Only use specified MCP servers | Controlled environment |
| `--plugin-dir <paths>` | **Load plugins/skills from directories (repeatable)** | **Custom skills/capabilities - KEY for Maestro skills** |
| `--disable-slash-commands` | Disable all skills | Limited execution |

#### **Input/Output Formats**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--input-format <format>` | Input format (text, stream-json) | Streaming input |
| `--output-format <format>` | Output format (text, json, stream-json) | Structured output, streaming |
| `--json-schema <schema>` | JSON Schema for output validation | Structured responses |
| `--replay-user-messages` | Echo user messages on stdout | Acknowledgment in streams |
| `--include-partial-messages` | Include partial message chunks | Real-time streaming |

#### **Budget & Cost Control**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--max-budget-usd <amount>` | Maximum spend limit | Cost control |
| `--fallback-model <model>` | Fallback when overloaded | Resilience |

#### **Advanced Configuration**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--settings <file-or-json>` | Load settings from file/JSON | Custom configurations |
| `--setting-sources <sources>` | Which settings to load (user, project, local) | Control config hierarchy |
| `--add-dir <directories>` | Allow access to additional directories | Extended workspace |
| `--betas <betas>` | Enable beta features | Early access features |

#### **Debug & Development**

| Option | Description | Use Case |
|--------|-------------|----------|
| `-d, --debug [filter]` | Enable debug mode | Troubleshooting |
| `--verbose` | Verbose output | Detailed logging |

#### **Other**

| Option | Description | Use Case |
|--------|-------------|----------|
| `--chrome` / `--no-chrome` | Claude in Chrome integration | Browser integration |
| `--ide` | Auto-connect to IDE | IDE integration |

---

## Skills System Integration

### Overview

Claude Code supports **skills** (also called plugins) through the `--plugin-dir` option. This option is **repeatable**, allowing multiple skills to be loaded in a single session.

**Key Insight**: Each `--plugin-dir` argument loads one skill directory, so for multiple skills, we use multiple `--plugin-dir` flags.

### Skills in Claude CLI

```bash
# Load single skill
claude --plugin-dir ~/.agents-ui/maestro-skills/test-agent

# Load multiple skills (use --plugin-dir multiple times)
claude --plugin-dir ~/.agents-ui/maestro-skills/test-agent \
       --plugin-dir ~/.agents-ui/maestro-skills/code-review \
       --plugin-dir ~/.agents-ui/maestro-skills/maestro-worker

# Disable all skills
claude --disable-slash-commands
```

### Maestro Skills Storage Structure

```
~/.agents-ui/maestro-skills/
├── test-agent/
│   ├── manifest.json         # Plugin manifest (required)
│   ├── skill.md              # Skill content/prompt (required)
│   └── hooks/                # Optional hooks
│       └── PreToolUse.js
├── code-review/
│   ├── manifest.json
│   ├── skill.md
│   └── config.json           # Optional skill configuration
├── deploy/
│   ├── manifest.json
│   └── skill.md
├── maestro-worker/
│   ├── manifest.json
│   ├── skill.md
│   └── worker.js             # Optional worker script
└── README.md                 # Documentation
```

### Skill Manifest Example

**File**: `~/.agents-ui/maestro-skills/test-agent/manifest.json`

```json
{
  "name": "test-agent",
  "displayName": "Test Agent",
  "description": "Automatically runs tests and reports results to Maestro",
  "version": "1.0.0",
  "author": "Maestro Team",
  "type": "skill",
  "entrypoint": "skill.md",
  "autoRun": true,
  "triggers": ["task_start", "file_change"],
  "capabilities": ["testing", "continuous-integration"],
  "dependencies": [],
  "config": {
    "testCommand": "npm test",
    "watchMode": true,
    "reportToMaestro": true
  }
}
```

### Skill Content Example

**File**: `~/.agents-ui/maestro-skills/test-agent/skill.md`

```markdown
# Test Agent Skill

You are a test automation agent working with Maestro.

## Capabilities
- Run tests automatically when files change
- Report test results to Maestro via hooks API
- Suggest test improvements based on failures

## Commands Available
- `/run-tests` - Run all tests
- `/run-tests-watch` - Run tests in watch mode
- `/test-coverage` - Generate coverage report

## Maestro Integration
When tests complete, update the task progress:
```bash
curl -X POST $MAESTRO_API_URL/hooks/task-progress \
  -H "Content-Type: application/json" \
  -d "{
    \"taskIds\": [\"$MAESTRO_TASK_IDS\"],
    \"sessionId\": \"$MAESTRO_SESSION_ID\",
    \"message\": \"Tests passed: 45/45\"
  }"
```

## Auto-Run Behavior
This skill runs automatically when:
1. A new task session starts
2. Any test file changes
3. The user explicitly calls `/run-tests`
```

### Maestro Skills Data Model

**Maestro Skill** (separate from Claude plugin):

```typescript
interface MaestroSkill {
  id: string;                    // e.g., "test-agent"
  name: string;                  // e.g., "Test Agent"
  description: string;
  type: 'automation' | 'test' | 'deploy' | 'review' | 'worker' | 'custom';

  // Plugin integration
  pluginPath: string;            // Path to Claude plugin directory
  manifestPath: string;          // Path to manifest.json

  // Behavior
  autoRun: boolean;              // Auto-load in sessions
  runOnce: boolean;              // Run once or continuous
  triggerOn?: 'task_start' | 'task_update' | 'manual';

  // Configuration
  config: Record<string, any>;   // Skill-specific config

  // Metadata
  isBuiltIn: boolean;            // Built-in vs custom
  createdAt: number;
  updatedAt: number;
}
```

### Skills in Task Model

Tasks reference skills by ID:

```typescript
interface Task {
  // ... existing fields
  skillIds: string[];            // e.g., ["test-agent", "code-review", "maestro-worker"]
}
```

### Mapping Skills to Plugin Directories

When spawning a terminal, Maestro skill IDs are converted to plugin directory paths:

```typescript
// Maestro skill IDs from task
task.skillIds = ["test-agent", "code-review", "maestro-worker"];

// Convert to plugin directories
const skillDirs = [
  "~/.agents-ui/maestro-skills/test-agent",
  "~/.agents-ui/maestro-skills/code-review",
  "~/.agents-ui/maestro-skills/maestro-worker"
];

// Generate CLI args
claude --plugin-dir ~/.agents-ui/maestro-skills/test-agent \
       --plugin-dir ~/.agents-ui/maestro-skills/code-review \
       --plugin-dir ~/.agents-ui/maestro-skills/maestro-worker
```

### Built-in Maestro Skills

Maestro provides several built-in skills out of the box:

#### 1. **Test Agent Skill** (`test-agent`)

**Purpose**: Automatically run tests and report results to Maestro

**Slash Commands**:
- `/run-tests` - Run all tests
- `/run-tests-watch` - Run tests in watch mode
- `/test-coverage` - Generate coverage report

**Auto-Run**: Yes (runs on task start)

**Maestro Integration**: Reports test results via hooks API

#### 2. **Maestro Worker Skill** (`maestro-worker`)

**Purpose**: Background worker that monitors terminal activity and auto-updates tasks

**Features**:
- Monitors terminal output for progress indicators
- Automatically updates all tasks in `MAESTRO_TASK_IDS`
- Reports milestones, errors, and completions

**Auto-Run**: Yes (runs in background)

**Maestro Integration**: Core orchestration skill, should be on most tasks

#### 3. **Code Review Skill** (`code-review`)

**Purpose**: AI-assisted code review and suggestions

**Slash Commands**:
- `/review-code` - Review current changes
- `/review-pr` - Review entire PR
- `/suggest-improvements` - Suggest code improvements

**Auto-Run**: No (manual trigger)

**Maestro Integration**: Can add review comments to task timeline

#### 4. **Deploy Skill** (`deploy`)

**Purpose**: Handle deployment workflows

**Slash Commands**:
- `/deploy-staging` - Deploy to staging
- `/deploy-production` - Deploy to production
- `/rollback` - Rollback deployment

**Auto-Run**: No (manual trigger)

**Maestro Integration**: Updates task status on deployment events

#### 5. **Git Helper Skill** (`git-helper`)

**Purpose**: Intelligent Git operations with Maestro integration

**Slash Commands**:
- `/commit-task` - Commit with task ID in message
- `/create-pr` - Create PR linked to task
- `/sync-branch` - Sync branch with main

**Auto-Run**: No (manual trigger)

**Maestro Integration**: Links commits and PRs to tasks

### Creating Custom Skills

Users can create custom skills by:

1. Creating a directory in `~/.agents-ui/maestro-skills/my-skill/`
2. Adding `manifest.json` and `skill.md`
3. Using Maestro API hooks for integration
4. Assigning to tasks via UI

**Example Custom Skill**:

```bash
mkdir -p ~/.agents-ui/maestro-skills/my-custom-skill
cd ~/.agents-ui/maestro-skills/my-custom-skill

# Create manifest
cat > manifest.json << 'EOF'
{
  "name": "my-custom-skill",
  "displayName": "My Custom Skill",
  "description": "Custom skill for my workflow",
  "version": "1.0.0",
  "type": "custom",
  "entrypoint": "skill.md",
  "autoRun": false
}
EOF

# Create skill content
cat > skill.md << 'EOF'
# My Custom Skill

You have a custom capability for handling specific workflows.

## Commands
- `/my-command` - Description of what this does

## Maestro Integration
Update tasks using:
```bash
curl -X POST $MAESTRO_API_URL/hooks/task-progress \
  -d '{"taskIds":["'$MAESTRO_TASK_IDS'"],"message":"Custom action completed"}'
```
EOF
```

### MaestroClient API for Skills

**File**: `src/utils/MaestroClient.ts` (extended)

```typescript
class MaestroClient {
  // ... existing methods

  // Skills CRUD
  async getSkills(): Promise<MaestroSkill[]> {
    const res = await fetch(`${this.baseUrl}/skills`);
    return res.json();
  }

  async getSkill(id: string): Promise<MaestroSkill> {
    const res = await fetch(`${this.baseUrl}/skills/${id}`);
    return res.json();
  }

  async createSkill(skill: Partial<MaestroSkill>): Promise<MaestroSkill> {
    const res = await fetch(`${this.baseUrl}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill),
    });
    return res.json();
  }

  async updateSkill(id: string, updates: Partial<MaestroSkill>): Promise<MaestroSkill> {
    const res = await fetch(`${this.baseUrl}/skills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.json();
  }

  async deleteSkill(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/skills/${id}`, { method: 'DELETE' });
  }

  // Install skill from registry or local path
  async installSkill(skillId: string, source?: string): Promise<MaestroSkill> {
    const res = await fetch(`${this.baseUrl}/skills/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, source }),
    });
    return res.json();
  }

  // Task-Skill assignment
  async assignSkillToTask(taskId: string, skillId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    const skillIds = [...new Set([...task.skillIds, skillId])];
    return this.updateTask(taskId, { skillIds });
  }

  async removeSkillFromTask(taskId: string, skillId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    const skillIds = task.skillIds.filter(id => id !== skillId);
    return this.updateTask(taskId, { skillIds });
  }

  // Get skills assigned to a task
  async getTaskSkills(taskId: string): Promise<MaestroSkill[]> {
    const task = await this.getTask(taskId);
    const skills = await this.getSkills();
    return skills.filter(s => task.skillIds.includes(s.id));
  }
}
```

### Backend API Endpoints for Skills

**File**: `maestro-server/src/routes/skills.ts`

```typescript
import { Router } from 'express';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';

const router = Router();
const SKILLS_DIR = path.join(process.env.HOME!, '.agents-ui/maestro-skills');

// GET /api/skills - List all skills
router.get('/', async (req, res) => {
  try {
    const skills = await storage.getSkills();
    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/skills/:id - Get single skill
router.get('/:id', async (req, res) => {
  try {
    const skill = await storage.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json(skill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/skills - Create skill
router.post('/', async (req, res) => {
  try {
    const skill = await storage.createSkill(req.body);

    // Create skill directory
    const skillDir = path.join(SKILLS_DIR, skill.id);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    // Create manifest
    fs.writeFileSync(
      path.join(skillDir, 'manifest.json'),
      JSON.stringify({
        name: skill.id,
        displayName: skill.name,
        description: skill.description,
        version: '1.0.0',
        type: skill.type,
        entrypoint: 'skill.md',
        autoRun: skill.autoRun,
      }, null, 2)
    );

    // Create skill content
    fs.writeFileSync(
      path.join(skillDir, 'skill.md'),
      `# ${skill.name}\n\n${skill.description}\n`
    );

    res.status(201).json(skill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/skills/:id - Update skill
router.patch('/:id', async (req, res) => {
  try {
    const skill = await storage.updateSkill(req.params.id, req.body);
    res.json(skill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/skills/:id - Delete skill
router.delete('/:id', async (req, res) => {
  try {
    await storage.deleteSkill(req.params.id);

    // Remove skill directory
    const skillDir = path.join(SKILLS_DIR, req.params.id);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }

    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/skills/install - Install skill from registry
router.post('/install', async (req, res) => {
  try {
    const { skillId, source } = req.body;

    // TODO: Implement skill installation from registry
    // For now, assume skills are already in ~/.agents-ui/maestro-skills/

    const skillDir = path.join(SKILLS_DIR, skillId);
    if (!fs.existsSync(skillDir)) {
      return res.status(404).json({ error: 'Skill not found in local skills directory' });
    }

    // Read manifest
    const manifestPath = path.join(skillDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // Create Maestro skill entry
    const skill = await storage.createSkill({
      id: skillId,
      name: manifest.displayName || manifest.name,
      description: manifest.description,
      type: manifest.type || 'custom',
      pluginPath: skillDir,
      manifestPath,
      autoRun: manifest.autoRun || false,
      runOnce: false,
      config: manifest.config || {},
      isBuiltIn: false,
    });

    res.status(201).json(skill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
```

---

## Worker Prompt Template System

### Template File Structure

**File**: `~/.agents-ui/maestro-templates/worker-prompt.template`

```handlebars
You are Claude Code, working on a Maestro-managed task.

## Task Context
{{#if MAESTRO_TASK_DATA}}
Task ID: {{MAESTRO_TASK_DATA.id}}
Title: {{MAESTRO_TASK_DATA.title}}
Description: {{MAESTRO_TASK_DATA.description}}
Status: {{MAESTRO_TASK_DATA.status}}
Priority: {{MAESTRO_TASK_DATA.priority}}

Initial Prompt:
{{MAESTRO_TASK_DATA.prompt}}
{{/if}}

{{#if MAESTRO_TASK_IDS}}
## Multi-Task Session
You are working on {{MAESTRO_TASK_COUNT}} tasks simultaneously:
{{#each MAESTRO_TASKS}}
- [{{this.id}}] {{this.title}} ({{this.status}})
{{/each}}
{{/if}}

## Maestro Integration
- Session ID: {{MAESTRO_SESSION_ID}}
- Project ID: {{MAESTRO_PROJECT_ID}}
- API Endpoint: {{MAESTRO_API_URL}}

## Instructions
{{#if MAESTRO_SYSTEM_PROMPT}}
{{MAESTRO_SYSTEM_PROMPT}}
{{/if}}

{{#if MAESTRO_SKILL_IDS}}
## Skills Available
{{#each MAESTRO_SKILLS}}
- {{this.name}}: {{this.description}}
{{/each}}
{{/if}}

## Progress Reporting
Use the following hooks to report progress:
- `curl -X POST {{MAESTRO_API_URL}}/hooks/task-progress` - Update task progress
- `curl -X POST {{MAESTRO_API_URL}}/hooks/task-complete` - Mark task complete
- `curl -X POST {{MAESTRO_API_URL}}/hooks/task-blocked` - Report blocker

{{#if MAESTRO_APPEND_SYSTEM_PROMPT}}
{{MAESTRO_APPEND_SYSTEM_PROMPT}}
{{/if}}
```

### Template Engine Implementation

**File**: `src/utils/promptTemplate.ts`

```typescript
interface TemplateContext {
  MAESTRO_TASK_DATA?: any;
  MAESTRO_TASK_IDS?: string;
  MAESTRO_TASKS?: any[];
  MAESTRO_TASK_COUNT?: number;
  MAESTRO_SESSION_ID?: string;
  MAESTRO_PROJECT_ID?: string;
  MAESTRO_API_URL?: string;
  MAESTRO_SYSTEM_PROMPT?: string;
  MAESTRO_APPEND_SYSTEM_PROMPT?: string;
  MAESTRO_SKILL_IDS?: string;
  MAESTRO_SKILLS?: any[];
}

export class PromptTemplateEngine {
  /**
   * Render prompt template with environment variables
   */
  static renderTemplate(
    templatePath: string,
    envVars: Record<string, string>
  ): string {
    const template = fs.readFileSync(templatePath, 'utf-8');

    // Parse environment variables
    const context: TemplateContext = {
      MAESTRO_SESSION_ID: envVars.MAESTRO_SESSION_ID,
      MAESTRO_PROJECT_ID: envVars.MAESTRO_PROJECT_ID,
      MAESTRO_API_URL: envVars.MAESTRO_API_URL,
      MAESTRO_SYSTEM_PROMPT: envVars.MAESTRO_SYSTEM_PROMPT,
      MAESTRO_APPEND_SYSTEM_PROMPT: envVars.MAESTRO_APPEND_SYSTEM_PROMPT,
    };

    // Parse JSON task data
    if (envVars.MAESTRO_TASK_DATA) {
      try {
        context.MAESTRO_TASK_DATA = JSON.parse(envVars.MAESTRO_TASK_DATA);
      } catch (err) {
        console.error('Failed to parse MAESTRO_TASK_DATA:', err);
      }
    }

    // Parse task IDs and fetch task details
    if (envVars.MAESTRO_TASK_IDS) {
      const taskIds = envVars.MAESTRO_TASK_IDS.split(',');
      context.MAESTRO_TASK_COUNT = taskIds.length;
      // In real implementation, fetch task details from Maestro API
      // context.MAESTRO_TASKS = await fetchTaskDetails(taskIds);
    }

    // Parse skills
    if (envVars.MAESTRO_SKILL_IDS) {
      const skillIds = envVars.MAESTRO_SKILL_IDS.split(',');
      // Fetch skill details
      // context.MAESTRO_SKILLS = await fetchSkillDetails(skillIds);
    }

    // Render template (using handlebars or simple string replacement)
    return this.simpleTemplateRender(template, context);
  }

  /**
   * Simple template rendering (can be replaced with Handlebars)
   */
  private static simpleTemplateRender(
    template: string,
    context: TemplateContext
  ): string {
    let result = template;

    // Replace simple variables
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, String(value));
      }
    }

    // Handle conditionals (simple implementation)
    result = this.handleConditionals(result, context);

    return result;
  }

  private static handleConditionals(
    template: string,
    context: TemplateContext
  ): string {
    // Simple {{#if VAR}}...{{/if}} support
    const ifRegex = /{{#if (\w+)}}([\s\S]*?){{\/if}}/g;

    return template.replace(ifRegex, (match, varName, content) => {
      const value = context[varName as keyof TemplateContext];
      return value ? content : '';
    });
  }
}
```

---

## Claude CLI Invocation Builder

### CLI Builder Implementation

**File**: `src/utils/claudeCliBuilder.ts`

```typescript
export interface ClaudeCliConfig {
  mode: 'interactive' | 'non-interactive';
  model?: 'sonnet' | 'opus' | 'haiku';
  systemPrompt?: string;
  appendSystemPrompt?: string;
  permissionMode?: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk';
  tools?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  sessionId?: string;
  mcpConfig?: string[];
  pluginDirs?: string[];

  // NEW: Skills support (maps to --plugin-dir for each skill)
  skillDirs?: string[];              // Array of skill plugin directories
  disableAllSkills?: boolean;        // Maps to --disable-slash-commands

  maxBudgetUsd?: number;
  jsonSchema?: object;
  outputFormat?: 'text' | 'json' | 'stream-json';
  inputFormat?: 'text' | 'stream-json';
  dangerouslySkipPermissions?: boolean;
  agents?: object;
}

export class ClaudeCliBuilder {
  private config: ClaudeCliConfig;

  constructor(config: ClaudeCliConfig) {
    this.config = config;
  }

  /**
   * Build Claude CLI command and arguments
   */
  buildCommand(): { command: string; args: string[] } {
    const args: string[] = [];

    // Mode
    if (this.config.mode === 'non-interactive') {
      args.push('--print');
    }

    // Model
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    // System prompts
    if (this.config.systemPrompt) {
      args.push('--system-prompt', this.config.systemPrompt);
    }
    if (this.config.appendSystemPrompt) {
      args.push('--append-system-prompt', this.config.appendSystemPrompt);
    }

    // Permission mode
    if (this.config.permissionMode) {
      args.push('--permission-mode', this.config.permissionMode);
    }

    // Tools
    if (this.config.tools && this.config.tools.length > 0) {
      args.push('--tools', this.config.tools.join(','));
    }
    if (this.config.allowedTools && this.config.allowedTools.length > 0) {
      args.push('--allowedTools', this.config.allowedTools.join(','));
    }
    if (this.config.disallowedTools && this.config.disallowedTools.length > 0) {
      args.push('--disallowedTools', this.config.disallowedTools.join(','));
    }

    // Session management
    if (this.config.sessionId) {
      args.push('--session-id', this.config.sessionId);
    }

    // MCP servers
    if (this.config.mcpConfig && this.config.mcpConfig.length > 0) {
      args.push('--mcp-config', ...this.config.mcpConfig);
    }

    // Plugins (generic)
    if (this.config.pluginDirs && this.config.pluginDirs.length > 0) {
      for (const pluginDir of this.config.pluginDirs) {
        args.push('--plugin-dir', pluginDir);
      }
    }

    // NEW: Skills (Maestro-specific, maps to --plugin-dir)
    if (this.config.skillDirs && this.config.skillDirs.length > 0) {
      for (const skillDir of this.config.skillDirs) {
        args.push('--plugin-dir', skillDir);
      }
    }

    // Disable all skills
    if (this.config.disableAllSkills) {
      args.push('--disable-slash-commands');
    }

    // Budget
    if (this.config.maxBudgetUsd) {
      args.push('--max-budget-usd', String(this.config.maxBudgetUsd));
    }

    // JSON Schema
    if (this.config.jsonSchema) {
      args.push('--json-schema', JSON.stringify(this.config.jsonSchema));
    }

    // Output/Input formats
    if (this.config.outputFormat) {
      args.push('--output-format', this.config.outputFormat);
    }
    if (this.config.inputFormat) {
      args.push('--input-format', this.config.inputFormat);
    }

    // Dangerous permissions
    if (this.config.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    // Agents
    if (this.config.agents) {
      args.push('--agents', JSON.stringify(this.config.agents));
    }

    return {
      command: 'claude',
      args,
    };
  }

  /**
   * Parse CLI args from environment variable
   */
  static fromEnvironment(envVars: Record<string, string>): ClaudeCliConfig {
    const config: ClaudeCliConfig = {
      mode: (envVars.CLAUDE_CLI_MODE as any) || 'interactive',
    };

    // Parse CLAUDE_CLI_ARGS if present
    if (envVars.CLAUDE_CLI_ARGS) {
      const argsString = envVars.CLAUDE_CLI_ARGS;
      // Simple parsing (in production, use a proper CLI parser)
      const argParts = argsString.split(/\s+/);

      for (let i = 0; i < argParts.length; i++) {
        const arg = argParts[i];

        if (arg === '--model' && i + 1 < argParts.length) {
          config.model = argParts[++i] as any;
        } else if (arg === '--permission-mode' && i + 1 < argParts.length) {
          config.permissionMode = argParts[++i] as any;
        } else if (arg === '--tools' && i + 1 < argParts.length) {
          config.tools = argParts[++i].split(',');
        }
        // ... parse other arguments
      }
    }

    // Agent config
    if (envVars.MAESTRO_AGENT_CONFIG) {
      try {
        const agentConfig = JSON.parse(envVars.MAESTRO_AGENT_CONFIG);
        config.model = agentConfig.model;
      } catch (err) {
        console.error('Failed to parse MAESTRO_AGENT_CONFIG:', err);
      }
    }

    return config;
  }
}
```

---

## Updated Terminal Spawning Implementation

### maestroHelpers.ts - New Architecture

**File**: `src/utils/maestroHelpers.ts`

```typescript
import { PromptTemplateEngine } from './promptTemplate';
import { ClaudeCliBuilder, ClaudeCliConfig } from './claudeCliBuilder';

export async function startWorkingOnTask(
  task: Task,
  project: Project,
  options?: {
    sessionName?: string;
    skillIds?: string[];
    agentId?: string;
    mode?: 'interactive' | 'non-interactive';
    cliConfig?: Partial<ClaudeCliConfig>;
  }
): Promise<string> {
  // 1. Create session in Maestro server
  const session = await maestroClient.createSession({
    projectId: project.id,
    taskIds: [task.id],
    name: options?.sessionName || `Session: ${task.title}`,
    agentId: options?.agentId,
  });

  // 2. Prepare environment variables
  const envVars: Record<string, string> = {
    // Core Maestro context
    MAESTRO_TASK_DATA: JSON.stringify({
      id: task.id,
      title: task.title,
      description: task.description,
      prompt: task.prompt,
      status: task.status,
      priority: task.priority,
    }),
    MAESTRO_TASK_IDS: task.id,
    MAESTRO_PRIMARY_TASK_ID: task.id,
    MAESTRO_SESSION_ID: session.id,
    MAESTRO_PROJECT_ID: project.id,
    MAESTRO_API_URL: 'http://localhost:3000/api',

    // Skills
    MAESTRO_SKILL_IDS: options?.skillIds?.join(',') || '',

    // Agent
    MAESTRO_AGENT_ID: options?.agentId || '',

    // System prompt from task
    MAESTRO_SYSTEM_PROMPT: task.prompt,
    MAESTRO_APPEND_SYSTEM_PROMPT:
      'Report progress using Maestro hooks. Update task status via API.',

    // Claude CLI configuration
    CLAUDE_CLI_MODE: options?.mode || 'interactive',
    CLAUDE_CLI_ARGS: '--permission-mode acceptEdits --model sonnet',

    // Shell hooks
    PATH: `${process.env.HOME}/.agents-ui/maestro-hooks/bin:${process.env.PATH}`,
    BASH_ENV: `${process.env.HOME}/.agents-ui/maestro-hooks/maestro.sh`,
  };

  // 3. Convert Maestro skill IDs to plugin directories
  const skillDirs: string[] = [];
  if (options?.skillIds && options.skillIds.length > 0) {
    for (const skillId of options.skillIds) {
      const skillDir = `${process.env.HOME}/.agents-ui/maestro-skills/${skillId}`;

      // Check if skill directory exists
      if (await fileExists(skillDir)) {
        skillDirs.push(skillDir);
      } else {
        console.warn(`Skill directory not found: ${skillDir}`);
      }
    }
  }

  // 4. Render prompt template
  const templatePath = `${process.env.HOME}/.agents-ui/maestro-templates/worker-prompt.template`;
  const systemPrompt = PromptTemplateEngine.renderTemplate(templatePath, envVars);

  // 5. Build Claude CLI configuration with skills
  const cliConfig: ClaudeCliConfig = {
    mode: options?.mode || 'interactive',
    model: 'sonnet',
    systemPrompt,
    permissionMode: 'acceptEdits',
    sessionId: session.id,
    skillDirs,  // NEW: Pass skill directories
    ...options?.cliConfig,
  };

  const claudeCli = new ClaudeCliBuilder(cliConfig);
  const { command, args } = claudeCli.buildCommand();

  // 5. Spawn terminal with Claude CLI
  const terminalSessionId = await invoke<string>('spawn_session', {
    name: options?.sessionName || task.title,
    command,
    args,
    cwd: project.basePath || process.env.HOME,
    envVars,
  });

  // 6. Update session with terminal ID
  await maestroClient.updateSession(session.id, {
    terminalId: terminalSessionId,
  });

  return terminalSessionId;
}

/**
 * Start multi-task session
 */
export async function startMultiTaskSession(
  tasks: Task[],
  project: Project,
  options?: {
    sessionName?: string;
    skillIds?: string[];
    agentId?: string;
    mode?: 'interactive' | 'non-interactive';
  }
): Promise<string> {
  const taskIds = tasks.map(t => t.id);

  // Create session
  const session = await maestroClient.createSession({
    projectId: project.id,
    taskIds,
    name: options?.sessionName || `Multi-Task Session`,
    agentId: options?.agentId,
  });

  // Prepare environment variables
  const envVars: Record<string, string> = {
    MAESTRO_TASK_IDS: taskIds.join(','),
    MAESTRO_PRIMARY_TASK_ID: tasks[0].id,
    MAESTRO_SESSION_ID: session.id,
    MAESTRO_PROJECT_ID: project.id,
    MAESTRO_API_URL: 'http://localhost:3000/api',

    // System prompt for multi-task
    MAESTRO_SYSTEM_PROMPT: `You are working on ${tasks.length} tasks simultaneously:\n` +
      tasks.map(t => `- ${t.title}: ${t.description}`).join('\n'),

    MAESTRO_APPEND_SYSTEM_PROMPT:
      'Update ALL tasks via the hooks API. Use MAESTRO_TASK_IDS to update multiple tasks.',

    CLAUDE_CLI_MODE: options?.mode || 'interactive',
    CLAUDE_CLI_ARGS: '--permission-mode acceptEdits --model sonnet',
  };

  // Render template and spawn
  const templatePath = `${process.env.HOME}/.agents-ui/maestro-templates/worker-prompt.template`;
  const systemPrompt = PromptTemplateEngine.renderTemplate(templatePath, envVars);

  const cliConfig: ClaudeCliConfig = {
    mode: options?.mode || 'interactive',
    model: 'sonnet',
    systemPrompt,
    permissionMode: 'acceptEdits',
    sessionId: session.id,
  };

  const claudeCli = new ClaudeCliBuilder(cliConfig);
  const { command, args } = claudeCli.buildCommand();

  const terminalSessionId = await invoke<string>('spawn_session', {
    name: options?.sessionName || 'Multi-Task Session',
    command,
    args,
    cwd: project.basePath || process.env.HOME,
    envVars,
  });

  await maestroClient.updateSession(session.id, {
    terminalId: terminalSessionId,
  });

  return terminalSessionId;
}
```

---

## UI Components for Skills

### Skill Assignment Component

Users assign skills to tasks in the Maestro UI.

**Component**: `src/components/maestro/SkillAssignment.tsx`

```typescript
interface SkillAssignmentProps {
  task: Task;
  availableSkills: MaestroSkill[];
  onSkillsChange: (skillIds: string[]) => void;
}

export function SkillAssignment({ task, availableSkills, onSkillsChange }: SkillAssignmentProps) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>(task.skillIds || []);

  const toggleSkill = async (skillId: string) => {
    const updated = selectedSkills.includes(skillId)
      ? selectedSkills.filter(id => id !== skillId)
      : [...selectedSkills, skillId];

    setSelectedSkills(updated);

    // Update task on server
    await maestroClient.updateTask(task.id, {
      skillIds: updated,
    });

    onSkillsChange(updated);
  };

  return (
    <div className="skillAssignment">
      <h4>📦 Skills for this Task</h4>

      <div className="skillList">
        {availableSkills.map(skill => (
          <label key={skill.id} className="skillCheckbox">
            <input
              type="checkbox"
              checked={selectedSkills.includes(skill.id)}
              onChange={() => toggleSkill(skill.id)}
            />
            <div className="skillInfo">
              <span className="skillName">{skill.name}</span>
              <span className="skillDescription">{skill.description}</span>
              {skill.autoRun && <span className="badge autoRun">auto-run</span>}
              <span className={`badge ${skill.type}`}>{skill.type}</span>
            </div>
          </label>
        ))}
      </div>

      {selectedSkills.length > 0 && (
        <div className="selectedSkillsSummary">
          <strong>Selected ({selectedSkills.length}):</strong>
          <div className="skillBadges">
            {selectedSkills.map(skillId => {
              const skill = availableSkills.find(s => s.id === skillId);
              return skill ? (
                <span key={skillId} className="skillBadge">
                  {skill.name}
                  <button onClick={() => toggleSkill(skillId)} title="Remove skill">
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Skills Management Panel

**Component**: `src/components/maestro/SkillsPanel.tsx`

```typescript
export function SkillsPanel() {
  const [skills, setSkills] = useState<MaestroSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    const data = await maestroClient.getSkills();
    setSkills(data);
    setLoading(false);
  };

  const installSkill = async (skillId: string) => {
    // Install Claude plugin from Maestro skills registry
    await maestroClient.installSkill(skillId);
    loadSkills();
  };

  return (
    <div className="skillsPanel">
      <div className="panelHeader">
        <h2>📦 Skills Library</h2>
        <button onClick={() => window.open('/skills/create')}>+ Create Skill</button>
      </div>

      {loading ? (
        <div className="loading">Loading skills...</div>
      ) : (
        <>
          {/* Built-in skills */}
          <section className="skillSection">
            <h3>Built-in Skills</h3>
            <div className="skillGrid">
              {skills.filter(s => s.isBuiltIn).map(skill => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          </section>

          {/* Custom skills */}
          <section className="skillSection">
            <h3>Custom Skills</h3>
            <div className="skillGrid">
              {skills.filter(s => !s.isBuiltIn).map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onDelete={() => maestroClient.deleteSkill(skill.id)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SkillCard({ skill, onDelete }: { skill: MaestroSkill; onDelete?: () => void }) {
  return (
    <div className="skillCard">
      <div className="skillHeader">
        <h4>{skill.name}</h4>
        {skill.isBuiltIn && <span className="badge builtin">built-in</span>}
      </div>
      <p className="skillDescription">{skill.description}</p>
      <div className="skillMeta">
        <span className={`badge ${skill.type}`}>{skill.type}</span>
        {skill.autoRun && <span className="badge autoRun">auto-run</span>}
      </div>
      <div className="skillActions">
        <button onClick={() => window.open(`/skills/${skill.id}`)}>
          View Details
        </button>
        {!skill.isBuiltIn && onDelete && (
          <button onClick={onDelete} className="danger">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
```

### Integration in Task Card

**Update**: `src/components/maestro/TaskListItem.tsx`

```typescript
export function TaskListItem({ task }: TaskListItemProps) {
  const [availableSkills, setAvailableSkills] = useState<MaestroSkill[]>([]);

  useEffect(() => {
    maestroClient.getSkills().then(setAvailableSkills);
  }, []);

  return (
    <div className="taskListItem">
      {/* ... existing task header, description, etc. */}

      {/* NEW: Skills section */}
      <SkillAssignment
        task={task}
        availableSkills={availableSkills}
        onSkillsChange={(skillIds) => {
          // Update local state
          console.log('Skills updated:', skillIds);
        }}
      />

      {/* ... existing actions, work on task button, etc. */}
    </div>
  );
}
```

---

## Use Cases & Examples

### Use Case 1: Interactive Task with Auto-Accept Edits

```typescript
const terminalId = await startWorkingOnTask(task, project, {
  mode: 'interactive',
  cliConfig: {
    permissionMode: 'acceptEdits',
    model: 'sonnet',
  },
});
```

**Generated Command**:
```bash
claude \
  --model sonnet \
  --system-prompt "..." \
  --permission-mode acceptEdits \
  --session-id sess_abc123
```

### Use Case 2: Non-Interactive Batch Task

```typescript
const terminalId = await startWorkingOnTask(task, project, {
  mode: 'non-interactive',
  cliConfig: {
    model: 'haiku',
    outputFormat: 'stream-json',
    maxBudgetUsd: 5,
  },
});
```

**Generated Command**:
```bash
claude \
  --print \
  --model haiku \
  --output-format stream-json \
  --max-budget-usd 5 \
  --system-prompt "..."
```

### Use Case 3: Task with Multiple Skills

```typescript
// Task with skills assigned in UI
const task = {
  id: 'task_123',
  title: 'Implement login endpoint',
  skillIds: ['test-agent', 'code-review', 'maestro-worker'],
  // ... other fields
};

const terminalId = await startWorkingOnTask(task, project, {
  skillIds: task.skillIds,  // Pass skills from task
  mode: 'interactive',
});
```

**Environment Variables Set**:
```bash
MAESTRO_TASK_ID="task_123"
MAESTRO_SKILL_IDS="test-agent,code-review,maestro-worker"
```

**Generated Command**:
```bash
claude \
  --model sonnet \
  --system-prompt "..." \
  --permission-mode acceptEdits \
  --plugin-dir ~/.agents-ui/maestro-skills/test-agent \
  --plugin-dir ~/.agents-ui/maestro-skills/code-review \
  --plugin-dir ~/.agents-ui/maestro-skills/maestro-worker \
  --session-id sess_xyz
```

**Result**: Claude session loads with 3 skills available as slash commands:
- `/run-tests` - From test-agent skill
- `/review-code` - From code-review skill
- Maestro Worker runs in background automatically

### Use Case 3b: Multi-Task Session with Skills

```typescript
const terminalId = await startMultiTaskSession([task1, task2, task3], project, {
  sessionName: 'Build Login Flow',
  skillIds: ['test-agent', 'maestro-worker'],
  agentId: 'agent_claude',
  mode: 'interactive',
});
```

**Environment Variables Set**:
```bash
MAESTRO_TASK_IDS="task_1,task_2,task_3"
MAESTRO_SKILL_IDS="test-agent,maestro-worker"
MAESTRO_AGENT_ID="agent_claude"
```

**Generated Command**:
```bash
claude \
  --model sonnet \
  --system-prompt "You are working on 3 tasks simultaneously..." \
  --append-system-prompt "Update ALL tasks..." \
  --permission-mode acceptEdits \
  --plugin-dir ~/.agents-ui/maestro-skills/test-agent \
  --plugin-dir ~/.agents-ui/maestro-skills/maestro-worker \
  --session-id sess_xyz
```

### Use Case 4: Sandboxed Execution with Limited Tools

```typescript
const terminalId = await startWorkingOnTask(task, project, {
  cliConfig: {
    allowedTools: ['Read', 'Grep', 'Glob'],
    disallowedTools: ['Bash', 'Write', 'Edit'],
    dangerouslySkipPermissions: true,
  },
});
```

**Generated Command**:
```bash
claude \
  --allowedTools Read,Grep,Glob \
  --disallowedTools Bash,Write,Edit \
  --dangerously-skip-permissions \
  --system-prompt "..."
```

### Use Case 5: Agent with Custom MCP Servers

```typescript
const terminalId = await startWorkingOnTask(task, project, {
  cliConfig: {
    mcpConfig: ['~/.config/mcp/maestro-mcp.json'],
    pluginDirs: ['~/.agents-ui/plugins'],
  },
});
```

**Generated Command**:
```bash
claude \
  --mcp-config ~/.config/mcp/maestro-mcp.json \
  --plugin-dir ~/.agents-ui/plugins \
  --system-prompt "..."
```

---

## Interactive vs Non-Interactive Modes

### Interactive Mode

**Best for**:
- User-driven development
- Iterative problem solving
- Tasks requiring human judgment

**Configuration**:
```typescript
{
  mode: 'interactive',
  permissionMode: 'acceptEdits', // or 'default', 'plan'
  // No --print flag
}
```

**Features**:
- Full conversation history
- Interactive permission prompts
- Session persistence
- IDE integration

### Non-Interactive Mode

**Best for**:
- Automation workflows
- CI/CD pipelines
- Batch processing
- Agent-driven tasks

**Configuration**:
```typescript
{
  mode: 'non-interactive',
  outputFormat: 'stream-json',
  inputFormat: 'stream-json',
  dangerouslySkipPermissions: true, // Only in sandboxed environments
  maxBudgetUsd: 10,
}
```

**Features**:
- Single response and exit
- Structured output (JSON)
- Streaming support
- Budget control

---

## Hooks, Skills, and Agents Integration

### Hooks Available to Claude

Claude can use these hooks via environment variables:

```bash
# In Claude's execution context
curl -X POST $MAESTRO_API_URL/hooks/task-progress \
  -H "Content-Type: application/json" \
  -d '{
    "taskIds": ["'$MAESTRO_TASK_IDS'"],
    "sessionId": "'$MAESTRO_SESSION_ID'",
    "message": "Implemented login endpoint"
  }'
```

### Skills Integration

Skills can be:
1. **Auto-run**: Execute on session start
2. **Manual**: Execute on demand
3. **Continuous**: Run in background (like Maestro Worker)

**Example**: Test Agent Skill

```typescript
{
  id: 'skill_test_agent',
  command: 'maestro-test-agent',
  autoRun: true,
  config: {
    testCommand: 'npm test',
    watchMode: true,
  },
}
```

**Integration**:
```typescript
// In terminal spawning
if (task.skillIds.includes('skill_test_agent')) {
  // Add to initial commands or background processes
  envVars.MAESTRO_INIT_COMMANDS = 'maestro-test-agent &';
}
```

### Agents Integration

**Agent Configuration via Environment**:

```bash
MAESTRO_AGENT_ID="agent_claude"
MAESTRO_AGENT_CONFIG='{"model":"sonnet","temperature":0.7,"capabilities":["code","test","deploy"]}'
```

**Multiple Agents**:

```typescript
const agents = {
  coder: {
    description: "Writes code",
    prompt: "You are a senior software engineer",
  },
  reviewer: {
    description: "Reviews code",
    prompt: "You are a code reviewer focusing on security and performance",
  },
};

await startWorkingOnTask(task, project, {
  cliConfig: {
    agents,
    agent: 'coder', // Active agent
  },
});
```

**Generated Command**:
```bash
claude \
  --agents '{"coder":{"description":"...","prompt":"..."},"reviewer":{...}}' \
  --agent coder \
  --system-prompt "..."
```

---

## Security Considerations

### Environment Variable Safety

1. **Validation**: Validate all environment variables before spawning
2. **Sanitization**: Escape special characters in JSON
3. **Size limits**: Prevent excessively large environment variables
4. **Secret management**: Never pass secrets via environment variables

```typescript
function validateEnvVars(envVars: Record<string, string>): void {
  // Check size
  for (const [key, value] of Object.entries(envVars)) {
    if (value.length > 10000) {
      throw new Error(`Environment variable ${key} exceeds size limit`);
    }
  }

  // Validate JSON
  if (envVars.MAESTRO_TASK_DATA) {
    try {
      JSON.parse(envVars.MAESTRO_TASK_DATA);
    } catch (err) {
      throw new Error('Invalid MAESTRO_TASK_DATA JSON');
    }
  }

  // Check for secrets
  const secretPatterns = [/api[_-]?key/i, /password/i, /secret/i, /token/i];
  for (const [key, value] of Object.entries(envVars)) {
    for (const pattern of secretPatterns) {
      if (pattern.test(key) || pattern.test(value)) {
        console.warn(`Potential secret in environment variable: ${key}`);
      }
    }
  }
}
```

### Permission Modes

**For Production**:
- Use `default` or `plan` permission mode
- Require user approval for destructive operations
- Log all permission decisions

**For Development**:
- `acceptEdits` for faster iteration
- Sandboxed environments only

**Never in Production**:
- `dangerouslySkipPermissions`
- `bypassPermissions`

---

## Implementation Plan

### Phase 6-A: Environment Variables & Templates (Week 1)

1. Define environment variable schema
2. Implement PromptTemplateEngine
3. Create default worker-prompt.template
4. Update maestroHelpers.ts to use environment variables
5. Test single-task spawning with environment variables

**Success Criteria**:
- Terminal spawns with all environment variables set
- Template renders correctly with task data
- Backward compatible with Phase 4a

### Phase 6-B: Claude CLI Builder (Week 2)

1. Implement ClaudeCliBuilder class
2. Support all relevant CLI options
3. Parse CLAUDE_CLI_ARGS from environment
4. Test different CLI configurations

**Success Criteria**:
- Can generate Claude CLI commands for all use cases
- CLI builder supports all relevant options
- Easy to add new options

### Phase 6-C: Skills System Integration (Week 3)

1. **Skills Storage & Data Model**
   - Create `~/.agents-ui/maestro-skills/` directory structure
   - Implement MaestroSkill data model in backend
   - Create skills CRUD API endpoints

2. **Built-in Skills Creation**
   - Create Test Agent skill (test-agent/)
   - Create Maestro Worker skill (maestro-worker/)
   - Create Code Review skill (code-review/)
   - Create Deploy skill (deploy/)
   - Create Git Helper skill (git-helper/)

3. **Skills UI Components**
   - Implement SkillAssignment component
   - Implement SkillsPanel component
   - Integrate into TaskListItem
   - Add skills management page

4. **Skills in Terminal Spawning**
   - Update ClaudeCliBuilder to handle skillDirs
   - Implement skill ID to plugin directory mapping
   - Update maestroHelpers to load skills
   - Test multiple skills loading

5. **Multi-Task Sessions with Skills**
   - Implement startMultiTaskSession
   - Update template for multi-task context
   - Test skills with multi-task sessions

**Success Criteria**:
- ✅ Users can assign skills to tasks via UI
- ✅ Skills are correctly converted to --plugin-dir arguments
- ✅ Multiple skills load in Claude session
- ✅ Skills slash commands work in terminal
- ✅ Multi-task sessions work with skills
- ✅ Built-in skills installed and functional

### Phase 6-D: Agents & Advanced Features (Week 4)

1. Agent configuration via environment
2. Support custom agents via --agents flag
3. MCP server integration
4. Plugin directory support

**Success Criteria**:
- Agents can be configured per session
- Custom agents work correctly
- MCP servers integrate seamlessly

### Phase 6-E: Testing & Documentation (Week 5)

1. End-to-end testing for all use cases
2. Security testing (environment variable validation)
3. Performance testing (large task lists)
4. User documentation

**Success Criteria**:
- All use cases tested
- Security vulnerabilities addressed
- Performance acceptable
- Documentation complete

---

## Clarifying Questions

Before proceeding with implementation, please clarify:

### 1. Environment Variable Limits
- What's the maximum size for MAESTRO_TASK_DATA?
- Should we paginate for large task lists?
- How to handle very long system prompts?

### 2. Template System
- Use Handlebars.js or build custom?
- Support user-defined templates?
- Template versioning strategy?

### 3. CLI Configuration Priorities
- If both environment variable and CLI args specify model, which wins?
- How to merge default config with task-specific config?
- Should we support per-project CLI defaults?

### 4. Non-Interactive Mode
- Should non-interactive mode auto-update tasks?
- How to capture output for task timeline?
- Timeout configuration?

### 5. Multi-Agent Sessions
- Can multiple agents work on same task simultaneously?
- How to coordinate between agents?
- Agent-to-agent communication?

### 6. Security
- Sandboxing strategy for dangerous operations?
- How to prevent malicious task prompts?
- Rate limiting for API hooks?

---

## Next Steps

Once clarifying questions are answered:

1. **Review & Approve Architecture**: Ensure this design meets all requirements
2. **Create Implementation Plan**: Detailed step-by-step plan with sub-tasks
3. **Prototype Core Components**: Build PromptTemplateEngine and ClaudeCliBuilder
4. **Test with Single Task**: Validate the approach works end-to-end
5. **Iterate & Expand**: Add multi-task, skills, agents incrementally

---

## Complete End-to-End Example with Skills

### Scenario: User creates a task, assigns skills, and starts working

#### Step 1: User Creates Task in UI

```typescript
// User fills out task creation form
const newTask = await maestroClient.createTask({
  projectId: 'proj_xyz',
  title: 'Implement user authentication',
  description: 'Add JWT-based authentication to the API',
  prompt: 'Implement JWT authentication middleware for Express.js. Include login, logout, and token refresh endpoints.',
  priority: 'high',
  status: 'pending',
});

// Task created with ID: task_auth_001
```

#### Step 2: User Assigns Skills to Task

```typescript
// User checks skills in the UI:
// ✅ Test Agent (to run tests automatically)
// ✅ Code Review (for code quality)
// ✅ Maestro Worker (for auto-updates)

await maestroClient.updateTask('task_auth_001', {
  skillIds: ['test-agent', 'code-review', 'maestro-worker'],
});
```

#### Step 3: User Clicks "Work on Task"

UI calls:
```typescript
const terminalId = await startWorkingOnTask(task, project, {
  skillIds: ['test-agent', 'code-review', 'maestro-worker'],
  mode: 'interactive',
});
```

#### Step 4: Behind the Scenes - Terminal Spawning

**4a. Environment Variables Prepared**:
```bash
MAESTRO_TASK_DATA='{"id":"task_auth_001","title":"Implement user authentication",...}'
MAESTRO_TASK_IDS="task_auth_001"
MAESTRO_SKILL_IDS="test-agent,code-review,maestro-worker"
MAESTRO_SESSION_ID="sess_001"
MAESTRO_PROJECT_ID="proj_xyz"
MAESTRO_API_URL="http://localhost:3000/api"
```

**4b. Skills Mapped to Directories**:
```typescript
const skillDirs = [
  "/Users/user/.agents-ui/maestro-skills/test-agent",
  "/Users/user/.agents-ui/maestro-skills/code-review",
  "/Users/user/.agents-ui/maestro-skills/maestro-worker"
];
```

**4c. Claude CLI Command Generated**:
```bash
claude \
  --model sonnet \
  --system-prompt "You are working on task: Implement user authentication. Add JWT-based authentication..." \
  --append-system-prompt "Report progress using Maestro hooks. Update task via API." \
  --permission-mode acceptEdits \
  --session-id sess_001 \
  --plugin-dir /Users/user/.agents-ui/maestro-skills/test-agent \
  --plugin-dir /Users/user/.agents-ui/maestro-skills/code-review \
  --plugin-dir /Users/user/.agents-ui/maestro-skills/maestro-worker
```

**4d. Terminal Opens with Claude Session**

#### Step 5: Claude Session Active with Skills

User sees in terminal:
```
Claude Code (Sonnet 4.5) - Session: task_auth_001

Skills loaded:
  ✓ Test Agent - /run-tests, /run-tests-watch, /test-coverage
  ✓ Code Review - /review-code, /review-pr, /suggest-improvements
  ✓ Maestro Worker - Running in background

Environment:
  📋 Task: Implement user authentication
  🎯 Session: sess_001
  🔗 Maestro API: http://localhost:3000/api

You are working on: Implement user authentication
Add JWT-based authentication to the API...

What would you like to do?
>
```

#### Step 6: User Works with Claude

**User types**:
```
Create the authentication middleware and endpoints
```

**Claude responds and starts working**:
```
I'll create the JWT authentication system. Let me:
1. Install required dependencies
2. Create authentication middleware
3. Implement login/logout/refresh endpoints
4. Add tests

Let me start...
```

#### Step 7: Skills Activate Automatically

**Test Agent Skill (auto-run)**:
- Watches for file changes
- Runs tests when test files are modified
- Reports results:
  ```bash
  curl -X POST http://localhost:3000/api/hooks/task-progress \
    -d '{"taskIds":["task_auth_001"],"message":"Tests passing: 12/12"}'
  ```

**Maestro Worker Skill (background)**:
- Monitors terminal output
- Detects patterns: "✓ Tests passed", "Error:", "Completed"
- Auto-updates task timeline

**Code Review Skill (manual)**:
- Available for user to call: `/review-code`

#### Step 8: Task Updates in Real-Time

Back in Maestro UI, user sees task timeline update:
```
[10:15] Task started - Session sess_001 created
[10:16] Progress: Installing dependencies (jwt, bcrypt)
[10:18] Progress: Created auth middleware
[10:20] Progress: Implemented login endpoint
[10:22] Tests passing: 5/5
[10:24] Progress: Implemented logout endpoint
[10:25] Tests passing: 8/8
[10:27] Progress: Implemented token refresh
[10:28] Tests passing: 12/12 ✓
[10:30] Code review completed - No issues found
```

#### Step 9: User Uses Skills Manually

**User runs**:
```
/review-code
```

**Code Review Skill activates**:
```
Running code review on recent changes...

✓ Security: JWT secret properly managed in environment variables
✓ Error handling: All endpoints have proper error handling
⚠ Suggestion: Consider adding rate limiting to login endpoint
✓ Tests: All authentication flows covered

Overall: Looks good! Consider the rate limiting suggestion.

Reporting to Maestro...
```

**Updates task**:
```bash
curl -X POST http://localhost:3000/api/hooks/task-progress \
  -d '{"taskIds":["task_auth_001"],"message":"Code review complete - 1 suggestion"}'
```

#### Step 10: Task Completion

**Claude finishes**:
```
All authentication endpoints implemented and tested!

Summary:
- ✓ JWT middleware created
- ✓ Login endpoint with token generation
- ✓ Logout endpoint with token invalidation
- ✓ Token refresh endpoint
- ✓ 12/12 tests passing
- ✓ Code review passed with 1 suggestion

Marking task as complete...
```

**Maestro Worker auto-updates**:
```bash
curl -X POST http://localhost:3000/api/hooks/task-complete \
  -d '{"taskId":"task_auth_001","summary":"JWT authentication implemented with all tests passing"}'
```

#### Result in Maestro UI

Task card shows:
```
✅ Implement user authentication [COMPLETED]

Skills Used:
  🧪 Test Agent - 12/12 tests passed
  👁 Code Review - 1 suggestion
  🤖 Maestro Worker - Auto-updated throughout

Timeline: 15 updates
Duration: 15 minutes
Session: sess_001
```

---

## Summary

Phase 6 transforms terminal spawning from simple prompt passing to a **robust, flexible orchestration system**:

- ✅ **Rich Context**: Full task data via environment variables
- ✅ **Template System**: Dynamic prompt generation from task context
- ✅ **CLI Flexibility**: Use all Claude Code CLI features (40+ options)
- ✅ **Multi-Mode Support**: Interactive and non-interactive modes
- ✅ **Skills Integration**: Load multiple skills via `--plugin-dir` (repeatable)
- ✅ **Agents**: Configure agents per session with custom capabilities
- ✅ **Security**: Validated, sandboxed execution with permission modes
- ✅ **Extensible**: Easy to add new features, skills, and agents

### Skills System Highlights

**Key Innovation**: Maestro skills → Claude Code plugins via `--plugin-dir`

```
User assigns skills in UI
         ↓
Maestro skill IDs: ["test-agent", "code-review"]
         ↓
Convert to plugin directories
         ↓
--plugin-dir ~/.agents-ui/maestro-skills/test-agent
--plugin-dir ~/.agents-ui/maestro-skills/code-review
         ↓
Claude loads skills as slash commands
         ↓
User can use /run-tests, /review-code
         ↓
Skills report back to Maestro via hooks API
```

### Architecture Benefits

1. **Separation of Concerns**
   - Task data: Environment variables
   - Skills: Plugin directories
   - Agents: CLI configuration
   - Prompts: Template system

2. **Flexibility**
   - Any number of skills per task
   - Skills work in both interactive and non-interactive modes
   - Users can create custom skills
   - Built-in skills provided out-of-the-box

3. **Real-Time Integration**
   - Skills auto-update tasks via Maestro hooks API
   - Maestro Worker skill provides background monitoring
   - UI shows real-time task progress

4. **Developer Experience**
   - Simple skill assignment via checkboxes
   - One-click "Work on Task" with all skills loaded
   - Skills available as slash commands in Claude
   - Full visibility into skill activity

This architecture enables Maestro to fully leverage Claude Code's capabilities for intelligent task orchestration with powerful skill-based automation.
