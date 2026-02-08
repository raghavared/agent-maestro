# Maestro Orchestration: Architecture Overview

## Executive Summary

This document outlines the architecture for **automated task execution** in Maestro using a two-tier orchestration system. Instead of manually running tasks, the system automatically spawns Claude Code sessions with engineered context to execute tasks and track progress in real-time.

---

## Architecture: Two-Tier System

We introduce two distinct tiers of AI intelligence:

1.  **Tier 1: Maestro Orchestrator (Planning)**  
    *Agent:* Claude Code (Non-interactive)  
    *Role:* Analyzes requirements, breaks down work, creates detailed execution plans.  
    *Output:* Structured JSON plan with task groups and strategies.

2.  **Tier 2: Maestro Worker (Execution)**  
    *Agent:* Claude Code (Interactive/Session)  
    *Role:* Executes specific subtask groups in isolated terminal sessions.  
    *Output:* Code changes, status updates, verified subtasks.

### System Diagram

```
User clicks "Run Task"
    ↓
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: MAESTRO ORCHESTRATOR (Planning Phase)              │
│ Skill: maestro-orchestrator                                 │
└─────────────────────────────────────────────────────────────┘
    ↓
    Analyzes Task & Codebase
    ↓
    Produces Execution Plan (JSON)
    [ Groups: Database, API, Frontend ]
    ↓
┌─────────────────────────────────────────────────────────────┐
│ TIER 2: MAESTRO WORKER (Execution Phase)                   │
│ Skill: maestro-worker                                       │
└─────────────────────────────────────────────────────────────┘
    ↓
    [Session A] Executes Database Group (Subtasks 1-2)
    [Session B] Executes API Group      (Subtasks 3-4)
    [Session C] Executes Frontend Group (Subtasks 5-6)
    ↓
    Real-time updates via WebSockets & Hooks
    ↓
    Task Completion
```

---

## Data Models

### Task Context
The data package sent to the Orchestrator:

```typescript
type TaskContext = {
  task: {
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    initialPrompt: string;
  };
  subtasks: Subtask[];
  project: {
    id: string;
    basePath: string;
    relevantFiles: string[];
  };
};
```

### Execution Mapping
The bridge between planning and execution:

```typescript
type TaskToSessionMapping = {
  groupId: string;
  subtaskIds: string[];
  sessionName: string;
  order: number;
  parallelGroup: number | null; // For parallel execution
};
```

---

## Key Benefits

1.  **Automation:** User clicks run, system handles the rest.
2.  **Granularity:** Work is tracked at the subtask level.
3.  **Parallelism:** Independent groups run simultaneously.
4.  **Isolation:** Different contexts don't pollute each other (unless requested).
5.  **Visibility:** Real-time UI updates on what exactly is being worked on.
