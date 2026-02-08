# UI Component Mapping: Current vs. Worker Strategy System

## Overview

This document maps the current UI components and their data, vs. what changes with the Worker Strategy System.

---

## 1. TASKS PANEL (`MaestroPanel.tsx`)

### Current State

**Purpose**: Display and manage tasks in a hierarchical tree view.

**Data Displayed**:
- Task list with hierarchical parent/child relationships
- Task status: `todo | in_progress | completed | cancelled | blocked`
- Task priority: `low | medium | high`
- Agent status (optional): `working | blocked | needs_input | completed | failed`
- Session count per task (how many sessions are working on it)
- Time ago (last updated)

**Key Features**:
- Tabs: Tasks | Completed | Config
- Filters: Status, Priority, Sort
- Actions: Create task, Work on task (spawn session), Plan, Refresh
- Multi-task session creator (select multiple tasks for one session)
- Hierarchical tree with collapsible subtasks

**Events Consumed** (WebSocket):
- `task:created` - New task added
- `task:updated` - Task modified
- `task:deleted` - Task removed
- `task:session_added` - Session attached to task
- `task:session_removed` - Session detached from task

---

### After Worker Strategy System

**New Data to Display**:
- **No changes to task list itself** - tasks remain the same
- Tasks still have `parentId` for hierarchy
- **NEW**: When viewing task details, show per-session status:
  - Which sessions have this task
  - What strategy each session uses
  - Item status in that session's data structure (`queued | processing | completed | failed | skipped | blocked`)

**New Features**:
- **"Add to Session" action**: Add a task to a running session's data structure
- **Session status chips on tasks**: Show `📋 Queue: processing` or `🔀 DAG: blocked` per session

**UI Changes**:
| Component | Current | After |
|-----------|---------|-------|
| TaskListItem | Shows session count | Shows session count + per-session status chips |
| TaskDetailModal | Lists sessions | Lists sessions with worker type + item status |
| "Work On" button | Creates session | Opens "Create Session Modal" with worker type selection |

---

## 2. SESSIONS PANEL (New / Enhanced)

### Current State

**Where sessions appear**:
- In `TaskListItem` expanded view: lists sessions attached to a task
- In `TaskDetailModal`: same list with jump-to-terminal action
- Terminal tabs (left panel): each terminal tab IS a session

**Data Displayed per Session**:
- Session ID/Name
- Session status: `running | completed | failed | spawning | stopped`
- Spawn source: `ui | session`
- Task IDs associated
- Role: `worker | orchestrator`

**No dedicated "Sessions Panel"** exists currently.

---

### After Worker Strategy System

**New: Dedicated Sessions Panel** (or enhanced view)

**Data to Display per Session**:
```typescript
interface SessionView {
  // Identity
  id: string;
  name: string;
  status: MaestroSessionStatus;

  // NEW: Strategy info
  strategy: StrategyId;  // 'simple' | 'queue' | 'stack' | 'priority' | 'dag' | 'round_robin'

  // NEW: Data structure state (if strategy !== 'simple')
  dataStructure?: {
    type: DataStructureType;
    items: DataStructureItem[];
    currentItem: DataStructureItem | null;
    stats: {
      queued: number;
      processing: number;
      completed: number;
      failed: number;
      blocked?: number;  // DAG only
    };
  };

  // Existing
  taskIds: string[];
  role: 'worker' | 'orchestrator';
  spawnSource: 'ui' | 'session';
}
```

**New Components**:

| Component | Purpose |
|-----------|---------|
| `SessionPanel` | Main container for session details |
| `WorkerTypeBadge` | Shows `📋 Queue` or `🔀 DAG` etc |
| `DataStructureView` | Router for type-specific views |
| `QueueView` | Visual queue with items, current highlight |
| `StackView` | Visual stack (LIFO) |
| `PriorityQueueView` | Queue sorted by priority |
| `DAGView` | Graph visualization with nodes/edges |
| `AddTaskToSessionButton` | Add tasks to running session |

---

## 3. SESSION CREATION FLOW

### Current State

**Flow**:
1. User clicks "Work On" (▶) on a task
2. `onCreateMaestroSession({ task, project, skillIds })` called
3. Session created with task(s) bound
4. Terminal spawns and runs

**No worker type selection** - sessions are all "simple/manifest" style.

---

### After Worker Strategy System

**New Flow**:
1. User clicks "Work On" (▶) on a task
2. **NEW: CreateSessionModal opens** with:
   - Selected task(s) shown
   - Worker type selector: Simple (default), Queue, Stack, Priority, DAG
   - Type-specific configuration:
     - Queue/Stack: Drag to reorder tasks
     - Priority: Assign priority to each task
     - DAG: Define dependencies between tasks
