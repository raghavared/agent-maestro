# Task Status Lifecycle & Flows

This document defines the state machine for Maestro tasks and the modular commands used to drive it.

## 1. Status Definitions

| Status | Color | Command to Set |
| :--- | :--- | :--- |
| **`pending`** | Grey | (Default on creation) |
| **`in_progress`** | Blue | `maestro task start` |
| **`blocked`** | Red | `maestro task block --reason "..."` |
| **`completed`** | Green | `maestro task complete` |

---

## 2. Standard Workflows

### A. The Execution Flow (Worker)
1.  **Accept:** Worker runs `maestro task start`. Status: `in_progress`.
2.  **Iterate:** Worker runs `maestro task log "Finished the auth middleware"`. Status: `in_progress`.
3.  **Finish:** Worker runs `maestro task complete`. Status: `completed`.

### B. The Blocked Flow (Worker)
1.  **Identify:** Worker finds an issue.
2.  **Report:** Worker runs `maestro task block --reason "Port 5432 already in use"`. Status: `blocked`.
3.  **Resolution:** Orchestrator clears the blocker and runs `maestro task start` to resume.

### C. The Management Flow (Orchestrator)
1.  **Decompose:** Orchestrator runs `maestro subtask create` for every requirement.
2.  **Delegate:** Orchestrator runs `maestro session spawn` for specific task IDs.
3.  **Validate:** Orchestrator monitors `maestro task list` until all tasks are `completed`.
