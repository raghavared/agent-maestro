# State Management Design: Board Views

## Overview

This document defines the Zustand store architecture for two new board views in Maestro UI: **Terminal Boards** (split-pane terminal layouts) and **Task Boards** (kanban-style task columns). The design follows the existing patterns established by `useSessionStore`, `useMaestroStore`, `useWorkspaceStore`, and `useProjectStore`.

---

## 1. TypeScript Types

### 1.1 Terminal Board Types

```typescript
// ---------- Layout Tree ----------

export type SplitDirection = 'horizontal' | 'vertical';

/** A leaf node renders a single terminal session pane. */
export interface LeafNode {
  type: 'leaf';
  sessionId: string; // References TerminalSession.id from useSessionStore
}

/** A split node divides space between two children. */
export interface SplitNode {
  type: 'split';
  direction: SplitDirection;
  /** Value between 0 and 1 representing the fraction allocated to the first child. */
  ratio: number;
  children: [LayoutNode, LayoutNode];
}

export type LayoutNode = LeafNode | SplitNode;

// ---------- Board Entity ----------

export interface TerminalBoard {
  id: string;
  projectId: string;
  name: string;
  layout: LayoutNode;
  /** The sessionId of the currently focused pane. */
  activePaneSessionId: string | null;
  createdAt: number;
  updatedAt: number;
}
```

### 1.2 Task Board Types

```typescript
import type { TaskStatus, TaskPriority } from '../app/types/maestro';

/** Persisted per-project configuration for the task board. */
export interface TaskBoardConfig {
  projectId: string;
  /** Ordered list of statuses to show as columns. */
  visibleStatuses: TaskStatus[];
  /** Set of statuses whose columns are collapsed. */
  collapsedStatuses: TaskStatus[];
}

/** A derived column for rendering. Not persisted -- computed from tasks. */
export interface TaskBoardColumn {
  status: TaskStatus;
  label: string;
  taskIds: string[];
  collapsed: boolean;
}

/** Transient drag-and-drop state. */
export interface TaskBoardDragState {
  taskId: string;
  sourceStatus: TaskStatus;
  targetStatus: TaskStatus | null;
}

/** Filter criteria for the task board. */
export interface TaskBoardFilter {
  priorities: TaskPriority[];     // empty = show all
  searchQuery: string;            // free-text title/description search
  assigneeSessionIds: string[];   // empty = show all
  showSubtasks: boolean;          // whether to inline subtasks
}
```

### 1.3 View Mode Type

```typescript
/**
 * Extends the workspace concept. The default view is the existing
 * single-terminal + file explorer. Board views add new layouts.
 */
export type BoardViewMode = 'default' | 'terminal-board' | 'task-board';
```

---

## 2. Store Interface: `useBoardStore`

A single store manages both terminal boards and task board configuration. This keeps board-related state co-located and avoids scattering it across multiple stores.

```typescript
import { create } from 'zustand';

interface BoardState {
  // ---- View mode (per project) ----
  /** Maps projectId -> active board view mode. */
  viewModeByProject: Record<string, BoardViewMode>;
  setViewMode: (projectId: string, mode: BoardViewMode) => void;

  // ---- Terminal Boards ----
  /** Maps boardId -> TerminalBoard. */
  terminalBoards: Map<string, TerminalBoard>;
  /** Maps projectId -> ordered list of board IDs. */
  terminalBoardIdsByProject: Record<string, string[]>;
  /** The currently displayed board per project. */
  activeTerminalBoardIdByProject: Record<string, string | null>;

  // Terminal Board CRUD
  createTerminalBoard: (projectId: string, name: string) => string;
  deleteTerminalBoard: (boardId: string) => void;
  renameTerminalBoard: (boardId: string, name: string) => void;
  setActiveTerminalBoard: (projectId: string, boardId: string | null) => void;

  // Terminal Board Layout Mutations
  setLayout: (boardId: string, layout: LayoutNode) => void;
  setSplitRatio: (boardId: string, path: number[], ratio: number) => void;
  splitPane: (boardId: string, sessionId: string, direction: SplitDirection, newSessionId: string) => void;
  closePane: (boardId: string, sessionId: string) => void;
  setActivePaneSessionId: (boardId: string, sessionId: string | null) => void;

  // ---- Task Board ----
  /** Maps projectId -> TaskBoardConfig. */
  taskBoardConfigByProject: Record<string, TaskBoardConfig>;
  /** Transient drag state (null when not dragging). */
  taskBoardDragState: TaskBoardDragState | null;
  /** Filter state per project. */
  taskBoardFilterByProject: Record<string, TaskBoardFilter>;

  // Task Board Actions
  setTaskBoardConfig: (projectId: string, config: Partial<TaskBoardConfig>) => void;
  toggleColumnCollapse: (projectId: string, status: TaskStatus) => void;
  setTaskBoardDragState: (state: TaskBoardDragState | null) => void;
  setTaskBoardFilter: (projectId: string, filter: Partial<TaskBoardFilter>) => void;
  resetTaskBoardFilter: (projectId: string) => void;
  moveTask: (projectId: string, taskId: string, targetStatus: TaskStatus) => Promise<void>;

  // ---- Cleanup ----
  removeSessionFromBoards: (sessionId: string) => void;
  cleanupProject: (projectId: string) => void;
}
```

