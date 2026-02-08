# Phase 8: Maestro Worker & Skill Infrastructure

This phase focuses on the execution layer, ensuring workers have the tools and instructions needed to report progress back to the system.

## 1. Skill System Standardization
We will establish a standardized local directory for skills that the Claude CLI can load.
- **Path:** `~/.agents-ui/maestro-skills/`
- **Structure:**
    ```
    maestro-worker/
    ├── manifest.json
    └── skill.md
    ```

## 2. Maestro Worker Skill (`maestro-worker`)
The core skill for execution agents.
- **Responsibilities:**
    - Perform technical implementation.
    - Use CLI for status reporting.
    - Log "thinking" and "progress" to the timeline.

## 3. CLI Enhancements
To support granular worker reporting, we will add/refine the following:
- **`maestro update "<message>"`**: Adds a timeline event to the current task.
- **`maestro task-start <id>`**: Shortcut for updating status to `in_progress`.
- **`maestro task-complete <id>`**: Shortcut for updating status to `completed`.

## 4. Server-Side Verification
Ensure the `maestro-server` correctly broadcasts `task:updated` and `timeline:added` events via WebSockets so the UI reflects worker activity in real-time.