3. User submits with configuration
4. Session created with chosen strategy
5. Data structure initialized (if not simple)
6. Terminal spawns with strategy-specific system prompt

**New Modal: `CreateSessionModal`**
```tsx
interface CreateSessionModalProps {
  taskIds: string[];
  onClose: () => void;
  onSubmit: (config: SessionConfig) => void;
}

interface SessionConfig {
  strategy: StrategyId;
  taskOrder?: string[];           // For queue/stack
  priorities?: Record<string, number>;  // For priority
  dependencies?: Record<string, string[]>;  // For DAG
}
```

---

## 4. DATA STRUCTURE VISUALIZATION

### Current State

**None** - Tasks are simply listed, no structured processing view.

---

### After Worker Strategy System

**New Visualizations by Strategy**:

#### Queue View
```
┌─────────────────────────────────────────────┐
│ Queue (3 items)           [+ Add Task]      │
├─────────────────────────────────────────────┤
│ ▸ 1. [Processing] Implement auth    ⚙️      │
│   2. [Queued]     Write tests       ○       │
│   3. [Queued]     Update docs       ○       │
└─────────────────────────────────────────────┘
```

#### Stack View
```
┌─────────────────────────────────────────────┐
│ Stack (3 items)           [+ Push Task]     │
├─────────────────────────────────────────────┤
│ TOP                                         │
│ ▸ [Processing] Debug login bug     ⚙️       │
│   [Queued]     Fix auth flow       ○        │
│   [Queued]     Original task       ○        │
│ BOTTOM                                      │
└─────────────────────────────────────────────┘
```

#### DAG View
```
┌─────────────────────────────────────────────┐
│ DAG (4 tasks)  Ready: 1 | Processing: 1    │
├─────────────────────────────────────────────┤
│                                             │
│        [Setup DB] ✓                         │
│         /      \                            │
│   [Auth] ⚙️    [API] ○ (ready)              │
│         \      /                            │
│        [Tests] 🚫 (blocked)                 │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 5. WEBSOCKET EVENTS

### Current Events

```typescript
// Task events
'task:created'         // { task: MaestroTask }
'task:updated'         // { task: MaestroTask }
'task:deleted'         // { taskId: string }
'task:session_added'   // { taskId, sessionId }
'task:session_removed' // { taskId, sessionId }

// Session events
'session:spawn'        // { session: MaestroSession }
'session:updated'      // { session: MaestroSession }
'session:completed'    // { sessionId }
'session:task_added'   // { sessionId, taskId }
'session:task_removed' // { sessionId, taskId }
```

---

### New Events (Worker Strategy System)

```typescript
// Data Structure events (NEW)
'ds:item_added'           // { sessionId, item: DataStructureItem, position: number }
'ds:item_removed'         // { sessionId, taskId: string }
'ds:item_status_changed'  // { sessionId, taskId, previousStatus, newStatus }
'ds:current_item_changed' // { sessionId, previousTaskId, currentTaskId }
'ds:reordered'            // { sessionId, newOrder: string[] }

// DAG-specific events
'ds:dag_unlocked'         // { sessionId, taskIds: string[] } // Dependencies satisfied

// Session strategy events (NEW)
'session:strategy_set'    // { sessionId, strategy: StrategyId }
```

---

## 6. TYPE CHANGES

### Current Types (`maestro.ts`)

```typescript
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
export type MaestroSessionStatus = 'running' | 'completed' | 'failed' | 'spawning' | 'stopped';

export interface MaestroSession {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  status: MaestroSessionStatus;
  role?: 'orchestrator' | 'worker';
  spawnSource?: SpawnSource;
  // ...
}
```

---

### New/Modified Types

```typescript
// NEW: Strategy types
export type StrategyId = 'simple' | 'queue' | 'stack' | 'priority' | 'dag' | 'round_robin';
export type DataStructureType = 'queue' | 'stack' | 'priority_queue' | 'dag' | 'circular_queue';
export type ItemStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'skipped' | 'blocked';

// NEW: Data structure item
export interface DataStructureItem {
  taskId: string;
  addedAt: string;
  addedBy: 'user' | 'agent';
  status: ItemStatus;
  metadata: Record<string, unknown>;
  // Priority-specific
  priority?: number;
  // DAG-specific
  dependencies?: string[];
  dependents?: string[];
}

// NEW: Session data structure
export interface SessionDataStructure {
  sessionId: string;
  type: DataStructureType;
  items: DataStructureItem[];
  currentItem: DataStructureItem | null;
  createdAt: string;
  updatedAt: string;
  stats?: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    blocked?: number;
  };
}

