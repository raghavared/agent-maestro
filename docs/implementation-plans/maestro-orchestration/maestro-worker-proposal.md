Maestro Worker Skill Proposal: Task Orchestration via Claude Code
Executive Summary
This document outlines a proposed enhancement to the Maestro-Agents UI integration that introduces automated task execution using Claude Code instances orchestrated by a Maestro Worker Skill. Instead of manually running tasks, the system will automatically spawn Claude Code sessions with carefully engineered context, execute tasks with their subtasks, and track progress in real-time.

Current State vs. Proposed State
Current Architecture (From Integration Docs)
User clicks "Work on Task" in UI
    ↓
Agents UI creates terminal session
    ↓
Sets MAESTRO_TASK_ID, MAESTRO_SESSION_ID env vars
    ↓
User manually interacts with Claude Code
    ↓
Hooks track progress automatically
    ↓
User or Claude runs skill commands (maestro update, maestro complete)
    ↓
UI updates in real-time
Key Characteristics:

Manual execution: User initiates and guides Claude
Interactive: User provides prompts and direction
Context-light: Only task ID and environment variables provided
Proposed Architecture (Two-Tier Orchestration)
User clicks "Run Task" in UI
    ↓
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: MAESTRO ORCHESTRATOR (Planning Phase)              │
└─────────────────────────────────────────────────────────────┘
    ↓
Spawn Claude Code with Maestro Orchestrator Skill
    ↓
Orchestrator analyzes task:
    - Reviews existing subtasks
    - Creates new subtasks if needed
    - Refines subtask descriptions
    - Groups subtasks by context similarity
    - Creates execution plan
    ↓
Output: Grouped execution plan
    Example: 
    - Group 1: [Backend API] → subtasks 1, 2, 3
    - Group 2: [Frontend UI] → subtasks 4, 5
    - Group 3: [Testing] → subtask 6
    ↓
┌─────────────────────────────────────────────────────────────┐
│ TIER 2: MAESTRO WORKER (Execution Phase)                   │
└─────────────────────────────────────────────────────────────┘
    ↓
For each group, spawn new terminal session:
    ↓
    Terminal 1: Executes Group 1 (subtasks 1,2,3)
    Terminal 2: Executes Group 2 (subtasks 4,5)
    Terminal 3: Executes Group 3 (subtask 6)
    ↓
Each terminal uses Maestro Worker Skill:
    - maestro update "<progress>"
    - maestro subtask-complete <id>
    - maestro blocked "<reason>"
    ↓
Hooks track all activity automatically
    ↓
UI shows real-time progress across all sessions
    ↓
All sessions complete → Task marked complete
Key Characteristics:

Two-tier intelligence: Planning (Orchestrator) + Execution (Worker)
Smart grouping: Context-similar subtasks run together
Parallel execution: Multiple terminal sessions running simultaneously
Dynamic planning: Orchestrator can create/modify subtasks
Self-optimizing: Orchestrator decides optimal grouping strategy
Detailed Proposal Analysis
1. Context Engineering
What Gets Sent to Claude?
When running a task, the orchestrator builds a comprehensive context package:

Task Context:

type TaskContext = {
  task: {
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    initialPrompt: string;
  };
  
  subtasks: Array<{
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    dependencies: string[]; // IDs of tasks that must complete first
  }>;
  
  project: {
    id: string;
    name: string;
    basePath: string;
    // Relevant file structure
    relevantFiles: string[];
  };
  
  maestroInstructions: {
    skillCommands: ['maestro update', 'maestro complete', 'maestro blocked', 'maestro info'];
    statusUpdateGuidelines: string;
    completionCriteria: string;
  };
};
Initial Prompt Template
The orchestrator generates a comprehensive initial prompt:

