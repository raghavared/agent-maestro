# Example Flow: Refactoring the Auth Component

This document illustrates a complete end-to-end scenario to demonstrate how Maestro's components (Skills, Hooks, CLI, Agents) work together in a real-world task.

## Scenario
**User Request**: "Refactor the `Login.tsx` component to use the new `useAuth` hook instead of Redux."

## 1. Trigger & Orchestration (Tier 1)

1.  **User** types the request in Agent Maestro.
2.  **Maestro Server** creates `Task #101`: "Refactor Login.tsx".
3.  **Server** calls `maestro-orchestrator`.
4.  **Orchestrator Agent**:
    - Analyzes `Login.tsx` and `useAuth.ts`.
    - Creates a Plan:
        - Subtask A: "Update imports in Login.tsx"
        - Subtask B: "Replace Redux `connect` with `useAuth`"
        - Subtask C: "Fix type errors"
    - Calls: `maestro-orchestrator plan --json "{...}"`
5.  **Server** saves subtasks.

## 2. Session Initialization & Hook Injection

Maestro Server prepares to run **Subtask Group: "Login Component Refactor"**.

1.  **Hook Evaluation**:
    - System checks `maestro.config.json`.
    - Matches `file_pattern: "**/*.tsx"`.
    - **Hook Triggered**: "Frontend Expert".
2.  **Session Spawning**:
    - Server instructs UI to spawn a terminal.
    - **Injected Env**:
        - `MAESTRO_TASK_ID="task_group_101"`
        - `MAESTRO_AGENT_PROFILE="frontend-dev"`
    - **Injected Skills**:
        - `maestro-worker` (Default)
        - `browser-preview` (From Hook)
        - `css-linter` (From Hook)
    - **Injected System Prompt**: "You are a Frontend Expert..."

## 3. The Worker Loop (Tier 2) - Minute-by-Minute

Now we are inside the terminal session.

### Minute 0: Start
- **Agent**: Starts up. Reads system prompt.
- **Agent Action**: Calls tool `get_task_info`.
- **Worker Skill**: Runs `maestro task get`.
- **Output**:
    ```json
    {
      "subtasks": [
        {"id": "st_a", "title": "Update imports", "status": "pending"},
        {"id": "st_b", "title": "Replace Redux", "status": "pending"}
      ]
    }
    ```

### Minute 1: Execution
- **Agent Thought**: "I need to read the file first."
- **Agent Action**: `read_file("src/components/Login.tsx")`.
- **Agent Action**: `report_progress("Reading Login.tsx to understand current Redux usage")`.
- **Worker Skill**: Runs `maestro update "Reading Login.tsx..."`.
- **UI**: Timelines updates. User sees "Reading Login.tsx...".

### Minute 5: Coding
- **Agent Thought**: "Okay, I will change the imports."
- **Agent Action**: `edit_file("src/components/Login.tsx", ...)`
- **Agent Action**: `mark_subtask_complete("st_a")`.
- **Worker Skill**: Runs `maestro subtask complete st_a`.
- **Server**: Updates DB. Subtask A is checked off ✅.

### Minute 10: Debugging (The Hook in Action)
- **Agent**: Tries to run linter.
- **Agent Action**: `run_command("npm run lint")`.
- **Output**: `Error: 'useAuth' is not defined.`
- **Agent Thought**: "Ah, I missed an import."
- **Agent Action**: `report_progress("Fixing linter error: missing import")`.
- **Agent Action**: `edit_file(...)`.

### Minute 15: Completion
- **Agent Thought**: "All subtasks look good. Linter passes."
- **Agent Action**: `signal_completion()`.
- **Worker Skill**: Runs `maestro complete`.
- **Server**: Marks Task #101 as `COMPLETED`.
- **UI**: Shows green checkmark.

## 4. Post-Task (Optional Review Hook)

1.  **Server Event**: `TASK_COMPLETED`.
2.  **Hook Triggered**: "Code Review Hook" (configured to run on all 'Refactor' tasks).
3.  **Action**: Spawn new session "Review Agent".
4.  **Review Agent**: Checks the diffs. If good, notifies user.

## Summary of Interaction

| Component | Role | Example Action |
| :--- | :--- | :--- |
| **Orchestrator** | Planner | "Split this big task into 3 small ones." |
| **Hook** | Configurator | "This is a React task, so use the Frontend Persona." |
| **Worker Skill** | Messenger | "Tell the server I just finished Subtask A." |
| **CLI** | Carrier | Transmits the message over HTTP/Socket. |
| **Agent** | Executor | Writes the actual code. |