---

## 3. Store Implementation Patterns

### 3.1 Creation

```typescript
export const useBoardStore = create<BoardState>((set, get) => ({
  // Initial state
  viewModeByProject: {},
  terminalBoards: new Map(),
  terminalBoardIdsByProject: {},
  activeTerminalBoardIdByProject: {},
  taskBoardConfigByProject: {},
  taskBoardDragState: null,
  taskBoardFilterByProject: {},

  // ... (action implementations below)
}));
```

Follows the same `create<Interface>((set, get) => ({...}))` pattern used by every existing store (useSessionStore, useMaestroStore, etc.).

### 3.2 Terminal Board CRUD

```typescript
createTerminalBoard: (projectId, name) => {
  const id = crypto.randomUUID();
  const board: TerminalBoard = {
    id,
    projectId,
    name,
    layout: { type: 'leaf', sessionId: '' }, // placeholder until a session is assigned
    activePaneSessionId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  set((prev) => {
    const boards = new Map(prev.terminalBoards);
    boards.set(id, board);
    const projectBoardIds = [...(prev.terminalBoardIdsByProject[projectId] ?? []), id];
    return {
      terminalBoards: boards,
      terminalBoardIdsByProject: {
        ...prev.terminalBoardIdsByProject,
        [projectId]: projectBoardIds,
      },
      activeTerminalBoardIdByProject: {
        ...prev.activeTerminalBoardIdByProject,
        [projectId]: id,
      },
    };
  });
  return id;
},
```

### 3.3 Layout Tree Operations

The binary tree layout is manipulated with path-based traversal. A `path` is an array of indices (`0` = first child, `1` = second child) to navigate from the root to a target node.