# Task Execution Context
You are Claude Code, working on a task within the Maestro task management system.
## Task Information
**Title:** {{task.title}}
**Priority:** {{task.priority}}
**Description:** {{task.description}}
## Your Objective
{{task.initialPrompt}}
## Subtasks
You need to complete the following subtasks in order:
{{#each subtasks}}
{{@index}}. [{{status}}] {{title}}
   Description: {{description}}
   {{#if dependencies}}Dependencies: {{join dependencies}}{{/if}}
{{/each}}
## Project Context
- Working Directory: {{project.basePath}}
- Project Name: {{project.name}}
- Key Files: {{join project.relevantFiles}}
## Maestro Worker Skill Usage
You have access to the Maestro Worker Skill commands. Use them to update progress:
- **maestro update "\<message\>"** - After completing a significant piece of work
- **maestro complete "\<summary\>"** - When ALL subtasks are finished
- **maestro blocked "\<reason\>"** - If you encounter a blocker
- **maestro info** - To see current task status
### Guidelines
1. Work through subtasks **in order**
2. Use `maestro update` after completing each subtask
3. Only use `maestro complete` when ALL subtasks are done
4. If blocked, use `maestro blocked` with clear reason
5. Focus **only on the subtasks listed** - do NOT consider parent task context
## Begin Execution
Start working on the first pending subtask now.
2. Subtask Granularity
Why Only Subtasks?
Your Key Insight: "When running a task, only the subtasks will be considered. Its parent tasks won't be considered."

Rationale:

Focused scope: Claude works on a well-defined chunk
Reduced context: Less confusion, more accuracy
Better tracking: Individual subtask progress
Clearer completion: Know exactly when done
Example:

Parent Task: "Build Authentication System"
├─ Subtask 1: "Implement JWT token generation"
├─ Subtask 2: "Create login endpoint"
├─ Subtask 3: "Add authentication middleware"
└─ Subtask 4: "Write integration tests"
When running this task:
- Claude sees ONLY the 4 subtasks
- Does NOT see parent task's original broad context
- Focuses sequentially on each subtask
Task Decomposition
Before running a task, the system ensures subtasks are well-defined:

type SubtaskRequirements = {
  minSubtasks: 2;          // Don't run tasks without subtasks
  maxSubtasks: 10;         // Too many = task too big
  requireDescriptions: true; // Each subtask needs description
  requireOrdering: true;    // Subtasks must be ordered
};
UI Flow:

User creates task
    ↓
If no subtasks defined:
    → Show "Add Subtasks" dialog
    → User breaks down task
    ↓
If subtasks ready:
    → "Run Task" button enabled
3. Two-Tier Skill Architecture
Overview: Orchestrator + Worker
The system uses two distinct skills working in tandem:

Maestro Orchestrator Skill (Tier 1: Planning)
Maestro Worker Skill (Tier 2: Execution)
Skills Folder Structure
Following existing skills standards, all Maestro skills are maintained in the skills folder:

/Users/subhang/Desktop/Projects/agents-ui/skills/
├── maestro-orchestrator/
│   ├── SKILL.md              # Orchestrator instructions
│   ├── package.json
│   └── commands/
│       ├── plan.js           # Main planning command
│       ├── analyze.js        # Task analysis
│       └── group.js          # Subtask grouping
└── maestro-worker/
    ├── SKILL.md              # Worker instructions
    ├── package.json
    └── commands/
        ├── update.js         # Progress updates
        ├── complete.js       # Mark complete
        ├── blocked.js        # Mark blocked
        └── subtask.js        # Subtask-specific commands
4. Maestro Orchestrator Skill (Tier 1)
Purpose
The Orchestrator is the intelligent planning layer that runs BEFORE execution. Its job:

Analyze the task and existing subtasks
Refine subtask definitions (create new ones, merge, split)
Group subtasks by contextual similarity
Plan the optimal execution strategy
Output a structured execution plan
Orchestrator Commands
Main Command:

maestro-orchestrator plan --task-id <task_id>
What it does:

// Pseudo-code for orchestrator
async function plan(taskId) {
  // 1. Get task and current subtasks
  const task = await fetchTask(taskId);
  const subtasks = task.subtasks || [];
  
  // 2. Analyze with Claude (in this orchestrator session)
  const analysis = await analyzeTask(task, subtasks);
  
  // 3. Claude can create/modify subtasks
  const refinedSubtasks = await refineSubtasks(subtasks, analysis);
  
  // 4. Group by context similarity
  const groups = await groupSubtasks(refinedSubtasks);
  
  // 5. Create execution plan
  const plan = {
    taskId,
    groups: [
      {
        id: 'group_1',
        name: 'Backend API Development',
        context: 'server, database, API endpoints',
        subtasks: ['st_1', 'st_2', 'st_3'],
        estimatedDuration: '30min'
      },
      {
        id: 'group_2',
        name: 'Frontend UI Implementation',
        context: 'components, styling, state management',
        subtasks: ['st_4', 'st_5'],
        estimatedDuration: '20min'
      }
    ],
    executionStrategy: 'parallel', // or 'sequential'
    totalSubtasks: 5
  };
  
  // 6. Save plan to Maestro backend
  await savePlan(taskId, plan);
  
  return plan;
}
Orchestrator Initial Prompt
When the orchestrator session starts:

# Maestro Orchestrator: Task Planning
You are the Maestro Orchestrator. Your job is to create an optimal execution plan.
## Task Information
**Title:** {{task.title}}
**Description:** {{task.description}}
**Initial Prompt:** {{task.initialPrompt}}
## Current Subtasks
{{#each subtasks}}
{{@index}}. {{title}} - {{description}}
{{/each}}
## Your Responsibilities
1. **Analyze** the task thoroughly
2. **Review** existing subtasks - are they sufficient?
3. **Create** new subtasks if needed for completeness
4. **Refine** subtask descriptions to be clear and actionable
5. **Group** subtasks by contextual similarity:
   - Subtasks working on similar files/components → same group
   - Subtasks requiring similar context → same group
   - Independent subtasks → separate groups (can run parallel)
6. **Output** a structured plan using: `maestro-orchestrator plan`
## Grouping Guidelines
- **Minimize context switching**: Group related work together
- **Enable parallelism**: Separate independent work into different groups
- **Balance load**: Aim for 2-5 subtasks per group
- **Consider dependencies**: Dependent tasks in same group or sequence
## Example Output
```json
{
  "groups": [
    {
      "name": "Database Schema",
      "context": "models, migrations, database",
      "subtasks": ["create_user_model", "add_auth_table"]
    },
    {
      "name": "API Endpoints",
      "context": "routes, controllers, middleware",
      "subtasks": ["login_endpoint", "register_endpoint"]
    }
  ]
}
Begin Planning
Analyze the task and create your execution plan now.

#### Orchestrator Output Format
The orchestrator writes the plan to the Maestro backend:
```typescript
type ExecutionPlan = {
  taskId: string;
  createdBy: 'orchestrator';
  createdAt: number;
  groups: ExecutionGroup[];
  executionStrategy: 'parallel' | 'sequential';
  totalSubtasks: number;
};
type ExecutionGroup = {
  id: string;
  name: string;              // Human-readable group name
  context: string;           // Context description
  subtasks: string[];        // Subtask IDs
  estimatedDuration?: string;
  dependencies?: string[];   // IDs of groups that must complete first
};
6. AI-Driven Planning: Prompt Engineering & Response Parsing
This is the core intelligence of the orchestrator - how it uses AI to analyze, plan, and generate the execution structure.

6.1 The Planning Pipeline
User clicks "Run Task"
    ↓
┌──────────────────────────────────────────────────────┐
│ STEP 1: Fetch Task Data                             │
└──────────────────────────────────────────────────────┘
    ↓
GET /api/tasks/task_xyz
Response: { id, title, description, subtasks: [...] }
    ↓
┌──────────────────────────────────────────────────────┐
│ STEP 2: Build AI Prompt                             │
└──────────────────────────────────────────────────────┘
    ↓
Generate structured prompt with:
  - Task details
  - Existing subtasks
  - Project context
  - Output format specification (JSON schema)
    ↓
┌──────────────────────────────────────────────────────┐
│ STEP 3: Call AI (Claude API)                        │
└──────────────────────────────────────────────────────┘
    ↓
POST to Claude API with prompt
Receive AI response (JSON string)
    ↓
┌──────────────────────────────────────────────────────┐
│ STEP 4: Parse AI Response                           │
└──────────────────────────────────────────────────────┘
    ↓
Parse JSON response into objects:
  - updatedSubtasks: Subtask[]
  - groups: ExecutionGroup[]
  - strategy: ExecutionStrategy
    ↓
┌──────────────────────────────────────────────────────┐
│ STEP 5: Update Task in Database                     │
└──────────────────────────────────────────────────────┘
    ↓
PATCH /api/tasks/task_xyz
{
  subtasks: updatedSubtasks,
  executionPlan: { groups, strategy }
}
    ↓
┌──────────────────────────────────────────────────────┐
│ STEP 6: Create Session Mappings                     │
└──────────────────────────────────────────────────────┘
    ↓
For each group, create mapping:
  taskId → groupId → (future) sessionId
Store in execution plan
    ↓
Ready for execution phase
6.2 Orchestrator Prompt Template
Full structured prompt sent to AI:

function buildOrchestratorPrompt(task: Task, project: Project): string {
  return `
# Maestro Orchestrator: Execution Planning
You are an intelligent task orchestrator. Analyze the following task and create an optimal execution plan.
## Task Details
**ID:** ${task.id}
**Title:** ${task.title}
**Description:** ${task.description}
**Priority:** ${task.priority}
**Initial Prompt:** ${task.initialPrompt}
## Existing Subtasks
${task.subtasks.length > 0 
  ? task.subtasks.map((st, i) => `${i+1}. **${st.title}**
   - Description: ${st.description}
   - Status: ${st.status}
   - Dependencies: ${st.dependencies.join(', ') || 'none'}`).join('\n\n')
  : 'No subtasks defined yet.'}
## Project Context
- **Name:** ${project.name}
- **Base Path:** ${project.basePath}
- **Type:** ${detectProjectType(project)}
## Your Task
1. **Analyze** the task comprehensively
2. **Review** existing subtasks:
   - Are they sufficient to complete the task?
   - Are they well-defined and actionable?
   - Should any be split, merged, or removed?
3. **Create new subtasks** if needed for completeness
4. **Refine descriptions** to be clear, specific, and actionable
5. **Group subtasks** by contextual similarity:
   - Related files/components → same group
   - Similar technical context → same group
   - Independent work → separate groups (for parallelism)
6. **Determine execution strategy** (sequential, parallel, or mixed)
## Output Format (STRICT JSON)
You MUST respond with ONLY valid JSON in this exact structure:
\`\`\`json
{
  "analysis": {
    "summary": "Brief analysis of the task",
    "subtaskChanges": "What subtasks were added/modified/removed",
    "groupingRationale": "Why you grouped subtasks this way"
  },
  "subtasks": [
    {
      "id": "st_1", 
      "title": "Subtask title",
      "description": "Clear, actionable description",
      "dependencies": ["st_0"], // IDs of subtasks that must complete first
      "estimatedDuration": "15min"
    }
  ],
  "groups": [
    {
      "id": "grp_1",
      "name": "Human-readable group name",
      "context": "Files/components this group works on",
      "subtaskIds": ["st_1", "st_2"],
      "dependencies": [], // Group IDs that must complete first
      "canRunInParallel": true
    }
  ],
  "executionStrategy": {
    "type": "mixed", // "sequential" | "parallel" | "mixed"
    "reasoning": "Why this strategy is optimal"
  },
  "taskToSessionMapping": [
    {
      "groupId": "grp_1",
      "subtaskIds": ["st_1", "st_2"],
      "sessionName": "Database Layer Setup",
      "order": 1,
      "parallelGroup": null // or number for parallel groups
    }
  ]
}
\`\`\`
## Guidelines
- **Clarity:** Each subtask should have ONE clear objective
- **Granularity:** Aim for 10-30 minute subtasks
- **Dependencies:** Only add if truly required (prefer autonomy)
- **Grouping:** 2-5 subtasks per group ideal
- **Parallelism:** Maximize when safe (independent work)
## Example
For task "Build Authentication System", good output:
\`\`\`json
{
  "analysis": {
    "summary": "Task requires database, API, and testing layers",
    "subtaskChanges": "Split 'Create user model' into model + migration",
    "groupingRationale": "Database → API → Tests (dependency chain + parallel tests)"
  },
  "subtasks": [
    {"id": "st_1", "title": "Create User model", "description": "...", "dependencies": [], "estimatedDuration": "10min"},
    {"id": "st_2", "title": "Add auth migration", "description": "...", "dependencies": ["st_1"], "estimatedDuration": "5min"},
    {"id": "st_3", "title": "JWT generation util", "description": "...", "dependencies": ["st_2"], "estimatedDuration": "15min"},
    {"id": "st_4", "title": "Login endpoint", "description": "...", "dependencies": ["st_3"], "estimatedDuration": "15min"},
    {"id": "st_5", "title": "Integration tests", "description": "...", "dependencies": [], "estimatedDuration": "20min"}
  ],
  "groups": [
    {"id": "grp_1", "name": "Database Layer", "context": "models/, migrations/", "subtaskIds": ["st_1", "st_2"], "dependencies": [], "canRunInParallel": false},
    {"id": "grp_2", "name": "API Layer", "context": "routes/, auth/", "subtaskIds": ["st_3", "st_4"], "dependencies": ["grp_1"], "canRunInParallel": false},
    {"id": "grp_3", "name": "Testing", "context": "tests/", "subtaskIds": ["st_5"], "dependencies": [], "canRunInParallel": true}
  ],
  "executionStrategy": {
    "type": "mixed",
    "reasoning": "Groups 1&2 sequential (dependencies), Group 3 parallel (independent)"
  },
  "taskToSessionMapping": [
    {"groupId": "grp_1", "subtaskIds": ["st_1", "st_2"], "sessionName": "Database Layer", "order": 1, "parallelGroup": null},
    {"groupId": "grp_2", "subtaskIds": ["st_3", "st_4"], "sessionName": "API Layer", "order": 2, "parallelGroup": null},
    {"groupId": "grp_3", "subtaskIds": ["st_5"], "sessionName": "Testing", "order": 2, "parallelGroup": 1}
  ]
}
\`\`\`
**Begin analysis now. Output ONLY the JSON, nothing else.**
`;
}
6.3 Claude Code Non-Interactive Execution
Key Insight: Instead of calling Claude API, we run Claude Code itself as a subprocess, pass it the planning prompt, and capture the JSON output.

Why Claude Code instead of API?

✅ Already has project context (runs in folder)
✅ Can analyze actual codebase structure
✅ Consistent with worker sessions (same Claude Code binary)
✅ No API key management needed
✅ Offline capable
Implementation:

class ClaudeCodeOrchestrator {
  
  async generateExecutionPlan(task: Task, project: Project): Promise<ParsedPlan> {
    // 1. Build prompt
    const prompt = buildOrchestratorPrompt(task, project);
    
    // 2. Run Claude Code non-interactively
    const jsonOutput = await this.runClaudeCodeNonInteractive(
      project.basePath,
      prompt
    );
    
    // 3. Parse JSON output
    const parsed = this.parseJSON(jsonOutput);
    
    // 4. Validate
    this.validatePlan(parsed);
    
    return parsed;
  }
  
  async runClaudeCodeNonInteractive(
    cwd: string, 
    prompt: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      
      // Spawn Claude Code process
      const process = spawn('claude', ['--non-interactive'], {
        cwd,
        env: {
          ...process.env,
          CLAUDE_PROMPT: prompt,
          CLAUDE_OUTPUT_FORMAT: 'json',
          // Tell Claude to output only JSON, no explanations
          CLAUDE_MODE: 'structured_output'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      // Write prompt to stdin
      process.stdin.write(prompt);
      process.stdin.end();
      
      // Capture output
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude Code exited with code ${code}\n${stderr}`));
        } else {
          resolve(stdout);
        }
      });
      
      // Timeout after 2 minutes
      setTimeout(() => {
        process.kill();
        reject(new Error('Claude Code orchestrator timeout'));
      }, 120000);
    });
  }
  
  parseJSON(output: string): ParsedPlan {
    // Claude Code might include explanatory text
    // Extract JSON from output
    
    // Try to find JSON block
    const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/) ||
                     output.match(/```\n([\s\S]*?)\n```/) ||
                     output.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error(`No JSON found in Claude Code output:\n${output.substring(0, 500)}`);
    }
    
    const jsonString = jsonMatch[1] || jsonMatch[0];
    
    try {
      return JSON.parse(jsonString) as ParsedPlan;
    } catch (err) {
      throw new Error(`Failed to parse JSON: ${err.message}\n\nOutput: ${jsonString.substring(0, 500)}`);
    }
  }
  
  validatePlan(plan: ParsedPlan): void {
    // Same validation as before
    if (!plan.subtasks || !Array.isArray(plan.subtasks)) {
      throw new Error('Plan must include subtasks array');
    }
    
    if (!plan.groups || !Array.isArray(plan.groups)) {
      throw new Error('Plan must include groups array');
    }
    
    if (!plan.taskToSessionMapping) {
      throw new Error('Plan must include taskToSessionMapping');
    }
    
    // Validate subtask IDs are unique
    const subtaskIds = new Set(plan.subtasks.map(st => st.id));
    if (subtaskIds.size !== plan.subtasks.length) {
      throw new Error('Duplicate subtask IDs found');
    }
    
    // Validate group references
    for (const group of plan.groups) {
      for (const stId of group.subtaskIds) {
        if (!subtaskIds.has(stId)) {
          throw new Error(`Group ${group.id} references unknown subtask ${stId}`);
        }
      }
    }
  }
}
Alternative: Using Tauri Command

If running from Tauri app:

// src-tauri/src/commands/orchestrator.rs
#[tauri::command]
pub async fn run_claude_orchestrator(
    cwd: String,
    prompt: String
) -> Result<String, String> {
    use std::process::Command;
    
    let output = Command::new("claude")
        .arg("--non-interactive")
        .current_dir(&cwd)
        .env("CLAUDE_PROMPT", &prompt)
        .env("CLAUDE_OUTPUT_FORMAT", "json")
        .output()
        .map_err(|e| format!("Failed to spawn Claude: {}", e))?;
    
    if !output.status.success() {
        return Err(format!(
            "Claude exited with code {:?}\nStderr: {}", 
            output.status.code(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout)
}
Then from TypeScript:

import { invoke } from '@tauri-apps/api/tauri';
async function runClaudeOrchestrator(
  cwd: string,
  prompt: string
): Promise<string> {
  return await invoke('run_claude_orchestrator', { cwd, prompt });
}
Handling Claude Code Output:

Claude Code output might include:

Analyzing task "Build Authentication System"...
I'll create an execution plan with database, API, and testing groups.
```json
{
  "analysis": { ... },
  "subtasks": [ ... ],
  "groups": [ ... ],
  "executionStrategy": { ... },
  "taskToSessionMapping": [ ... ]
}
The plan groups related work for efficient execution.

**Parser needs to extract the JSON:**
- Look for ```json code blocks
- Or find first `{` to last `}` with balanced braces
- Parse and validate
**Success Criteria:**
- ✅ Claude Code runs in project folder
- ✅ Has access to actual files (can analyze codebase)
- ✅ Returns valid JSON
- ✅ Completes within timeout (2 min)
#### 6.4 From JSON Output to Task Updates and Worker Prompts
**Complete Flow:**
┌────────────────────────────────────────────────────┐ │ STEP 1: Run Claude Code Orchestrator │ └────────────────────────────────────────────────────┘ ↓ const jsonOutput = await runClaudeCodeNonInteractive( project.basePath, orchestratorPrompt ) ↓ ┌────────────────────────────────────────────────────┐ │ STEP 2: Parse JSON into Objects │ └────────────────────────────────────────────────────┘ ↓ const plan: ParsedPlan = JSON.parse(extractJSON(jsonOutput)) ↓ Objects created:

plan.subtasks: Subtask[]
plan.groups: ExecutionGroup[]
plan.taskToSessionMapping: TaskToSessionMapping[] ↓ ┌────────────────────────────────────────────────────┐ │ STEP 3: Update Tasks in Maestro Backend │ └────────────────────────────────────────────────────┘ ↓ PATCH /api/tasks/${taskId} { subtasks: plan.subtasks (created/updated) }
POST /api/tasks/${taskId}/execution-plan { groups: plan.groups, strategy: plan.executionStrategy.type, taskToSessionMapping: plan.taskToSessionMapping } ↓ ┌────────────────────────────────────────────────────┐ │ STEP 4: Generate Worker Session Prompts │ └────────────────────────────────────────────────────┘ ↓ For each group in plan.groups:

Get subtasks for this group
Build worker prompt with:
Group context
Subtask details
Maestro Worker Skill instructions ↓ ┌────────────────────────────────────────────────────┐ │ STEP 5: Create Worker Sessions with Prompts │ └────────────────────────────────────────────────────┘ ↓ For each group (respecting dependencies): spawnWorkerSession(group, workerPrompt)
**Implementation:**
```typescript
class OrchestratorExecutionFlow {
  
  async executeTaskOrchestration(taskId: string): Promise<void> {
    
    // 1. Fetch task and project
    const task = await fetchTask(taskId);
    const project = await fetchProject(task.projectId);
    
    // 2. Build orchestrator prompt
    const orchestratorPrompt = buildOrchestratorPrompt(task, project);
    
    // 3. Run Claude Code non-interactively
    console.log('🤖 Running Claude Code orchestrator...');
    const jsonOutput = await runClaudeCodeNonInteractive(
      project.basePath,
      orchestratorPrompt
    );
    
    // 4. Parse JSON output
    console.log('📋 Parsing execution plan...');
    const plan = parseJSON(jsonOutput);
    
    // 5. Update tasks with new/refined subtasks
    console.log('💾 Updating tasks...');
    await updateTasksFromPlan(taskId, plan);
    
    // 6. Generate worker prompts for each group
    console.log('📝 Generating worker prompts...');
    const workerPrompts = generateWorkerPrompts(plan, task, project);
    
    // 7. Create worker sessions
    console.log('🚀 Spawning worker sessions...');
    await createWorkerSessions(taskId, plan, workerPrompts);
    
    console.log('✅ Orchestration complete!');
  }
  
  async updateTasksFromPlan(taskId: string, plan: ParsedPlan): Promise<void> {
    
    // Update subtasks
    await fetch(`${MAESTRO_API}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subtasks: plan.subtasks.map(st => ({
          id: st.id,
          title: st.title,
          description: st.description,
          dependencies: st.dependencies,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null
        }))
      })
    });
    
    // Create execution plan
    const executionPlan = {
      id: `plan_${Date.now()}`,
      taskId,
      createdBy: 'orchestrator',
      createdAt: Date.now(),
      groups: plan.groups,
      executionStrategy: plan.executionStrategy.type,
      status: 'planned',
      taskToSessionMapping: plan.taskToSessionMapping
    };
    
    await fetch(`${MAESTRO_API}/tasks/${taskId}/execution-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(executionPlan)
    });
  }
  
  generateWorkerPrompts(
    plan: ParsedPlan,
    task: Task,
    project: Project
  ): Map<string, string> {
    
    const prompts = new Map<string, string>();
    
    for (const group of plan.groups) {
      // Get subtasks for this group
      const groupSubtasks = plan.subtasks.filter(st => 
        group.subtaskIds.includes(st.id)
      );
      
      // Build worker prompt
      const workerPrompt = `
# Maestro Worker: ${group.name}
You are executing a group of subtasks for the task "${task.title}".
## Group Context
**Group:** ${group.name}
**Context:** ${group.context}
**Subtasks in this group:** ${groupSubtasks.length}
## Subtasks to Execute
${groupSubtasks.map((st, idx) => `
${idx + 1}. **${st.title}** (ID: ${st.id})
   - Description: ${st.description}
   - Estimated Duration: ${st.estimatedDuration || 'N/A'}
   ${st.dependencies.length > 0 ? `- Dependencies: ${st.dependencies.join(', ')}` : ''}
`).join('\n')}
## Your Task
Execute these subtasks **in order**. For each subtask:
1. Start: \`maestro subtask-start <subtask_id>\`
2. Do the work (implement, test, etc.)
3. Complete: \`maestro subtask-complete <subtask_id>\`
4. Update: \`maestro update "<brief summary of what you did>"\`
If you encounter a blocker: \`maestro blocked "<reason>"\`
## Maestro Worker Skill Commands
Available commands:
- \`maestro subtask-start <id>\` - Mark subtask as in progress
- \`maestro subtask-complete <id>\` - Mark subtask as complete
- \`maestro update "<message>"\` - Add progress update
- \`maestro blocked "<reason>"\` - Mark subtask as blocked
- \`maestro status\` - Show current status
## Project Context
- **Working Directory:** ${project.basePath}
- **Relevant Files:** ${group.context}
## Begin Execution
Start with the first subtask: ${groupSubtasks[0].title}
Use \`maestro subtask-start ${groupSubtasks[0].id}\` to begin.
`;
      
      prompts.set(group.id, workerPrompt);
    }
    
    return prompts;
  }
  
  async createWorkerSessions(
    taskId: string,
    plan: ParsedPlan,
    workerPrompts: Map<string, string>
  ): Promise<void> {
    
    // Get execution order from taskToSessionMapping
    const mappings = plan.taskToSessionMapping.sort((a, b) => a.order - b.order);
    
    // Group by parallel groups
    const parallelGroups = new Map<number, TaskToSessionMapping[]>();
    const sequentialMappings: TaskToSessionMapping[] = [];
    
    for (const mapping of mappings) {
      if (mapping.parallelGroup !== null) {
        if (!parallelGroups.has(mapping.parallelGroup)) {
          parallelGroups.set(mapping.parallelGroup, []);
        }
        parallelGroups.get(mapping.parallelGroup)!.push(mapping);
      } else {
        sequentialMappings.push(mapping);
      }
    }
    
    // Execute sequential groups
    for (const mapping of sequentialMappings) {
      await this.spawnWorkerSession(
        taskId,
        mapping.groupId,
        workerPrompts.get(mapping.groupId)!
      );
      
      // Wait for completion
      await this.waitForGroupCompletion(taskId, mapping.groupId);
    }
    
    // Execute parallel groups
    for (const [parallelId, groupMappings] of parallelGroups) {
      const sessionPromises = groupMappings.map(mapping =>
        this.spawnWorkerSession(
          taskId,
          mapping.groupId,
          workerPrompts.get(mapping.groupId)!
        )
      );
      
      await Promise.all(sessionPromises);
      
      // Wait for all in parallel group to complete
      await Promise.all(
        groupMappings.map(m => 
          this.waitForGroupCompletion(taskId, m.groupId)
        )
      );
    }
  }
  
  async spawnWorkerSession(
    taskId: string,
    groupId: string,
    initialPrompt: string
  ): Promise<string> {
    
    const sessionId = `sess_${taskId}_${groupId}_${Date.now()}`;
    
    // Get group details
    const plan = await getExecutionPlan(taskId);
    const group = plan.groups.find(g => g.id === groupId);
    
    if (!group) throw new Error(`Group ${groupId} not found`);
    
    // Spawn terminal with Maestro Worker Skill
    await invoke('spawn_session', {
      id: sessionId,
      name: group.name,
      command: 'claude', // Claude Code
      args: ['--session'], // Interactive mode for worker
      cwd: await getProjectBasePath(taskId),
      envVars: {
        MAESTRO_TASK_ID: taskId,
        MAESTRO_GROUP_ID: groupId,
        MAESTRO_SESSION_ID: sessionId,
        MAESTRO_SUBTASK_IDS: group.subtaskIds.join(','),
        PATH: `${MAESTRO_SKILL_PATH}:${process.env.PATH}`
      }
    });
    
    // Send initial prompt to terminal
    await sendToTerminal(sessionId, initialPrompt);
    
    // Update session registry
    await updateSessionMapping(taskId, groupId, {
      sessionId,
      status: 'running',
      startedAt: Date.now()
    });
    
    return sessionId;
  }
  
  async waitForGroupCompletion(taskId: string, groupId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const mapping = await getSessionMapping(taskId, groupId);
        
        if (mapping.status === 'completed') {
          clearInterval(checkInterval);
          resolve();
        } else if (mapping.status === 'failed') {
          clearInterval(checkInterval);
          throw new Error(`Group ${groupId} failed`);
        }
      }, 1000);
    });
  }
}
type ParsedPlan = {
  analysis: {
    summary: string;
    subtaskChanges: string;
    groupingRationale: string;
  };
  subtasks: Subtask[];
  groups: ExecutionGroup[];
  executionStrategy: {
    type: 'sequential' | 'parallel' | 'mixed';
    reasoning: string;
  };
  taskToSessionMapping: TaskToSessionMapping[];
};
type TaskToSessionMapping = {
  groupId: string;
  subtaskIds: string[];
  sessionName: string;
  order: number;
  parallelGroup: number | null;
};
Key Points:

✅ Claude Code runs in project folder - has access to actual code
✅ JSON output parsed into objects - subtasks, groups, mappings
✅ Tasks updated with new/refined subtasks
✅ Worker prompts generated from parsed objects
✅ Sessions created with Maestro Worker Skill + prompts
✅ Execution order respected - sequential vs parallel based on plan
7. Intelligent Session Management (Advanced)
This section covers context-aware session reuse - using knowledge about running sessions and task relationships to optimize execution.

7.1 The Problem: Context Waste
Current approach (naive):

Task 1: "Add login endpoint" → Spawns Session A
Task 2: "Add logout endpoint" → Spawns Session B
Problem: Both work on auth/ folder, but Session B starts fresh
- Session B re-reads files Session A already loaded
- Session B doesn't benefit from Session A's context
- Inefficient, slower
Intelligent approach:

Task 1: "Add login endpoint" → Spawns Session A
Task 2: "Add logout endpoint" → Reuses Session A
Benefits: Session A already has auth/ context loaded
- No re-reading files
- Continuity in implementation style
- Faster, more consistent
7.2 Session Context Tracking
What to track about each session:

type SessionContext = {
  sessionId: string;
  projectId: string;
  taskIds: string[];  // Tasks this session has worked on
  
  // Context fingerprint
  context: {
    filesAccessed: Set<string>;      // Files read/edited
    directories: Set<string>;         // Directories explored
    components: Set<string>;          // Components touched
    technologies: Set<string>;        // Tech stack used
    codebaseKnowledge: string[];      // What Claude learned
  };
  
  // State
  status: 'idle' | 'busy' | 'closed';
  lastActivity: number;
  createdAt: number;
  
  // Capability
  canAcceptNewWork: boolean;
  currentTaskLoad: number;  // How many tasks queued
};
7.3 Session Matching Algorithm
When a new task group needs execution, find the best session:

class IntelligentSessionManager {
  
  async findBestSessionForGroup(
    group: ExecutionGroup,
    taskId: string
  ): Promise<string | null> {
    
    // Get all active sessions for this project
    const activeSessions = await this.getActiveSessions(
      await getProjectId(taskId)
    );
    
    if (activeSessions.length === 0) {
      return null; // No sessions available, spawn new one
    }
    
    // Score each session
    const scoredSessions = activeSessions.map(session => ({
      session,
      score: this.calculateContextMatch(session, group)
    }));
    
    // Sort by score (highest first)
    scoredSessions.sort((a, b) => b.score - a.score);
    
    const best = scoredSessions[0];
    
    // Only reuse if score is high enough
    const REUSE_THRESHOLD = 0.6; // 60% match required
    
    if (best.score >= REUSE_THRESHOLD) {
      return best.session.sessionId;
    }
    
    return null; // No good match, spawn new session
  }
  
  calculateContextMatch(
    session: SessionContext,
    group: ExecutionGroup
  ): number {
    let score = 0;
    let maxScore = 0;
    
    // 1. Directory overlap (30% weight)
    const groupDirs = this.extractDirectories(group.context);
    const dirOverlap = this.setIntersection(
      session.context.directories,
      groupDirs
    );
    score += (dirOverlap.size / groupDirs.size) * 0.3;
    maxScore += 0.3;
    
    // 2. File overlap (25% weight)
    const groupFiles = this.extractFiles(group.context);
    const fileOverlap = this.setIntersection(
      session.context.filesAccessed,
      groupFiles
    );
    score += (fileOverlap.size / Math.max(groupFiles.size, 1)) * 0.25;
    maxScore += 0.25;
    
    // 3. Technology overlap (20% weight)
    const groupTech = this.inferTechnologies(group);
    const techOverlap = this.setIntersection(
      session.context.technologies,
      groupTech
    );
    score += (techOverlap.size / Math.max(groupTech.size, 1)) * 0.2;
    maxScore += 0.2;
    
    // 4. Session freshness (15% weight)
    const ageMinutes = (Date.now() - session.lastActivity) / 60000;
    const freshnessScore = Math.max(0, 1 - (ageMinutes / 30)); // Decay over 30 min
    score += freshnessScore * 0.15;
    maxScore += 0.15;
    
    // 5. Current load (10% weight)
    const loadScore = session.currentTaskLoad === 0 ? 1 : 0.5;
    score += loadScore * 0.1;
    maxScore += 0.1;
    
    return score / maxScore; // Normalize to 0-1
  }
}
7.4 Session Reuse Implementation
Updated worker session creation with intelligent reuse:

async function createWorkerSessionIntelligent(
  taskId: string,
  groupId: string,
  workerPrompt: string
): Promise<string> {
  
  const group = await getGroup(taskId, groupId);
  
  // Try to find existing session
  const sessionManager = new IntelligentSessionManager();
  const existingSessionId = await sessionManager.findBestSessionForGroup(
    group,
    taskId
  );
  
  if (existingSessionId) {
    console.log(`♻️ Reusing session ${existingSessionId} for group ${groupId}`);
    
    // Send new prompt to existing session
    await sendToTerminal(existingSessionId, workerPrompt);
    
    // Update session context
    await updateSessionContext(existingSessionId, {
      taskIds: [...(await getSessionTaskIds(existingSessionId)), taskId],
      lastActivity: Date.now(),
      currentTaskLoad: (await getSessionLoad(existingSessionId)) + 1
    });
    
    // Update mapping
    await updateSessionMapping(taskId, groupId, {
      sessionId: existingSessionId,
      status: 'running',
      startedAt: Date.now(),
      reused: true
    });
    
    return existingSessionId;
  }
  
  // No suitable session, spawn new one
  console.log(`🆕 Spawning new session for group ${groupId}`);
  const newSessionId = await spawnWorkerSession(taskId, groupId, workerPrompt);
  
  // Initialize session context
  await initializeSessionContext(newSessionId, group, taskId);
  
  return newSessionId;
}
7.5 Benefits of Intelligent Session Management
⚡ 40-60% faster for related tasks
💾 Reduced memory usage
🎯 Better continuity & context retention
💰 Lower resource usage
class OrchestratorService {
  
  async updateTaskWithPlan(taskId: string, plan: ParsedPlan): Promise<void> {
    
    // 1. Update subtasks
    await fetch(`${MAESTRO_API}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subtasks: plan.subtasks.map(st => ({
          ...st,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
      })
    });
    
    // 2. Create execution plan object
    const executionPlan: ExecutionPlan = {
      id: `plan_${Date.now()}`,
      taskId,
      createdBy: 'orchestrator',
      createdAt: Date.now(),
      groups: plan.groups.map(grp => ({
        ...grp,
        status: 'pending',
        sessionId: null // Will be set when session spawns
      })),
      executionStrategy: plan.executionStrategy.type,
      status: 'planned',
      taskToSessionMapping: plan.taskToSessionMapping
    };
    
    // 3. Save execution plan
    await fetch(`${MAESTRO_API}/tasks/${taskId}/execution-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(executionPlan)
    });
    
    // 4. Broadcast plan created
    this.websocket.broadcast({
      event: 'plan:created',
      data: { taskId, plan: executionPlan }
    });
  }
}
6.5 Task-to-Session Mapping
The Critical Mapping Structure:

This is how we track which subtasks run in which sessions:

type SessionRegistry = {
  taskId: string;
  executionPlan: {
    mappings: Array<{
      groupId: string;
      subtaskIds: string[]; // Subtasks in this group
      sessionId: string | null; // Session ID once spawned
      sessionName: string;
      status: 'queued' | 'running' | 'completed' | 'failed';
      startedAt: number | null;
      completedAt: number | null;
    }>;
  };
};
// Example:
const registry: SessionRegistry = {
  taskId: 'task_auth_001',
  executionPlan: {
    mappings: [
      {
        groupId: 'grp_1',
        subtaskIds: ['st_1', 'st_2'],
        sessionId: null, // Not started yet
        sessionName: 'Database Layer',
        status: 'queued',
        startedAt: null,
        completedAt: null
      },
      {
        groupId: 'grp_2',
        subtaskIds: ['st_3', 'st_4'],
        sessionId: null,
        sessionName: 'API Layer',
        status: 'queued',
        startedAt: null,
        completedAt: null
      },
      {
        groupId: 'grp_3',
        subtaskIds: ['st_5'],
        sessionId: 'sess_xyz_001', // RUNNING
        sessionName: 'Testing',
        status: 'running',
        startedAt: 1706723400000,
        completedAt: null
      }
    ]
  }
};
When session spawns:

async function spawnWorkerSession(groupId: string, taskId: string) {
  const plan = await getExecutionPlan(taskId);
  const mapping = plan.mappings.find(m => m.groupId === groupId);
  
  if (!mapping) throw new Error(`Group ${groupId} not found in plan`);
  
  // Create terminal session
  const sessionId = `sess_${taskId}_${groupId}_${Date.now()}`;
  
  const session = await invoke('spawn_session', {
    id: sessionId,
    command: 'zsh',
    cwd: project.basePath,
    envVars: {
      MAESTRO_TASK_ID: taskId,
      MAESTRO_GROUP_ID: groupId,
      MAESTRO_SESSION_ID: sessionId,
      MAESTRO_SUBTASK_IDS: mapping.subtaskIds.join(',')
    }
  });
  
  // Update mapping with session ID
  await updateSessionMapping(taskId, groupId, {
    sessionId,
    status: 'running',
    startedAt: Date.now()
  });
  
  return session;
}
6.6 Real-Time Status Tracking
UI shows live status using the mapping:

function TaskExecutionView({ taskId }: { taskId: string }) {
  const { registry } = useSessionRegistry(taskId);
  
  return (
    <div className="execution-view">
      <h3>Execution Progress</h3>
      
      {registry.executionPlan.mappings.map(mapping => (
        <SessionCard key={mapping.groupId}>
          <Status status={mapping.status} />
          <h4>{mapping.sessionName}</h4>
          
          <SubtaskList>
            {mapping.subtaskIds.map(stId => {
              const subtask = getSubtask(stId);
              return (
                <SubtaskItem key={stId} subtask={subtask} />
              );
            })}
          </SubtaskList>
          
          {mapping.sessionId && (
            <SessionLink sessionId={mapping.sessionId}>
              View Terminal →
            </SessionLink>
          )}
          
          {mapping.status === 'running' && (
            <LiveProgress sessionId={mapping.sessionId} />
          )}
        </SessionCard>
      ))}
    </div>
  );
}
Key Benefits:

✅ Clear task → session mapping
✅ Know which subtasks run where
✅ Track status of each session
✅ Easy to resume/retry failed sessions
✅ Full audit trail
7. Maestro Worker Skill (Tier 2)
Purpose
The Worker is the execution layer that runs in spawned terminal sessions. Its job:

Execute a group of subtasks
Update progress via skill commands
Report status to Maestro backend
Handle blockers and errors
Worker Skill Responsibilities
The Maestro Worker Skill acts as the bridge between Claude Code execution sessions and the Maestro backend:

Current Skill (From Docs):

maestro update - Add timeline update
maestro complete - Mark task complete
maestro blocked - Mark task blocked
maestro info - Show task info
Enhanced Skill (For Orchestration):

maestro subtask-start <id> - Mark subtask as in_progress
maestro subtask-complete <id> - Mark subtask complete
maestro subtask-blocked <id> "<reason>" - Mark subtask blocked
maestro status - Show all subtask statuses
Skill Installation in Claude Code Session
Method 1: Pre-bundled in Terminal

// When spawning terminal for task execution
const sessionConfig = {
  command: 'zsh',
  cwd: project.basePath,
  envVars: {
    MAESTRO_TASK_ID: task.id,
    MAESTRO_SESSION_ID: sessionId,
    MAESTRO_API_URL: 'http://localhost:3000/api',
    PATH: `/Users/subhang/.agents-ui/maestro-skill/bin:${process.env.PATH}`,
    // Make maestro commands available
  }
};
Method 2: Injected on Session Start

# First command sent to terminal after spawn
export PATH="/Users/subhang/.agents-ui/maestro-skill/bin:$PATH"
maestro info  # Verify skill works
4. Status Tracking & Updates
Dual-Level Status
Task Status:

pending - Not started
in_progress - At least one subtask in progress
completed - All subtasks completed
blocked - At least one subtask blocked
Subtask Status:

pending - Not started
in_progress - Currently being worked on
completed - Finished
blocked - Cannot proceed
Real-Time Updates via Hooks
Enhanced Hook System:

// on-subtask-update.js (NEW HOOK)
async function onSubtaskUpdate(taskId, subtaskId, status, message) {
  const task = await fetch(`${API_URL}/tasks/${taskId}`);
  const taskData = await task.json();
  
  // Update specific subtask
  const updatedSubtasks = taskData.subtasks.map(st => 
    st.id === subtaskId ? { ...st, status, lastUpdate: message } : st
  );
  
  // Update parent task status based on subtasks
  const newTaskStatus = calculateTaskStatus(updatedSubtasks);
  
  await fetch(`${API_URL}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      subtasks: updatedSubtasks,
      status: newTaskStatus,
      timeline: [...taskData.timeline, {
        type: 'subtask_update',
        subtaskId,
        status,
        message,
        timestamp: Date.now()
      }]
    })
  });
}
function calculateTaskStatus(subtasks) {
  if (subtasks.every(st => st.status === 'completed')) return 'completed';
  if (subtasks.some(st => st.status === 'blocked')) return 'blocked';
  if (subtasks.some(st => st.status === 'in_progress')) return 'in_progress';
  return 'pending';
}
WebSocket Updates
UI receives granular updates:

wsClient.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.event) {
    case 'subtask:started':
      updateSubtaskUI(msg.data.subtaskId, 'in_progress');
      break;
      
    case 'subtask:completed':
      updateSubtaskUI(msg.data.subtaskId, 'completed');
      break;
      
    case 'subtask:blocked':
      updateSubtaskUI(msg.data.subtaskId, 'blocked');
      showBlockerNotification(msg.data.reason);
      break;
      
    case 'task:completed':
      showTaskCompleteNotification(msg.data.taskId);
      break;
  }
};
Complete Execution Flow: End-to-End
Step-by-Step Walkthrough
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                     │
└─────────────────────────────────────────────────────────────────┘
User clicks "Run Task" in Maestro UI
    ↓
Task ID: task_auth_001
    Title: "Build Authentication System"
    Subtasks: [Manual] User created 4 subtasks
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: ORCHESTRATOR PHASE                                     │
└─────────────────────────────────────────────────────────────────┘
Step 1: Agents UI spawns orchestrator terminal
    ↓
Terminal Config:
  - Command: Claude Code
  - Skill: Maestro Orchestrator
  - Env vars: MAESTRO_TASK_ID=task_auth_001
  - Initial Prompt: "You are Maestro Orchestrator..."
    ↓
Step 2: Claude (Orchestrator) analyzes task
    ↓
    Reads existing subtasks:
    1. "Create user model"
    2. "Implement JWT generation"
    3. "Build login endpoint"
    4. "Write tests"
    ↓
Step 3: Orchestrator refines plan
    ↓
    Claude decides:
    - "Create user model" needs split into 2 subtasks
    - Creates new subtask: "Add database migration"
    - Total: 5 subtasks now
    ↓
Step 4: Orchestrator groups subtasks
    ↓
    Groups created:
    
    Group 1: "Database Layer" (Sequential)
      - Create user model
      - Add database migration
      Context: models/, migrations/, database config
      
    Group 2: "API Layer" (Sequential, depends on Group 1)
      - Implement JWT generation
      - Build login endpoint
      Context: routes/, controllers/, auth middleware
      
    Group 3: "Testing" (Parallel, independent)
      - Write tests
      Context: tests/, mocks/
    ↓
Step 5: Orchestrator saves plan
    ↓
    POST /api/tasks/task_auth_001/execution-plan
    {
      groups: [Group 1, Group 2, Group 3],
      strategy: "mixed" // Group 1,2 sequential; Group 3 parallel
    }
    ↓
Step 6: Orchestrator terminal closes
    ↓
    WebSocket broadcasts: "plan:created"
┌─────────────────────────────────────────────────────────────────┐
│ TIER 2: WORKER PHASE (Execution)                               │
└─────────────────────────────────────────────────────────────────┘
Step 7: Agents UI processes execution plan
    ↓
    Sees: Group 1 and 2 sequential, Group 3 parallel
    ↓
    Decision: 
    - Start Group 1 first (database)
    - Wait for Group 1 completion
    - Then start Group 2 (API) AND Group 3 (tests) in parallel
    ↓
Step 8: Spawn Terminal 1 for Group 1
    ↓
Terminal 1 Config:
  - Skill: Maestro Worker
  - Env vars: 
      MAESTRO_TASK_ID=task_auth_001
      MAESTRO_GROUP_ID=group_1
  - Initial Prompt:
      "Execute these subtasks in order:
       1. Create user model
       2. Add database migration
       Context: models/, migrations/"
    ↓
Step 9: Claude (Worker 1) executes Group 1
    ↓
    T+0min: maestro subtask-start create_user_model
    T+5min: Creates User.ts model
    T+6min: maestro subtask-complete create_user_model
    T+6min: maestro update "User model created with auth fields"
    
    T+7min: maestro subtask-start add_migration
    T+10min: Creates migration file
    T+11min: maestro subtask-complete add_migration
    T+11min: maestro update "Migration created and tested"
    
    T+12min: All Group 1 subtasks complete
    T+12min: Terminal 1 closes
    ↓
Step 10: WebSocket broadcasts "group:completed" (Group 1)
    ↓
Step 11: Agents UI sees Group 1 done, starts Group 2 & 3
    ↓
    Spawn Terminal 2 (Group 2: API Layer)
    Spawn Terminal 3 (Group 3: Testing)
    
    Both run IN PARALLEL
    ↓
Step 12: Claude (Worker 2) executes Group 2
    ↓
    T+13min: maestro subtask-start jwt_generation
    T+18min: maestro subtask-complete jwt_generation
    
    T+19min: maestro subtask-start login_endpoint
    T+25min: maestro subtask-complete login_endpoint
    
    T+26min: Terminal 2 closes
    ↓
Step 13: Claude (Worker 3) executes Group 3 (parallel)
    ↓
    T+13min: maestro subtask-start write_tests
    T+20min: maestro subtask-complete write_tests
    
    T+21min: Terminal 3 closes
    ↓
Step 14: All groups complete
    ↓
    System checks: All 5 subtasks completed
    ↓
    PATCH /api/tasks/task_auth_001
    { status: 'completed', completedAt: now() }
    ↓
Step 15: WebSocket broadcasts "task:completed"
    ↓
Step 16: UI shows completion notification
    ↓
    "✅ Task 'Build Authentication System' completed!
     5 subtasks done in 21 minutes across 3 sessions."
┌─────────────────────────────────────────────────────────────────┐
│ ERROR SCENARIO: Subtask Blocked                                │
└─────────────────────────────────────────────────────────────────┘
Alternative at T+15min in Terminal 2:
    ↓
    Claude discovers issue:
    "Can't implement JWT - crypto library missing"
    ↓
    maestro blocked "Need to install jsonwebtoken package"
    ↓
    Terminal 2 pauses execution
    ↓
    WebSocket broadcasts "subtask:blocked"
    ↓
    UI shows notification:
    "🚫 Subtask blocked: jwt_generation
     Reason: Need to install jsonwebtoken package"
    ↓
    UI shows options:
    [Resolve & Resume] [Skip Subtask] [Abort Task]
    ↓
    User clicks "Resolve & Resume"
    ↓
    User installs package manually
    ↓
    User clicks "Resume"
    ↓
    System sends to Terminal 2: Continue execution
    ↓
    Claude retries subtask
Timing Breakdown
Total Time: ~21 minutes

Phase	Duration	Activity
Orchestrator	2 min	Analyze, refine, group subtasks
Group 1 (Sequential)	12 min	Database layer setup
Group 2 (Sequential)	13 min	API implementation (waits for Group 1)
Group 3 (Parallel)	8 min	Testing (runs alongside Group 2)
Time Saved by Parallelism:

If all sequential: 2 + 12 + 13 + 8 = 35 minutes
With smart grouping: 2 + 12 + max(13, 8) = 27 minutes
Savings: 8 minutes (23% faster)
Implementation Plan
Phase 1: Data Model Extensions (Week 1)
1.1 Add Execution Plan to Data Model

Add Subtasks to Task Model:

type Task = {
  // ... existing fields
  subtasks: Subtask[];
};
type Subtask = {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  lastUpdate?: string;
};
API Endpoints:

POST /api/tasks/:taskId/subtasks - Create subtask
PATCH /api/tasks/:taskId/subtasks/:subtaskId - Update subtask
GET /api/tasks/:taskId/subtasks - List subtasks
Phase 2: Context Orchestrator
Create TaskOrchestrator Service:

class TaskOrchestrator {
  /**
   * Build comprehensive context for Claude Code execution
   */
  async buildTaskContext(taskId: string): Promise<TaskContext> {
    const task = await this.getTask(taskId);
    const project = await this.getProject(task.projectId);
    const subtasks = task.subtasks.filter(st => st.status !== 'completed');
    
    return {
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        initialPrompt: task.initialPrompt
      },
      subtasks,
      project: {
        id: project.id,
        name: project.title,
        basePath: project.basePath,
        relevantFiles: await this.scanRelevantFiles(project.basePath)
      },
      maestroInstructions: this.getMaestroInstructions()
    };
  }
  
  /**
   * Generate initial prompt for Claude Code
   */
  generateInitialPrompt(context: TaskContext): string {
    return this.renderTemplate('task-execution-prompt.md', context);
  }
  
  /**
   * Spawn Claude Code session with context
   */
  async runTask(taskId: string): Promise<SessionInfo> {
    const context = await this.buildTaskContext(taskId);
    const prompt = this.generateInitialPrompt(context);
    
    // Create terminal session
    const session = await this.spawnClaudeSession({
      taskId,
      cwd: context.project.basePath,
      initialPrompt: prompt
    });
    
    return session;
  }
}
Phase 3: Enhanced Maestro Worker Skill
New Subtask Commands:

#!/usr/bin/env node
// commands/subtask.js
async function subtaskCommand(action, subtaskId, ...args) {
  const taskId = process.env.MAESTRO_TASK_ID;
  const sessionId = process.env.CLAUDE_SESSION_ID;
  
  switch (action) {
    case 'start':
      await fetch(`${API_URL}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' })
      });
      console.log(`✅ Started subtask: ${subtaskId}`);
      break;
      
    case 'complete':
      await fetch(`${API_URL}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status: 'completed',
          completedAt: Date.now()
        })
      });
      console.log(`✅ Completed subtask: ${subtaskId}`);
      break;
      
    case 'blocked':
      const reason = args.join(' ');
      await fetch(`${API_URL}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status: 'blocked',
          lastUpdate: reason
        })
      });
      console.log(`🚫 Blocked subtask ${subtaskId}: ${reason}`);
      break;
  }
}
Usage in Claude Session:

