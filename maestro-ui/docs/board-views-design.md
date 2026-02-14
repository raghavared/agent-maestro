# Board Views Design Document

> **Scope:** UI-only feature. No backend or CLI changes. Uses existing server REST APIs and WebSocket events.

---

## 1. Feature Overview

Board Views adds two new workspace modes to Maestro UI:

1. **Terminal Board** — A split-pane terminal multiplexer (like tmux/iTerm2) where multiple terminal sessions are arranged in a single board with resizable splits.
2. **Task Board** — A kanban-style status board showing Maestro tasks organized by status, with live real-time updates as agents run.

Both views replace the main workspace area and are accessed via a **View Switcher** component. The existing single-terminal view remains the default.

---

## 2. UX Design

### 2.1 View Switcher

The workspace area gains a view mode toggle in the top-left corner:

```
[ > Terminal ]  [ :: Split Board ]  [ = Task Board ]
```

- Rendered as a segmented control, `JetBrains Mono` 11px uppercase
- Active segment: `background: rgba(var(--theme-primary-rgb), 0.12)`, `color: var(--theme-primary)`, left-accent bar
- Inactive: `color: rgba(var(--theme-primary-rgb), 0.5)`
- Per-project state — each project remembers its last active view mode

### 2.2 Terminal Board — User Flows

#### Creating a Board
1. Switch to "Split Board" view
2. Click "Board" dropdown → "+ New Board"
3. Enter name (defaults to "Board 1")
4. Board created with single pane containing the active session (or empty)

#### Splitting Panes
- **Toolbar:** Focus a pane → click `[| Split H]` or `[-- Split V]`
- **Keyboard:** `Cmd+Shift+\` (vertical), `Cmd+Shift+-` (horizontal)
- **Right-click:** Context menu on pane border
- Max split depth: 3 levels (up to 8 panes)
- New panes start empty with a session selector

#### Assigning Sessions to Panes
- **Dropdown selector** in empty panes listing project sessions
- **Drag from sidebar** — drag a session from the sessions list into a pane
- Sessions can only appear in one pane at a time (dragging moves, not duplicates)

#### Resizing Panes
- Draggable dividers between panes (matches existing `ResizeHandle` pattern)
- Minimum pane: 120px width, 80px height
- Double-click divider to reset to 50/50

#### Removing a Pane
- Focus pane → `[x Close Pane]` or `Cmd+Shift+W`
- Session is NOT closed — returns to sidebar as normal session
- Sibling pane expands to fill space

#### Focus Management

| Action | Behavior |
|--------|----------|
| Click on pane | Focuses that pane |
| `Cmd+Option+Arrow` | Moves focus directionally |
| New split created | New pane gets focus |
| Closing a pane | Focus moves to sibling |

Focused pane shows accent-colored border glow (`--theme-primary` at 30% opacity).

#### Board Management
- Boards scoped per project, listed in dropdown
- Right-click: Rename, Duplicate, Delete
- Max 10 boards per project (soft limit)
- Layouts persist across restarts via localStorage

### 2.3 Task Board — User Flows

#### Column Layout

| Column | Statuses | Header |
|--------|----------|--------|
| Backlog | `todo` | BACKLOG |
| Blocked | `blocked` | BLOCKED |
| In Progress | `in_progress` | IN PROGRESS |
| Review | `in_review` | REVIEW |
| Done | `completed`, `cancelled` | DONE |

5 columns, ordered left-to-right following workflow progression. `completed` + `cancelled` grouped under "Done" (cancelled shows strikethrough).

#### Task Cards

```
┌──────────────────────────────┐
│ Fix login race condition     │  ← title (max 2 lines)
│                              │
│ HIGH   claude   3m ago       │  ← priority | agent | time
│ ◉ WORKING                   │  ← session status chips
└──────────────────────────────┘
```

Card visual states:
- **Active sessions**: left border accent `var(--theme-primary)` 2px + pulsing live dot
- **Blocked**: left border `#ef4444` 2px
- **Completed**: reduced opacity (0.6)
- **Cancelled**: reduced opacity (0.4) + strikethrough title

