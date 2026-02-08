# Maestro Orchestration Overview

## Introduction
Maestro is an intelligent orchestration layer that sits between the User and the Agents (LLMs). It manages complex coding tasks by breaking them down into manageable subtasks and orchestrating their execution through specialized "Skilled Agents".

## Core Concepts

### 1. Task Hierarchy (The Tree Structure)
In Maestro, everything is a **Task**.
- **Root Task**: The main objective created by the user (e.g., "Implement Authentication").
- **Subtasks**: Children of a task.
- **Recursive Structure**: A subtask is just a Task with a `parentId`.
- **Tree**: The entire execution flow forms a tree structure where leaf nodes are actionable units of work usually handled by a single Worker Session.

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  parentId?: string; // Points to parent task
  subtasks: Task[];  // Array of child tasks
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
}
```

### 2. Two-Tier Orchestration
Maestro uses a two-tier approach to manage complexity:

#### Tier 1: The Orchestrator
- **Role**: Planner & Manager.
- **Input**: A high-level User Request.
- **Action**: detailed analysis of the codebase, breaking the request into a "Dependency Graph" of subtasks.
- **Output**: A structured Execution Plan (JSON) containing grouped subtasks.
- **Agent**: `Maestro Orchestrator` (uses `Maestro Orchestrator Skill`).

#### Tier 2: The Worker
- **Role**: Executor.
- **Input**: A specific group of subtasks (contextually related).
- **Action**: Writing code, running tests, fixing bugs.
- **Output**: Code changes and progress updates.
- **Agent**: `Maestro Worker` (uses `Maestro Worker Skill`).

## The Orchestration Flow

1.  **User Request**: User creates a prompt in Agents UI (e.g., "Refactor the API").
2.  **Orchestrator Session**: Maestro spawns a hidden or visible session for the Orchestrator Agent.
3.  **Planning**: The Orchestrator analyzes the request and creates a plan.
4.  **Task Creation**: Maestro Server creates the subtask tree in the database based on the plan.
5.  **Session Spawning**: Maestro spawns **Worker Sessions** (Terminals) for leaf nodes in the plan.
    - Each session is initialized with the `Maestro Worker Skill`.
    - Envars `MAESTRO_TASK_ID` and `MAESTRO_SESSION_ID` are set.
6.  **Execution**: Workers execute their subtasks using the CLI to report back to Maestro.
7.  **Aggregation**: As subtasks complete, the parent task tracks progress.
8.  **Completion**: When all subtasks are done, the Root Task is marked complete.

## Session Management
- **Many-to-Many Relationship**: A single Task can span multiple Sessions (e.g., parallel workers). A single Session could theoretically handle multiple small serial Tasks (though typically 1 session = 1 subtask group).
- **Context Injection**: When a session starts, Maestro injects:
    - **Environment Variables**: To identify the context.
    - **Default Skills**: Crucially, the `Maestro Worker Skill`.
    - **Custom Skills**: Any user-defined skills from the `.skills` directory.

## Skilled Agents
Maestro introduces the concept of **Skilled Agents**—specialized personas equipped with specific tools and prompts for distinct phases of work (e.g., *Bug Hunter*, *Code Reviewer*, *Architect*). These are orchestratable units that can be assigned to tasks.