# Claude starts working
maestro subtask-start subtask_001
# After completion
maestro subtask-complete subtask_001
maestro update "Login endpoint implemented"
# Move to next subtask
maestro subtask-start subtask_002
Phase 4: UI Enhancements
Task Detail View with Subtasks:

function TaskDetailView({ task }: { task: Task }) {
  return (
    <div className="task-detail">
      <TaskHeader task={task} />
      
      <SubtaskList>
        {task.subtasks.map(subtask => (
          <SubtaskCard 
            key={subtask.id}
            subtask={subtask}
            onStatusChange={(status) => updateSubtask(subtask.id, status)}
          />
        ))}
      </SubtaskList>
      
      <Actions>
        {task.subtasks.length > 0 ? (
          <Button onClick={() => runTask(task.id)}>
            🚀 Run Task (Automated)
          </Button>
        ) : (
          <Button onClick={() => showAddSubtasksDialog()}>
            ➕ Add Subtasks First
          </Button>
        )}
      </Actions>
    </div>
  );
}
Real-Time Subtask Progress:

function SubtaskCard({ subtask }: { subtask: Subtask }) {
  const statusIcon = {
    pending: '⏳',
    in_progress: '⚡',
    completed: '✅',
    blocked: '🚫'
  }[subtask.status];
  
  return (
    <div className={`subtask subtask-${subtask.status}`}>
      <span className="status-icon">{statusIcon}</span>
      <div className="content">
        <h4>{subtask.title}</h4>
        <p>{subtask.description}</p>
        {subtask.lastUpdate && (
          <div className="update">{subtask.lastUpdate}</div>
        )}
      </div>
    </div>
  );
}
Key Benefits
1. Automation
User clicks "Run Task" and Claude executes autonomously
No manual prompting or guidance needed
Reduces user cognitive load
2. Granular Tracking
Individual subtask status visible in real-time
Know exactly what's being worked on
Identify blockers immediately
3. Context Optimization
Only subtasks provided (not parent context)
Reduces confusion and hallucination
Improves accuracy
4. Self-Documenting
Timeline shows subtask progression
Clear audit trail of what was done
Easy to resume if interrupted
5. Scalability
Can run multiple tasks in parallel (different terminals)
Each has isolated context
Status tracked independently
Potential Challenges & Solutions
Challenge 1: Claude Doesn't Follow Instructions
Risk: Claude ignores subtask structure, does unexpected work

