# Phase 9: CLI-Driven Orchestration

This phase empowers the Orchestrator to drive the system directly through the Maestro CLI, removing the need for complex JSON parsing middleware.

## 1. Maestro Orchestrator Skill (`maestro-orchestrator`)
The "Brain" of the operation.
- **Responsibilities:**
    - High-level project planning.
    - Codebase analysis.
    - Delegation via CLI commands.
- **Instructions:** The agent is instructed to avoid doing the implementation itself and instead use `maestro subtask create` and `maestro session spawn`.

## 2. CLI Spawning Command
A new command is required for the Orchestrator to "pop" new windows:
- **Command:** `maestro session spawn --taskId <id> [--name <name>] [--skill <id>]`
- **Action:** 
    1. POST to `/api/sessions/spawn`.
    2. Server broadcasts `session:spawn_request`.

## 3. The Spawning Bridge (UI)
The Tauri application must be updated to listen for the `session:spawn_request` WebSocket event.
- **Logic:** When received, it invokes the internal `spawn_session` function with the provided task context and environment variables.
- **Result:** A new terminal tab/window opens automatically as the Orchestrator works.

## 4. Dynamic Task Context
The CLI must be able to inject the correct environment variables (like `MAESTRO_TASK_ID`) into the spawned sessions so the Workers know their context immediately.