```typescript
splitPane: (boardId, sessionId, direction, newSessionId) => {
  set((prev) => {
    const board = prev.terminalBoards.get(boardId);
    if (!board) return prev;

    const replaceLeaf = (node: LayoutNode): LayoutNode => {
      if (node.type === 'leaf') {
        if (node.sessionId === sessionId) {
          return {
            type: 'split',
            direction,
            ratio: 0.5,
            children: [
              { type: 'leaf', sessionId },
              { type: 'leaf', sessionId: newSessionId },
            ],
          };
        }
        return node;
      }
      return {
        ...node,
        children: [replaceLeaf(node.children[0]), replaceLeaf(node.children[1])],
      };
    };

    const updated = { ...board, layout: replaceLeaf(board.layout), updatedAt: Date.now() };
    const boards = new Map(prev.terminalBoards);
    boards.set(boardId, updated);
    return { terminalBoards: boards };
  });
},

closePane: (boardId, sessionId) => {
  set((prev) => {
    const board = prev.terminalBoards.get(boardId);
    if (!board) return prev;

    const removeLeaf = (node: LayoutNode): LayoutNode | null => {
      if (node.type === 'leaf') {
        return node.sessionId === sessionId ? null : node;
      }
      const left = removeLeaf(node.children[0]);
      const right = removeLeaf(node.children[1]);
      if (!left && !right) return null;
      if (!left) return right;
      if (!right) return left;
      return { ...node, children: [left, right] };
    };

    const newLayout = removeLeaf(board.layout);
    if (!newLayout) {
      // Board is now empty -- delete it
      const boards = new Map(prev.terminalBoards);
      boards.delete(boardId);
      const projectBoardIds = (prev.terminalBoardIdsByProject[board.projectId] ?? [])
        .filter((id) => id !== boardId);
      return {
        terminalBoards: boards,
        terminalBoardIdsByProject: {
          ...prev.terminalBoardIdsByProject,
          [board.projectId]: projectBoardIds,
        },
      };
    }

    const updated = { ...board, layout: newLayout, updatedAt: Date.now() };
    const boards = new Map(prev.terminalBoards);
    boards.set(boardId, updated);
    return { terminalBoards: boards };
  });
},

setSplitRatio: (boardId, path, ratio) => {
  set((prev) => {
    const board = prev.terminalBoards.get(boardId);
    if (!board) return prev;

    const updateAtPath = (node: LayoutNode, remaining: number[]): LayoutNode => {
      if (remaining.length === 0 && node.type === 'split') {
        return { ...node, ratio: Math.max(0.1, Math.min(0.9, ratio)) };
      }
      if (node.type !== 'split' || remaining.length === 0) return node;
      const [idx, ...rest] = remaining;
      const children: [LayoutNode, LayoutNode] = [...node.children];
      children[idx] = updateAtPath(children[idx], rest);
      return { ...node, children };
    };

    const updated = { ...board, layout: updateAtPath(board.layout, path), updatedAt: Date.now() };
    const boards = new Map(prev.terminalBoards);
    boards.set(boardId, updated);
    return { terminalBoards: boards };
  });
},
```

### 3.4 Task Board Actions

```typescript
moveTask: async (projectId, taskId, targetStatus) => {
  // Optimistic update via useMaestroStore
  const { updateTask } = useMaestroStore.getState();
  try {
    await updateTask(taskId, { status: targetStatus });
  } catch (err) {
    useUIStore.getState().reportError('Failed to move task', err);
  }
  get().setTaskBoardDragState(null);
},

toggleColumnCollapse: (projectId, status) => {
  set((prev) => {
    const config = prev.taskBoardConfigByProject[projectId] ?? getDefaultTaskBoardConfig(projectId);
    const collapsed = config.collapsedStatuses.includes(status)
      ? config.collapsedStatuses.filter((s) => s !== status)
      : [...config.collapsedStatuses, status];
    return {
      taskBoardConfigByProject: {
        ...prev.taskBoardConfigByProject,
        [projectId]: { ...config, collapsedStatuses: collapsed },
      },
    };
  });
},
```

---

## 4. Derived Selectors

Following the pattern of exported pure functions (like `getActive()`, `getProjectSessions()`, `getActiveWorkspaceKey()` in existing stores):

