# Maestro Worker Skill

## Introduction
The **Maestro Worker Skill** is the default "bridge" skill injected into every Maestro Session. It provides the LLM with high-level tools to interact with the Maestro system, effectively wrapping the `maestro` CLI into semantic function calls.

## Skill Definition
This skill strictly follows the **Open Skills Standard** (or MCP-compatible format). It is located in `.skills/maestro-worker/`.

### skill.json / SKILL.md
```json
{
  "name": "maestro-worker",
  "description": "Tools for reporting progress on Maestro tasks.",
  "commands": [
    {
      "name": "get_task_info",
      "description": "Get details about the current assigned task and subtasks."
    },
    {
      "name": "report_progress",
      "description": "Log a progress update visible to the user.",
      "parameters": {
        "message": "String: What was accomplished"
      }
    },
    {
      "name": "mark_subtask_complete",
      "description": "Mark a specific subtask as done.",
      "parameters": {
        "subtaskId": "String: ID of the subtask"
      }
    },
    {
      "name": "signal_completion",
      "description": "Signal that all assigned work in this session is finished."
    },
    {
      "name": "signal_blocker",
      "description": "Signal that you are blocked and cannot proceed.",
      "parameters": {
        "reason": "String: Why you are blocked"
      }
    }
  ]
}
```

## How It Works in Practice

1.  **Session Start**: When a new terminal starts for a task, the Maestro Agent (Orchestrator) ensures the `maestro-worker` skill is loaded into the context of the Agent (Claude/OpenAI).
2.  **Tool usage**:
    - The Agent thinks: *"I have finished creating the file. I should tell Maestro."*
    - The Agent calls: `report_progress({ message: "Created auth.ts file" })`.
3.  **Execution**:
    - The skill script executes `maestro update "Created auth.ts file"` in the shell.
    - The CLI talks to the Server.
    - The Server updates the UI.

## Integration with Custom Skills
While `maestro-worker` is default, users can add custom skills:
- **Location**: `.skills/` or project-specific `.maestro/skills/`.
- **Loading**: The Maestro infrastructure scans these folders and provides them to the LLM context alongside `maestro-worker`.
- **Use Case**: A user might add a `linear-skill` to allow the agent to update Linear tickets, or a `deployment-skill` to run specialized deploy scripts.

## The Minute-to-Minute Relationship (Real-Time Sync)

The fundamental design philosophy of the Maestro Worker Skill is **high-frequency synchronization**. A session is not a black box that returns a result after 1 hour. It is a live entity that mirrors its state to the Maestro Server minute-by-minute.

### 1. The "Chatty" Protocol
Agents are instructed via the System Prompt to be verbose with the system (not necessarily the user).
*   **Action Start**: "Starting to read file X..." -> `maestro update "Reading file X"`
*   **Action End**: "Finished reading." -> `maestro update` (optional)
*   **Thinking**: "I see an error in line 50..." -> `maestro update "Found bug in line 50, investigating..."`

### 2. The Heartbeat & State Mirroring
The Worker Skill effectively performs a "State Mirroring" loop:
1.  **Read**: Agent calls `get_task_info` -> Gets latest subtask state (maybe Orchestrator added a new one!).
2.  **Act**: Agent performs shell command / file edit.
3.  **Write**: Agent calls `report_progress` -> Pushes state back to Server.

This ensures that if the user pauses the session (or the UI disconnects), the exact state is preserved in the Server's Task DB.

### 3. Session-Task Binding
- **One Session, Dynamic Scope**: A session is bound to a `MAESTRO_TASK_ID`. However, the *contents* of that task (its subtasks) can change in real-time. The Worker Skill allows the agent to adapt to these changes without restarting the session.
- **Interrupts**: If the User or Orchestrator modifies the task (e.g., adds "Also fix the tests"), the next time the agent calls `get_task_info`, it sees the new subtask and adjusts immediately.