Solutions:

Clear prompt engineering: Emphasize subtask-only focus
Validation hooks: Check if Claude is working on correct subtask
Early termination: Stop session if Claude goes off-track
Challenge 2: Subtask Dependency Management
Risk: Subtasks have dependencies, Claude tries to do them out of order

Solutions:

Explicit ordering: Prompt clearly states "do in order"
Dependency checking: Skill commands validate dependencies met
UI guidance: Show dependency graph to user
Challenge 3: Session Management Overhead
Risk: Creating/managing Claude sessions is complex

Solutions:

Abstract terminal spawning: Reuse Agents UI's existing terminal system
Session pooling: Reuse terminals for sequential tasks
Graceful failures: If session crashes, save progress
Challenge 4: Prompt Injection/Size Limits
Risk: Initial prompt becomes too large with all context

Solutions:

Keep subtasks concise: Max 5-7 subtasks per task
Summary mode: For large tasks, provide high-level summary
Chunking: Break mega-tasks into multiple smaller tasks
Comparison to Alternatives
Alternative 1: Manual Execution (Current State)
Pros:

User maintains full control
Flexible, adaptable to unexpected scenarios
Cons:

Requires active user involvement
Time-consuming
Less consistent tracking
Alternative 2: Fully Autonomous Agent (No Subtasks)
Pros:

