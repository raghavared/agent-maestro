# Maestro Orchestrator Skill (Tier 1)

**Role:** The intelligent planning layer that runs BEFORE execution.

## Responsibilities

1.  **Analyze** the task and codebase.
2.  **Refine** subtask definitions (split/merge/create).
3.  **Group** subtasks by contextual similarity.
4.  **Plan** execution strategy (Sequential vs Parallel).
5.  **Output** strict JSON for system consumption.

---

## Implementation: Claude Code Non-Interactive

We use Claude Code itself as the intelligence engine, running in a non-interactive process to access the local file system directly.

### Execution Flow

```typescript
// 1. Build Prompt
const prompt = buildOrchestratorPrompt(task, project);

// 2. Run Claude Code (Subprocess)
const jsonOutput = await runClaudeCodeNonInteractive(project.basePath, prompt);

// 3. Parse & Validate
const plan = JSON.parse(extractJSON(jsonOutput));

// 4. Update Database
await updateTaskSubtasks(taskId, plan.subtasks);
await saveExecutionPlan(taskId, plan);
```

### The Orchestrator Prompt

**Critical Requirement:** The AI must output **ONLY VALID JSON**.

```markdown
# Maestro Orchestrator: Execution Planning

You are an intelligent task orchestrator. Analyze the following task and create an optimal execution plan.

## Task Details
ID: {{task.id}}
Title: {{task.title}}
Description: {{task.description}}

## Your Job
1. Analyze the task requirements.
2. Review and refine subtasks.
3. Group subtasks by context (e.g., "Database Layer", "UI Components").
4. Decide which groups can run in parallel.

## Output Format (STRICT JSON)
```json
{
  "subtasks": [
    { "id": "st_1", "title": "Create User model", "dependencies": [] }
  ],
  "groups": [
    { 
      "id": "g_1", 
      "name": "Database", 
      "subtaskIds": ["st_1"],
      "canRunInParallel": true
    }
  ],
  "executionStrategy": { "type": "mixed" },
  "taskToSessionMapping": [
    { "groupId": "g_1", "sessionName": "Database Setup", "order": 1 }
  ]
}
```
```

---

## Technical Integration

### Running Claude Code
Instead of the API, we use the binary:

```typescript
const process = spawn('claude', ['--non-interactive'], {
  cwd: project.basePath,
  env: {
    ...process.env,
    CLAUDE_PROMPT: prompt,
    CLAUDE_OUTPUT_FORMAT: 'json',
    CLAUDE_MODE: 'structured_output'
  }
});
```


---

## UI Visibility: Only Planning Phase

Since the Orchestrator analyzes the codebase, the planning phase can take **10-60 seconds**. It is critical to show this state in the UI.

### Visual States

1.  **Planning (Spinner):**
    *   Label: "Maestro is planning execution..."
    *   Detail: "Analyzing codebase & defining subtasks"
    *   Action: "Cancel Planning" button available.

2.  **Plan Review (Optional):**
    *   If configured, show the generated plan for user approval before execution starts.

3.  **Handoff:**
    *   Once planning completes, the UI transitions immediately to "Spawning Workers".

### Implementation
The Agents UI should subscribe to `task:planning_start` and `task:planning_complete` events via WebSocket to manage this specific overlay.
