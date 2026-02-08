# Complete Orchestration Flow

## 1. System Architecture

The Maestro Co-Pilot system consists of three main components:
1.  **Maestro Server**: The brain and database. Stores tasks, projects, and logs.
2.  **Agents UI**: The frontend. Manages terminal emulators (PTY) and displays the UI.
3.  **Maestro CLI + Worker Skill**: The "agent-side" tooling running inside the terminal.

## 2. The Orchestration Lifecycle

### Phase 1: Initialization & Planning
1.  **User Trigger**: User selects a project and enters a request: "Refactor the Auth component."
2.  **Task Creation**: A root `Task` is created in DB (status: `PENDING`).
3.  **Orchestrator Spawn**: 
    - Server instructs UI to spawn a hidden session.
    - Session runs `maestro-orchestrator plan --task-id <id>`.
4.  **Plan Generation**: 
    - Orchestrator analyzes code.
    - Generates JSON plan with subtasks.
    - Updates Task DB with new subtasks tree.

### Phase 2: Execution (The Worker Loop)
1.  **Subtask Assignment**: 
    - Server identifies ready subtasks (leaf nodes, no blockers).
    - Groups them logically (e.g., "Database Migration Group").
2.  **Session Spawning**:
    - Server instructs UI to create a new PTY Session.
    - **Crucial Step**: Injecting the Environment.

#### Environment Injection
When the terminal starts, the following variables are EXPORTED before the shell is ready:
```bash
export MAESTRO_SERVER_URL="http://localhost:3000"
export MAESTRO_TASK_ID="task_group_123"
export MAESTRO_SESSION_ID="sess_abc_789"
export MAESTRO_PROJECT_ID="proj_xyz"
```

3.  **Skill Injection**:
    - The terminal is configured to load skills from:
        - Global: `~/.maestro/skills/` (contains `maestro-worker`)
        - Project: `./.maestro/skills/`
        - User: `~/.skills/`
    - The LLM (Claude Code) is started with:
    ```bash
    claude --skill-path ~/.maestro/skills/maestro-worker --skill-path ./.skills
    ```

4.  **Agent Loop**:
    - **Agent**: Reads `MAESTRO_TASK_ID`.
    - **Agent**: Calls `maestro task get`.
    - **Agent**: Sees: "Subtask 1: Add column to DB".
    - **Agent**: Writes code.
    - **Agent**: Calls `maestro update "Added column"`.
    - **Agent**: Calls `maestro subtask complete st_1`.
    - **Agent**: Sees: "Subtask 2: Update model".
    - **Agent**: ...repeats...
    - **Agent**: Calls `maestro complete`.

### Phase 3: Completion & Review
1.  **Session End**: When `maestro complete` is called, the session status updates to `COMPLETED`.
2.  **Parent Update**: The parent task listens for children completion.
3.  **Chain Reaction**: Failing of a subtask triggers `BLOCKED` status on parent -> User notified.
4.  **Final State**: Root task marked `COMPLETED`.

## 3. The Many-to-Many Foundation

A core architectural decision is decoupling **Tasks** from **Sessions**.

- **One Task, Multiple Sessions**: A large task (e.g., "Migration") might check out 5 different skilled agents (workers) running in parallel sessions.
- **One Session, Multiple Tasks**: A single worker might be assigned a "Micro-Batch" of 3 small, related subtasks (e.g., "Fix typo in A", "Fix typo in B", "Update readme").

### The Subtasks Array
The orchestration logic groups tasks into **Execution Units**.
An Execution Unit is what gets assigned to a `MAESTRO_TASK_ID` for a session.

**Data Model:**
```typescript
class Session {
  id: string;
  activeTaskId: string; // The ID of the "Group Task" or "Execution Unit"
}

class Task {
  id: string;
  subtasks: Task[]; // Recursive
  assignedSessionId?: string; // If currently running
}
```

## 4. Starting the Terminal (Technical Detail)

The Agent UI uses a PTY manager. When spawning a Maestro Session:

1.  **Prepare Context**: Fetch skills paths, env vars.
2.  **Launch Shell**: `zsh` or `bash`.
3.  **Pre-exec**: Run code to export envars.
4.  **Launch Agent**: Run the `claude` (or other agent) binary interactively.
    - Arguments: `--dangerously-skip-permissions` (optional), `--tool-path ...`.
5.  **Monitor**: Hooks in the terminal stream (or the `maestro` CLI calls) allow the UI to show a progress bar *outside* the terminal text content.

This separation of "Terminal IO" (Human readable) and "Maestro Signals" (Machine readable via CLI) creates a robust system where the UI is always in sync with the Agent's state.
