# Task DAG Architecture

## Overview
This document outlines the architectural transition from a hierarchical "Tasks with Subtasks" (Tree) model to a "Task Dependency Graph" (Directed Acyclic Graph - DAG) model.

Currently, the Maestro system supports tasks having subtasks, which forms a Tree structure. While the data model ostensibly supports dependencies, the functional logic to enforce and visualize a DAG is missing.

## Current Status: Partial / Dormant DAG Support

### Does the current model support DAG?
**Yes, structurally.**
The core data model (`Task` type) defined in `Phase I Implementation/04-DATA-MODELS.md` and implemented in `maestro-server/src/types.ts` already contains the necessary field:

```typescript
type Task = {
  // ...
  dependencies?: string[]; // Task IDs that must complete first
  // ...
};
```

This `dependencies` array allows any task to wait on any number of other tasks, which is the foundational definition of a DAG node.

### Why doesn't it support it functionally?
While the *field* exists, the *application* currently ignores it.

1.  **No Execution Logic:** The backend (`maestro-server`) does not check this array. It does not block a task from starting if its dependencies are incomplete.
2.  **No Validation:** There is no code to prevent circular dependencies (e.g., A depends on B, B depends on A). A cycle would break the "Acyclic" property of a DAG and cause infinite loops in execution.
3.  **No UI Support:** The frontend currently visualizes a Tree (Parent -> Children), not a Graph. There is no interface for a user to "draw a line" between two unrelated tasks to create a dependency.

---

## Implementation Plan

To fully enable DAG architecture, we must implement the following layers:

### 1. Backend: Enforcement & Validation
Modify `maestro-server` to respect and enforce the `dependencies` field.

*   **Circular Dependency Check:**
    *   **Trigger:** When updating a task's dependencies.
    *   **Logic:** Run a cycle detection algorithm (e.g., Depth-First Search) or topological sort.
    *   **Action:** Reject updates that create a loop/cycle.

*   **Status Gating:**
    *   **Trigger:** When a user or agent attempts to start a task.
    *   **Logic:** Check the status of all task IDs listed in `dependencies`.
    *   **Action:** If any dependencies are not `completed`, reject the start request with a `blocked` status/reason.

*   **Auto-Unblocking (Event-Driven):**
    *   **Trigger:** When a task transitions to `completed`.
    *   **Logic:** Identify all tasks that depend on the completed task. Check if *their* other dependencies are also met.
    *   **Action:** Notify the user or auto-update the dependent task's status from `blocked` to `pending` (ready for execution).

### 2. Orchestrator: Dependency-Aware Execution
The Maestro Orchestrator (the agent managing tasks) needs to understand this flow to execute tasks in the correct order.

*   **Topological Selection Logic:**
    *   Instead of simply picking the "next" subtask in a list, the Orchestrator should query for "nodes with indegree 0" (conceptually) or "all tasks where `dependencies` are met AND status is `pending`".

### 3. Frontend: Visualization & Management
The current nested list view is insufficient for a DAG.

*   **Graph View:**
    *   Introduce a node-link diagram (using libraries like `reactflow`, `d3`, or `visx`) to visualize tasks as nodes and dependencies as directional edges.
    *   This allows users to see the "critical path" of their project.

*   **Dependency Management UI:**
    *   **Linking:** Allow users to "link" tasks in the UI (e.g., drag and drop connections or a multi-select "Depends On" field in the task details pane).
    *   **Visual Feedback:** Clearly indicate `blocked` tasks and trace the line back to the dependency holding them up.

## Summary Table

| Component | Current State | Required for DAG |
| :--- | :--- | :--- |
| **Data Model** | `dependencies: string[]` exists | **Ready** (No changes needed) |
| **Backend** | Ignores dependencies | **Needs Logic** (Cycle Detection + Status Gating) |
| **Frontend** | Tree View (Parent/Child) | **Needs UI** (Graph View / Dependency Linker) |
| **Orchestrator** | Linear Execution | **Needs Logic** (Topological Execution) |