#### Live Updates
Tasks update in real-time via existing WebSocket. Transitions:
- **Card moves column**: Slide out (300ms) → slide in (300ms), FLIP technique
- **New task**: Fade in + slide down (200ms)
- **Deleted**: Fade out + scale to 0.95 (200ms)
- **Status flash**: Brief border flash in theme-primary (150ms)
- Rapid updates debounced (batch within 100ms)

#### Interactions
- **Click card**: Opens existing task detail modal
- **Drag between columns**: Changes task status via `updateTask()` API
- **Filter bar**: Priority, Agent, text search (debounced 200ms)
- **Column collapse**: Click header to collapse to thin strip with count badge
- **Keyboard**: `N` new task, arrows navigate, Enter opens detail, Esc deselects

### 2.4 Responsive Behavior

At `< 960px` (existing breakpoint):
- **Terminal Board**: Falls back to showing focused pane as single terminal
- **Task Board**: Columns stack with horizontal tab strip to select column
- View switcher hidden in mobile mode

---

## 3. UI Design

### 3.1 Design System Integration

All components use existing CSS custom properties:

```
Background layers:  --bg (#0a0e16) > --panel (#10151e) > --panel-2 (#111820)
Borders:            --border (rgba 255,255,255,0.08)
Text:               --text (#f0f4f8), --muted (rgba 240,244,248,0.7)
Theme-dynamic:      --theme-primary, --theme-primary-dim, --theme-primary-rgb
Typography:         JetBrains Mono for all UI chrome
Radius:             --radius-control (6px)
```

Works across all 6 theme variants (green, blue, purple, amber, cyan, rose).

### 3.2 Terminal Board Components

#### Board Toolbar (40px height)
```css
.boardToolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 40px;
  background: var(--panel);
  border-bottom: 1px solid var(--theme-border);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
```

Buttons: `[+ Add]` `[| Split H]` `[-- Split V]` `[Layouts v]` — follow existing `terminalCmd` pattern.

#### Split Resize Handles
```css
.splitResizeHandle {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
}

.splitResizeHandle::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0; left: 2px;
  width: 2px;
  background: var(--theme-border);
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.splitResizeHandle:hover::after {
  background: var(--theme-primary);
  box-shadow: 0 0 8px rgba(var(--theme-primary-rgb), 0.4);
}
```

#### Pane Header (28px height)
Minimal bar with session name, status dot, close button. Empty panes show a session selector dropdown.

### 3.3 Task Board Components

#### Kanban Columns
```css
.kanbanColumns {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  flex: 1;
  overflow-x: auto;
  scrollbar-color: rgba(var(--theme-primary-rgb), 0.15) transparent;
}

.kanbanColumn {
  min-width: 280px;
  max-width: 320px;
  flex: 1 0 280px;
  background: rgba(var(--theme-primary-rgb), 0.02);
  border: 1px solid var(--theme-border);
}
```

#### Column Headers
- Status dot (color-coded, pulsing for `in_progress`)
- Uppercase label, `JetBrains Mono` 11px
- Count badge: monospace, theme-primary accent

Status colors:
| Status | Color | Effect |
|--------|-------|--------|
| Todo | `var(--theme-text-dim)` | none |
| In Progress | `#00d9ff` (cyan) | glow + pulse animation |
| In Review | `#a855f7` (purple) | glow |
| Completed | `var(--theme-primary)` | glow |

#### Task Cards
```css
.taskCard {
  background: var(--panel);
  border: 1px solid var(--theme-border);
  padding: 10px 12px;
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

.taskCard:hover {
  border-color: rgba(var(--theme-primary-rgb), 0.3);
  box-shadow: 0 0 8px rgba(var(--theme-primary-rgb), 0.1);
  transform: translateY(-1px);
}
```

Priority stripe (left edge, 3px):
- **High**: `#ff6464` + glow
- **Medium**: `#ffb000` + glow
- **Low**: `rgba(var(--theme-primary-rgb), 0.3)`

#### Live Status Indicator
```css
.taskCardLiveStatus--active {
  background: #00d9ff;
  box-shadow: 0 0 6px #00d9ff;
  animation: taskLivePulse 2s ease-in-out infinite;
}
```

