# Production Phase 1: Overview

## Goal
To implement a robust, CLI-driven orchestration workflow where a single **Maestro Orchestrator** manages the lifecycle of a project by breaking down tasks into subtasks and spawning specialized **Maestro Workers** to execute them.

## Architecture

### 1. The Orchestrator Session
- **Agent:** Maestro Orchestrator.
- **Skills:** `maestro-cli`, `maestro-orchestrator`.
- **Primary Tool:** Maestro CLI.

### 2. The Worker Sessions
- **Agent:** Maestro Worker.
- **Skills:** `maestro-cli`, `maestro-worker`.
- **Workflow:**

### 3. The Communication Loop
- **CLI -> Server:** Commands update the central database.
- **Server -> UI:** WebSocket events broadcast updates instantly.
- **Server -> UI (Spawning):** The CLI triggers a spawn request; the UI catches it and opens a new terminal window.
