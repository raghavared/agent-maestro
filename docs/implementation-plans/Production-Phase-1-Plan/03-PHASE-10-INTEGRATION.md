# Phase 10: Integration & Final Polish

The final phase connects the CLI-driven backend to the production-grade UI.

## 1. Real-Time Dashboard
The `MaestroPanel.tsx` will be fully connected to the live backend:
- **API Fetch:** Load real tasks, subtasks, and sessions on mount.
- **WebSocket Listeners:** 
    - `task:created` -> Add to list.
    - `subtask:created` -> Update task subtask list.
    - `task:updated` -> Update status indicators and progress bars.
    - `session:started/ended` -> Update worker status indicators.

## 2. The Orchestration Entry Point
Add a "Launch Orchestrator" button to the Maestro Panel.
- **Action:** Spawns a terminal session specifically powered by the `maestro-orchestrator` skill.
- **Initial Prompt:** "Analyze the current project and the main task. Break it down into subtasks and spawn worker sessions to begin implementation."

## 3. Worker "Mission Control"
Enhance the UI to show:
- Active worker count.
- Live stream of `maestro update` logs from all workers in a unified timeline.
- Visual mapping of which worker is on which subtask.

## 4. End-to-End Validation
- Verify that subtasks created via CLI show up instantly in the UI.
- Verify that `maestro session spawn` successfully triggers the Tauri terminal spawning.
- Verify that a worker completing a task marks it green in the dashboard.