#### Transition Animations
- Cards entering: `opacity 0→1, translateY -8px→0` (300ms ease-out)
- Cards exiting: `opacity 1→0, scale 1→0.95` (300ms ease-in)
- All animations use `transform` + `opacity` only (GPU composited)

#### Loading Skeletons
Shimmer effect using `translateX` transform animation over skeleton lines.

#### Empty States
Terminal aesthetic — ASCII-art boxes with `$ action` buttons, `JetBrains Mono`, `var(--theme-text-dim)`.

### 3.4 Board Header (Task Board, 48px)
Title (`TASK BOARD`, theme-primary, uppercase) + filter chips (reuses `TaskFilters` pattern) + board stats (active/pending/review/done dot counts).

---

## 4. State Management

### 4.1 New Store: `useBoardStore`

Single Zustand store managing both board types.

#### Types

```typescript
// ── Layout Tree ──
export type SplitDirection = 'horizontal' | 'vertical';

export interface LeafNode {
  type: 'leaf';
  sessionId: string;  // References TerminalSession.id
}

export interface SplitNode {
  type: 'split';
  direction: SplitDirection;
  ratio: number;  // 0.0-1.0, position of divider
  children: [LayoutNode, LayoutNode];
}

export type LayoutNode = LeafNode | SplitNode;

// ── Terminal Board ──
export interface TerminalBoard {
  id: string;
  projectId: string;
  name: string;
  layout: LayoutNode;
  activePaneSessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

// ── Task Board ──
export interface TaskBoardConfig {
  projectId: string;
  visibleStatuses: TaskStatus[];
  collapsedStatuses: TaskStatus[];
}

export interface TaskBoardColumn {
  status: TaskStatus;
  label: string;
  taskIds: string[];
  collapsed: boolean;
}

export interface TaskBoardDragState {
  taskId: string;
  sourceStatus: TaskStatus;
  targetStatus: TaskStatus | null;
}

export interface TaskBoardFilter {
  priorities: TaskPriority[];
  searchQuery: string;
  assigneeSessionIds: string[];
  showSubtasks: boolean;
}

export type BoardViewMode = 'default' | 'terminal-board' | 'task-board';
```

#### Store Interface

```typescript
interface BoardState {
  // View mode (per project)
  viewModeByProject: Record<string, BoardViewMode>;
  setViewMode: (projectId: string, mode: BoardViewMode) => void;

  // Terminal Boards
  terminalBoards: Map<string, TerminalBoard>;
  terminalBoardIdsByProject: Record<string, string[]>;
  activeTerminalBoardIdByProject: Record<string, string | null>;

  createTerminalBoard: (projectId: string, name: string) => string;
  deleteTerminalBoard: (boardId: string) => void;
  renameTerminalBoard: (boardId: string, name: string) => void;
  setActiveTerminalBoard: (projectId: string, boardId: string | null) => void;

  // Layout mutations
  setLayout: (boardId: string, layout: LayoutNode) => void;
  setSplitRatio: (boardId: string, path: number[], ratio: number) => void;
  splitPane: (boardId: string, sessionId: string, direction: SplitDirection, newSessionId: string) => void;
  closePane: (boardId: string, sessionId: string) => void;
  setActivePaneSessionId: (boardId: string, sessionId: string | null) => void;

  // Task Board
  taskBoardConfigByProject: Record<string, TaskBoardConfig>;
  taskBoardDragState: TaskBoardDragState | null;
  taskBoardFilterByProject: Record<string, TaskBoardFilter>;

  setTaskBoardConfig: (projectId: string, config: Partial<TaskBoardConfig>) => void;
  toggleColumnCollapse: (projectId: string, status: TaskStatus) => void;
  setTaskBoardDragState: (state: TaskBoardDragState | null) => void;
  setTaskBoardFilter: (projectId: string, filter: Partial<TaskBoardFilter>) => void;
  moveTask: (projectId: string, taskId: string, targetStatus: TaskStatus) => Promise<void>;

  // Cleanup
  removeSessionFromBoards: (sessionId: string) => void;
  cleanupProject: (projectId: string) => void;
}
```