Simplest for user (just click "Run")
Cons:

Claude might go off-track without subtask constraints
Hard to track progress
Difficult to resume if interrupted
Alternative 3: Semi-Autonomous (Prompt per Subtask)
Pros:

User approves each subtask before execution
More control than fully automated
Cons:

Still requires user supervision
Slower than fully automated
✅ Proposed Approach (Automated + Subtask Granularity)
Pros:

Best balance of automation and structure
Granular tracking without manual intervention
Resumable, auditable, scalable
Cons:

Requires upfront subtask definition
More complex implementation
Next Steps for Discussion
Answers to Key Design Questions
1. Subtask Creation:

✅ Both manual and AI auto-generation
Users can manually define subtasks
Maestro Orchestrator can also create/refine subtasks using AI
Best of both worlds: user control + AI assistance
2. Error Handling:

✅ Ask user when subtask fails
System pauses execution
Notifies user via UI
User can:
Retry the subtask
Skip and continue
Abort entire task
No auto-retry to prevent infinite loops
3. Session Lifecycle:

✅ Multiple sessions based on orchestrator grouping
Orchestrator groups subtasks by context similarity
Each group runs in its own terminal session
Example: If orchestrator creates 3 groups → 3 terminal sessions
Sessions can run in parallel if groups are independent
4. Parallel vs Sequential:

✅ Determined by orchestrator
Orchestrator analyzes dependencies
Independent groups → parallel execution
Dependent groups → sequential execution
User can override in advanced settings
5. Human Oversight:

✅ Trust Claude's judgment, with monitoring
Fully autonomous execution
User monitors via real-time UI updates
User can intervene if needed (pause, modify, cancel)
Notifications for blockers and completions
Conclusion
The proposed Maestro Worker Skill orchestration approach represents a significant evolution of the current integration:

From manual to automated: Tasks run autonomously
From task-level to subtask-level: Granular tracking
From reactive to proactive: System builds context automatically
From user-driven to AI-driven: Claude manages its own workflow
Core Philosophy:

"The orchestrator engineers the context. The skill provides the tools. Claude does the work. The UI shows the progress."

This approach leverages the strengths of each component:

Agents UI: Terminal management, project context
Maestro: Task tracking, status management
Maestro Worker Skill: Status updates, progress reporting
Claude Code: Autonomous task execution
Hooks: Automatic activity tracking
Recommendation: Proceed with implementation in phases, starting with data model extensions and context orchestrator, then gradually adding automation features while preserving the option for manual executio