```typescript
// ---- Terminal Board Selectors ----

export function getTerminalBoardsForProject(projectId: string): TerminalBoard[] {
  const { terminalBoards, terminalBoardIdsByProject } = useBoardStore.getState();
  const ids = terminalBoardIdsByProject[projectId] ?? [];
  return ids
    .map((id) => terminalBoards.get(id))
    .filter((b): b is TerminalBoard => b != null);
}

export function getActiveTerminalBoard(): TerminalBoard | null {
  const { activeProjectId } = useProjectStore.getState();
  const { terminalBoards, activeTerminalBoardIdByProject } = useBoardStore.getState();
  const boardId = activeTerminalBoardIdByProject[activeProjectId] ?? null;
  if (!boardId) return null;
  return terminalBoards.get(boardId) ?? null;
}

export function getBoardSessionIds(board: TerminalBoard): string[] {
  const collect = (node: LayoutNode): string[] => {
    if (node.type === 'leaf') return node.sessionId ? [node.sessionId] : [];
    return [...collect(node.children[0]), ...collect(node.children[1])];
  };
  return collect(board.layout);
}

export function getViewModeForProject(projectId: string): BoardViewMode {
  return useBoardStore.getState().viewModeByProject[projectId] ?? 'default';
}

// ---- Task Board Selectors ----

export function getTaskBoardColumns(projectId: string): TaskBoardColumn[] {
  const { taskBoardConfigByProject, taskBoardFilterByProject } = useBoardStore.getState();
  const config = taskBoardConfigByProject[projectId] ?? getDefaultTaskBoardConfig(projectId);
  const filter = taskBoardFilterByProject[projectId] ?? getDefaultTaskBoardFilter();
  const { tasks } = useMaestroStore.getState();

  // Collect project tasks
  const projectTasks = Array.from(tasks.values()).filter((t) => t.projectId === projectId);

  // Apply filters
  const filtered = projectTasks.filter((task) => {
    if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) return false;
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      if (!task.title.toLowerCase().includes(q) && !task.description.toLowerCase().includes(q)) return false;
    }
    if (filter.assigneeSessionIds.length > 0) {
      if (!task.sessionIds.some((sid) => filter.assigneeSessionIds.includes(sid))) return false;
    }
    if (!filter.showSubtasks && task.parentId) return false;
    return true;
  });

  return config.visibleStatuses.map((status) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    taskIds: filtered.filter((t) => t.status === status).map((t) => t.id),
    collapsed: config.collapsedStatuses.includes(status),
  }));
}

export function getTasksForColumn(projectId: string, status: TaskStatus): MaestroTask[] {
  const { tasks } = useMaestroStore.getState();
  return Array.from(tasks.values()).filter(
    (t) => t.projectId === projectId && t.status === status,
  );
}

// ---- Constants ----

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
};

function getDefaultTaskBoardConfig(projectId: string): TaskBoardConfig {
  return {
    projectId,
    visibleStatuses: ['todo', 'in_progress', 'in_review', 'completed'],
    collapsedStatuses: [],
  };
}

function getDefaultTaskBoardFilter(): TaskBoardFilter {
  return {
    priorities: [],
    searchQuery: '',
    assigneeSessionIds: [],
    showSubtasks: false,
  };
}
```

---

## 5. Integration Points

### 5.1 Reading from useSessionStore (Terminal Boards)

Terminal board panes reference `TerminalSession.id` from `useSessionStore`. Components render each leaf by looking up the session:

```typescript
// In a board pane component:
const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));
```

The board store does NOT duplicate session data. It only stores session IDs as references. This follows the same pattern as `useMaestroStore.sessions` referencing `taskIds`.

### 5.2 Reading from useMaestroStore (Task Boards)

Task board columns are **derived** from `useMaestroStore.tasks` via the `getTaskBoardColumns()` selector. The board store only stores configuration (which columns, filters, collapse state), not task data. This is the same pattern as how `useWorkspaceStore` stores view configuration but reads file data from elsewhere.

### 5.3 WebSocket Event Integration

The existing `useMaestroStore.handleMessage` already handles `task:created`, `task:updated`, `task:deleted` events by updating its `tasks` Map. Since task board columns are derived from that Map via selectors, WebSocket events automatically trigger re-renders in task board components that subscribe to `useMaestroStore.tasks`.

No changes to WebSocket handling are needed. Components using `getTaskBoardColumns()` will re-derive when the underlying task data changes.

### 5.4 View Mode Integration with useUIStore

The `viewModeByProject` state in `useBoardStore` determines which view is rendered. The main workspace area checks:

```typescript
// In the main layout component:
const viewMode = useBoardStore((s) => s.viewModeByProject[activeProjectId] ?? 'default');

switch (viewMode) {
  case 'default':
    return <DefaultWorkspace />;       // existing terminal + file explorer
  case 'terminal-board':
    return <TerminalBoardView />;      // split-pane board
  case 'task-board':
    return <TaskBoardView />;          // kanban board
}
```

This avoids modifying `useUIStore` or `useWorkspaceStore`. The view mode toggle can live in the project tab bar or a dedicated toolbar.

### 5.5 Persistence Strategy

**What persists (localStorage):**
- `viewModeByProject` -- which view each project was last using
- `terminalBoards` + `terminalBoardIdsByProject` + `activeTerminalBoardIdByProject` -- full board layout definitions
- `taskBoardConfigByProject` -- column visibility, order, collapse state
- `taskBoardFilterByProject` -- user's filter preferences