### 4.2 Key Design Decisions

1. **Binary tree for terminal layout** — Naturally models recursive H/V splits. Each split stores its own ratio. Same model as VS Code editor groups and tmux.

2. **Derived task columns, not stored** — `getTaskBoardColumns()` computes columns from `useMaestroStore.tasks` on every render. Avoids sync bugs. Store only holds configuration.

3. **Session ID references, not copies** — Panes store `sessionId` strings. Components look up live session from `useSessionStore`. Prevents stale data.

4. **No WebSocket changes needed** — Existing `task:created/updated/deleted` handlers in `useMaestroStore` already update the tasks Map. Derived columns auto-reflect changes.

5. **localStorage persistence** — Board layout is UI-local state. Persisted under key `maestro:board-state` with 400ms debounce (matches existing pattern).

### 4.3 Derived Selectors

```typescript
// Terminal Board
getTerminalBoardsForProject(projectId): TerminalBoard[]
getActiveTerminalBoard(): TerminalBoard | null
getBoardSessionIds(board): string[]
getViewModeForProject(projectId): BoardViewMode

// Task Board (derives from useMaestroStore.tasks)
getTaskBoardColumns(projectId): TaskBoardColumn[]
getTasksForColumn(projectId, status): MaestroTask[]
```

### 4.4 Integration Points

| Integration | Mechanism |
|-------------|-----------|
| Read sessions | `useSessionStore.sessions` via sessionId references |
| Read tasks | `useMaestroStore.tasks` via `getTaskBoardColumns()` selector |
| WebSocket updates | Existing `handleMessage` in `useMaestroStore` → tasks Map update → columns re-derive |
| View mode switch | `viewModeByProject` in `useBoardStore`, checked in AppWorkspace |
| Session cleanup | Subscribe to `useSessionStore`, call `removeSessionFromBoards` on close |
| Project cleanup | `cleanupProject` removes all boards/configs for deleted project |
| Persistence | `useBoardStore.subscribe(scheduleBoardSave)` in `initCentralPersistence()` |

### 4.5 Data Flow

**Terminal Board:**
```
useSessionStore.sessions
    ↓ (sessionId references)
useBoardStore.terminalBoards[id].layout (binary tree of LeafNode)
    ↓
TerminalBoardView → recursive SplitNode render → LeafNode → <SessionTerminal>
```

**Task Board:**
```
useMaestroStore.tasks (via WebSocket)
    ↓ (derived via getTaskBoardColumns)
useBoardStore.taskBoardConfigByProject (column config + filters)
    ↓
TaskBoardView → KanbanColumn[] → TaskCard[]
```

---

## 5. Component Architecture

### 5.1 Component Tree

```
AppWorkspace
  ├── WorkspaceViewSwitcher
  │
  ├── (viewMode === 'default')
  │   └── [existing terminal + code editor]
  │
  ├── (viewMode === 'terminal-board')
  │   └── TerminalBoardView
  │       ├── BoardToolbar
  │       │   ├── ToolbarButton (add/split-h/split-v)
  │       │   ├── LayoutPresetMenu
  │       │   └── PaneCountIndicator
  │       └── SplitContainer (recursive)
  │           ├── SplitPane
  │           │   ├── PaneHeader (session name / selector)
  │           │   └── SessionTerminal (existing, reused)
  │           ├── ResizeHandle
  │           └── SplitPane ...
  │
  └── (viewMode === 'task-board')
      └── TaskBoardView
          ├── BoardHeader
          │   ├── BoardTitle
          │   ├── FilterBar (priority/agent/search chips)
          │   └── BoardStats (active/pending/done counts)
          └── KanbanColumns (horizontal scroll)
              └── KanbanColumn
                  ├── ColumnHeader (status dot + title + count)
                  ├── ColumnBody (scrollable)
                  │   ├── TaskCard (draggable)
                  │   │   ├── CardPriorityStripe
                  │   │   ├── CardTitle
                  │   │   ├── CardMeta (agent + time)
                  │   │   └── LiveStatusDot
                  │   └── TaskCardSkeleton (loading)
                  └── ColumnFooter (+ add task)
```

