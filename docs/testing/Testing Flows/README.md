# Maestro System Testing Flows

This directory contains detailed manual testing guides for verifying the Maestro orchestration system. These flows are designed for human testers to validate end-to-end functionality across the Server, CLI, and UI.

## Testing Modules

| ID | Module | Features Covered |
|----|--------|------------------|
| **01** | [Maestro Server](./01-Maestro-Server-Testing.md) | Server startup, Health checks, API endpoints, WebSocket connections |
| **02** | [Maestro CLI](./02-Maestro-CLI-Testing.md) | Installation, Configuration, Core commands, Error handling |
| **03** | [UI App Resources](./03-UI-App-Resources-Testing.md) | App startup, Resource loading, Closing behavior, Performance |
| **04** | [Session Management](./04-Session-Management-Testing.md) | Session creation, Editing, Real-time Sync, Deletion |
| **05** | [Task Management](./05-Task-Management-Testing.md) | Maestro Panel, Task CRUD, Subtasks, Status transitions |
| **06** | [Terminal Spawning](./06-Terminal-Spawning-Testing.md) | Spawning from tasks, Env vars, Arguments, Context injection |
| **07** | [Skills & Hooks](./07-Skills-and-Hooks-Testing.md) | CLI Skills (Worker/Orchestrator), Hook execution |

## Prerequisites

Before starting these tests, ensure you have:
1.  **Node.js 18+** installed
2.  **Rust/Cargo** installed (for Tauri)
3.  **Docker** (optional, for containerized testing)
4.  The project repository cloned and dependencies installed:
    ```bash
    npm install
    cd maestro-server && npm install
    cd ../maestro-cli && npm install
    ```

## Reporting Issues

If a test fails:
1.  Note the **Step Number** where the failure occurred.
2.  Capture the **Actual Result** vs **Expected Result**.
3.  Include any **Error Logs** from the Server or UI console.