**What does NOT persist:**
- `taskBoardDragState` -- transient UI state, always null on load

**Persistence mechanism:** Follow the pattern in `persistence.ts`. Add a subscription to `useBoardStore` in `initCentralPersistence()`:

```typescript
// In persistence.ts, add to initCentralPersistence:
useBoardStore.subscribe(scheduleBoardSave);
```

Board state is saved to localStorage under key `maestro:board-state` with a debounce timer (same 400ms pattern as the main persistence).

```typescript
function buildBoardPersistedState(): PersistedBoardState {
  const {
    viewModeByProject,
    terminalBoards,
    terminalBoardIdsByProject,
    activeTerminalBoardIdByProject,
    taskBoardConfigByProject,
    taskBoardFilterByProject,
  } = useBoardStore.getState();

  return {
    schemaVersion: 1,
    viewModeByProject,
    terminalBoards: Object.fromEntries(terminalBoards),
    terminalBoardIdsByProject,
    activeTerminalBoardIdByProject,
    taskBoardConfigByProject,
    taskBoardFilterByProject,
  };
}
```

Board persistence uses `localStorage` (not the Tauri `invoke('save_persisted_state')` path) because board layout is UI-local state similar to workspace views. This matches how `useWorkspaceStore` persists via `initWorkspaceViewPersistence()` to localStorage.

### 5.6 Cleanup

**When a session closes:** The `removeSessionFromBoards` action scans all terminal boards and removes the closed session's leaf nodes (collapsing parent splits). Subscribe to session changes:

```typescript
// In initApp or a dedicated init function:
useSessionStore.subscribe((state, prevState) => {
  const closedIds = prevState.sessions
    .filter((s) => !state.sessions.some((ns) => ns.id === s.id))
    .map((s) => s.id);
  for (const id of closedIds) {
    useBoardStore.getState().removeSessionFromBoards(id);
  }
});
```

**When a project switches:** No cleanup needed -- board state is keyed by projectId, so switching projects just renders different data.

**When a project is deleted:** The `cleanupProject` action removes all boards and configs for that project:

```typescript
cleanupProject: (projectId) => {
  set((prev) => {
    const boardIds = prev.terminalBoardIdsByProject[projectId] ?? [];
    const boards = new Map(prev.terminalBoards);
    for (const id of boardIds) boards.delete(id);

    const { [projectId]: _v, ...viewModes } = prev.viewModeByProject;
    const { [projectId]: _b, ...boardIdsByProject } = prev.terminalBoardIdsByProject;
    const { [projectId]: _a, ...activeBoardByProject } = prev.activeTerminalBoardIdByProject;
    const { [projectId]: _c, ...taskConfigs } = prev.taskBoardConfigByProject;
    const { [projectId]: _f, ...taskFilters } = prev.taskBoardFilterByProject;

    return {
      terminalBoards: boards,
      viewModeByProject: viewModes,
      terminalBoardIdsByProject: boardIdsByProject,
      activeTerminalBoardIdByProject: activeBoardByProject,
      taskBoardConfigByProject: taskConfigs,
      taskBoardFilterByProject: taskFilters,
    };
  });
},
```

---

## 6. Initialization

Add to `initApp.ts` (or a new `initBoardStore.ts` called from initApp):

```typescript
// 1. Restore persisted board state from localStorage
function restoreBoardState() {
  try {
    const raw = localStorage.getItem('maestro:board-state');
    if (!raw) return;
    const persisted = JSON.parse(raw);
    if (persisted.schemaVersion !== 1) return;

    useBoardStore.setState({
      viewModeByProject: persisted.viewModeByProject ?? {},
      terminalBoards: new Map(Object.entries(persisted.terminalBoards ?? {})),
      terminalBoardIdsByProject: persisted.terminalBoardIdsByProject ?? {},
      activeTerminalBoardIdByProject: persisted.activeTerminalBoardIdByProject ?? {},
      taskBoardConfigByProject: persisted.taskBoardConfigByProject ?? {},
      taskBoardFilterByProject: persisted.taskBoardFilterByProject ?? {},
    });
  } catch {
    // best-effort
  }
}

// 2. Validate restored boards against live sessions
function validateBoardSessions() {
  const { sessions } = useSessionStore.getState();
  const sessionIds = new Set(sessions.map((s) => s.id));
  const { terminalBoards } = useBoardStore.getState();

  for (const [boardId, board] of terminalBoards) {
    const boardSessionIds = getBoardSessionIds(board);
    const orphaned = boardSessionIds.filter((id) => !sessionIds.has(id));
    for (const id of orphaned) {
      useBoardStore.getState().closePane(boardId, id);
    }
  }
}
```