### 5.2 File Organization

```
maestro-ui/src/
  app/types/
    board.ts                      # All board-related type definitions
  stores/
    useBoardStore.ts              # Store + selectors
  components/
    boards/
      WorkspaceViewSwitcher.tsx   # View mode toggle
      TerminalBoardView.tsx       # Terminal board container
      TerminalBoardPane.tsx       # Individual pane wrapper
      TerminalBoardSplitter.tsx   # Drag-to-resize splitter
      BoardToolbar.tsx            # Terminal board toolbar
      TaskBoardView.tsx           # Kanban board container
      TaskBoardColumn.tsx         # Single kanban column
      TaskBoardCard.tsx           # Draggable task card
      TaskBoardFilter.tsx         # Filter controls
```

---

## 6. Integration with Existing Codebase

### 6.1 AppWorkspace Changes

The existing `AppWorkspace.tsx` currently renders the terminal pane and code editor. It gains a `viewMode` check:

```typescript
const viewMode = useBoardStore(s => s.viewModeByProject[activeProjectId] ?? 'default');

switch (viewMode) {
  case 'default':     return <DefaultWorkspace />;     // existing behavior
  case 'terminal-board': return <TerminalBoardView />;
  case 'task-board':     return <TaskBoardView />;
}
```

### 6.2 Sidebar Behavior
- **Terminal mode**: Sessions list (no change)
- **Split Board mode**: Sessions list + sessions can be dragged into panes
- **Task Board mode**: Sessions list unchanged; right panel can optionally collapse

### 6.3 Existing Components Reused
- `SessionTerminal` — mounted inside terminal board panes (no changes needed)
- `TaskFilters` pattern — reused for kanban filter bar
- `ResizeHandle` pattern — extended for split pane dividers
- `CreateTaskModal` — opens on card click for task detail
- `terminalCmd` / `terminalCmdPrimary` CSS classes — reused for toolbar buttons
- Empty state ASCII art pattern — reused for empty boards

### 6.4 No Backend Changes Required
- Terminal sessions: Created/managed via existing `sessionService.createSession()` → Tauri invoke
- Task CRUD: Via existing `MaestroClient` REST API
- Live updates: Via existing WebSocket in `useMaestroStore`
- Task status changes (drag): Via existing `updateTask()` API call

---

## 7. Implementation Plan

### Phase 1 — Foundation
1. Add `board.ts` types
2. Implement `useBoardStore` with persistence
3. Create `WorkspaceViewSwitcher` component
4. Wire view mode into `AppWorkspace`

### Phase 2 — Terminal Board (Core)
5. `TerminalBoardView` with recursive `SplitContainer`
6. `BoardToolbar` with split/add controls
7. Pane resize handles
8. Session assignment dropdown in empty panes
9. Focus management (click + keyboard)

### Phase 3 — Terminal Board (Polish)
10. Drag sessions from sidebar to panes
11. Layout presets (2-col, 3-col, 2x2 grid)
12. Board CRUD (create, rename, delete)
13. Responsive fallback

### Phase 4 — Task Board (Core)
14. `TaskBoardView` with kanban column layout
15. `TaskBoardCard` with priority stripe + live status dot
16. `getTaskBoardColumns()` selector wired to `useMaestroStore`
17. Filter bar (priority, agent, search)

### Phase 5 — Task Board (Polish)
18. Drag-and-drop between columns (status change)
19. Column transition animations (FLIP technique)
20. Column collapse/expand
21. Loading skeletons + empty states
22. Keyboard navigation

---

## Appendix: Accessibility

### Terminal Board
- Panes: `role="region"` with `aria-label="Terminal pane N"`
- Dividers: `role="separator"` with `aria-orientation`, `aria-valuemin/max/now`
- Focus ring visible on keyboard navigation

### Task Board
- Columns: `role="list"`, cards: `role="listitem"`
- Drag-and-drop keyboard alternative: select card → `M` for move mode → arrows → Enter
- Live status changes: `aria-live="polite"` region
- All text meets WCAG AA contrast against `--panel`/`--bg` backgrounds