// MODIFIED: MaestroSession
export interface MaestroSession {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  status: MaestroSessionStatus;
  role?: 'orchestrator' | 'worker';
  spawnSource?: SpawnSource;

  // NEW fields
  strategy: StrategyId;
  // Note: dataStructure is NOT on session - it's fetched separately
  // or stored in a separate store slice
}
```

---

## 7. STORE CHANGES

### Current Store (`useMaestroStore.ts`)

```typescript
interface MaestroState {
  // Projects
  projects: Map<string, MaestroProject>;
  currentProjectId: string | null;

  // Tasks
  tasks: Map<string, MaestroTask>;

  // Sessions
  sessions: Map<string, MaestroSession>;

  // Actions
  createTask, updateTask, deleteTask
  createSession, updateSession
  // ...
}
```

---

### New Store Additions

```typescript
interface MaestroState {
  // ... existing

  // NEW: Data structures per session
  dataStructures: Map<string, SessionDataStructure>;

  // NEW: Actions
  initDataStructure: (sessionId: string, strategy: StrategyId, taskIds: string[]) => Promise<void>;
  addTaskToSession: (sessionId: string, taskId: string, options?: AddOptions) => Promise<void>;
  updateDataStructure: (sessionId: string, update: Partial<SessionDataStructure>) => void;

  // NEW: Strategy-specific actions
  queueStart: (sessionId: string) => Promise<DataStructureItem>;
  queueComplete: (sessionId: string) => Promise<void>;
  stackPush: (sessionId: string, taskId: string) => Promise<void>;
  dagMarkReady: (sessionId: string, taskId: string) => Promise<void>;
}
```

---

## 8. HOOKS CHANGES

### Current Hooks

```typescript
useTasks(projectId)          // Get all tasks for project
useTaskSessions(taskId)      // Get sessions for a task
useTaskSessionCount(taskId)  // Get count of sessions
useTaskTree(tasks)           // Build hierarchical tree
useTaskBreadcrumb(taskId)    // Get parent chain
useSubtaskProgress(task)     // Calculate subtask completion %
```

---

### New Hooks

```typescript
// NEW: Data structure hooks
useDataStructure(sessionId: string) => {
  dataStructure: SessionDataStructure | null;
  isLoading: boolean;
  error: Error | null;
}

useSessionStrategy(sessionId: string) => {
  strategy: StrategyId;
  isStructured: boolean;  // true if not 'simple'
}

// NEW: Task status in session
useTaskItemStatus(sessionId: string, taskId: string) => {
  status: ItemStatus | null;  // null if task not in session
  position: number | null;
}

// NEW: For task list items - get all session statuses for a task
useTaskSessionStatuses(taskId: string) => {
  statuses: Array<{
    sessionId: string;
    sessionName: string;
    strategy: StrategyId;
    itemStatus: ItemStatus;
  }>;
}
```

---

## 9. COMPONENT CHANGES SUMMARY

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `MaestroPanel` | Minor | Add session creation modal trigger |
| `TaskListItem` | Medium | Add per-session status chips |
| `TaskDetailModal` | Medium | Show strategy + item status per session |
| `CreateSessionModal` | **NEW** | Worker type selection + config |
| `WorkerTypeSelector` | **NEW** | Radio/card selector for strategies |
| `DataStructureView` | **NEW** | Router for type-specific views |
| `QueueView` | **NEW** | Queue visualization |
| `StackView` | **NEW** | Stack visualization |
| `PriorityQueueView` | **NEW** | Priority queue visualization |
| `DAGView` | **NEW** | DAG graph visualization |
| `DAGGraph` | **NEW** | React Flow based graph |
| `WorkerTypeBadge` | **NEW** | Badge showing worker type |
| `AddTaskToSessionButton` | **NEW** | Add task to running session |
| `AddTaskModal` | **NEW** | Type-specific add options |
| `SessionStatusChip` | **NEW** | Shows task's status in a session |

---

## 10. MIGRATION/COMPATIBILITY

### Backward Compatibility

1. **Default strategy is `simple`** - matches current behavior
2. Sessions without `strategy` field are treated as `simple`
3. No data structure for `simple` strategy - tasks are static
4. Existing CLI commands (`task list`, `task complete`) still work

### Gradual Adoption

Phase 1: Infrastructure
- Add `strategy` field to session (default: 'simple')
- Add data structure types
- Add WebSocket events

Phase 2: UI - Session Creation
- Add `CreateSessionModal` with worker type selector
- Default to Simple, other types available

Phase 3: UI - Visualizations
- Add `DataStructureView` and type-specific views
- Add real-time updates via new WebSocket events

Phase 4: CLI Commands
- Add `queue`, `stack`, `priority`, `dag` command groups
- Worker loop becomes standard pattern