---

## 7. File Organization

```
maestro-ui/src/
  app/types/
    board.ts              # All board-related type definitions
  stores/
    useBoardStore.ts      # The store implementation + selectors
  components/
    boards/
      TerminalBoardView.tsx      # Main terminal board component
      TerminalBoardPane.tsx      # Individual pane wrapper
      TerminalBoardSplitter.tsx  # Drag-to-resize splitter
      TaskBoardView.tsx          # Main kanban board component
      TaskBoardColumn.tsx        # Single kanban column
      TaskBoardCard.tsx          # Draggable task card
      TaskBoardFilter.tsx        # Filter controls
      BoardViewSwitcher.tsx      # Toggle between default/terminal-board/task-board
```

---

## 8. Data Flow Diagrams

### Terminal Board Data Flow

```
useSessionStore.sessions
        |
        | (sessionId references)
        v
useBoardStore.terminalBoards[id].layout (tree of LeafNode { sessionId })
        |
        v
  TerminalBoardView component
        |
        +-- recursively renders SplitNode -> two children
        +-- renders LeafNode -> <SessionTerminal sessionId={...} />
                                    |
                                    +-- reads session from useSessionStore
```

### Task Board Data Flow

```
useMaestroStore.tasks (Map<string, MaestroTask>)
        |
        | (derived via getTaskBoardColumns selector)
        v
useBoardStore.taskBoardConfigByProject[projectId] (column config)
useBoardStore.taskBoardFilterByProject[projectId] (filter criteria)
        |
        v
  getTaskBoardColumns(projectId) --> TaskBoardColumn[]
        |
        v
  TaskBoardView component
        |
        +-- renders each TaskBoardColumn
                |
                +-- renders TaskBoardCard for each taskId
                        |
                        +-- reads task from useMaestroStore.tasks
```

### WebSocket -> Task Board Re-render Flow

```
WebSocket message: { event: 'task:updated', data: { id, status, ... } }
        |
        v
useMaestroStore.handleMessage -> updates tasks Map
        |
        v
React components subscribed to useMaestroStore.tasks re-render
        |
        v
getTaskBoardColumns() re-derives columns with updated task positions
        |
        v
TaskBoardView reflects the change (task moves to new column)
```

---

## 9. Key Design Decisions

1. **Single store for both board types.** They share the same project-scoping pattern and lifecycle, so co-locating avoids store proliferation while keeping the interface cohesive.

2. **Binary tree for terminal layout.** A binary split tree naturally models recursive horizontal/vertical splits. Each split stores its own ratio, making resize operations local to a single node. This is the same model used by VS Code's editor groups and tmux.

3. **Derived task columns, not stored columns.** Task board columns are computed from `useMaestroStore.tasks` on every render. This avoids synchronization bugs between the board store and the task store. The board store only stores _configuration_ (which statuses to show, collapse state, filters).

4. **Session ID references, not session copies.** Terminal board panes store `sessionId` strings, not `TerminalSession` objects. Components look up the live session from `useSessionStore`. This prevents stale data and follows the existing pattern where `useWorkspaceStore` references project IDs rather than embedding project data.

5. **localStorage persistence (not Tauri state).** Board layout is UI-local state similar to workspace views. It does not need encryption or cross-device sync, so localStorage is appropriate. This matches `useWorkspaceStore`'s persistence approach via `initWorkspaceViewPersistence()`.

6. **No WebSocket changes needed.** The existing WebSocket handler in `useMaestroStore` already updates the `tasks` Map on `task:created/updated/deleted` events. Since task board columns are derived from that Map, they automatically reflect real-time changes without any additional plumbing.
