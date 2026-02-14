# UX Design: Board Views for Maestro UI

## Overview

This document defines UX patterns for two new board views in Maestro UI: a **Terminals Board** (split-pane terminal multiplexer) and a **Tasks Board** (kanban-style task status board). Both views live in the main workspace area where a single terminal is currently displayed.

---

## 1. Terminals Board View

### 1.1 Concept

A board is a named layout of multiple terminal sessions arranged in split panes within the main workspace area. It replaces the current single-terminal view when active, similar to how tmux or iTerm2 split panes work.

### 1.2 Data Model

```
Board {
  id: string
  name: string
  projectId: string
  layout: LayoutNode        // recursive split tree
  activePane: string | null // currently focused pane id
  createdAt: number
  updatedAt: number
}

LayoutNode =
  | { type: 'leaf', paneId: string, sessionId: string | null }
  | { type: 'split', direction: 'horizontal' | 'vertical',
      ratio: number,  // 0.0-1.0, position of divider
      first: LayoutNode, second: LayoutNode }
```

- **Maximum split depth**: 3 levels (produces up to 8 panes). Beyond this, splitting is disabled on deeper nodes -- prevents unusably small terminals.
- **Ratio**: Stored as a float 0.0-1.0 representing the divider position. Default is 0.5 (equal split).

### 1.3 View Switcher

The workspace area gains a small view mode indicator in the top-left corner of the terminal area:

```
  [Terminal]  [Board v]
```

- **Terminal**: Current single-session view (default).
- **Board**: Dropdown that lists saved boards for the active project, plus "+ New Board".
- Selecting a board enters board mode. The single-terminal view is replaced by the board layout.
- When in board mode, a thin board toolbar appears at the top of the workspace:

```
  Board: "my-layout"  |  [+ Split H]  [+ Split V]  [x Close Pane]  |  Panes: 3
```

### 1.4 User Flows

#### Creating a Board

1. User clicks the "Board" dropdown in the view switcher.
2. Selects "+ New Board".
3. A prompt asks for a name (inline text input, defaults to "Board 1").
4. Board is created with a single pane containing the currently active session (or empty if none).
5. Workspace switches to board mode.

#### Splitting a Pane

Two methods:

**Method A -- Toolbar buttons:**
1. Focus a pane (click on it).
2. Click [+ Split H] (horizontal) or [+ Split V] (vertical) in the board toolbar.
3. The focused pane splits. The new pane starts empty (shows "Drop a session or press Enter to create one").

**Method B -- Keyboard shortcut (power users):**
- `Cmd+Shift+\` -- Split vertically
- `Cmd+Shift+-` -- Split horizontally
- These mirror common terminal multiplexer conventions.

**Method C -- Right-click context menu on pane border:**
- "Split Left/Right" or "Split Top/Bottom"

#### Assigning a Session to a Pane

When a pane is empty, it shows a minimal UI:

```
  ┌─────────────────────────────┐
  │                             │
  │   [ Select Session  v ]    │
  │                             │
  │   or drag a session here   │
  │                             │
  └─────────────────────────────┘
```

- **Dropdown**: Lists all sessions from the sidebar for the current project. Selecting one attaches the session's terminal to this pane.
- **Drag from sidebar**: User can drag a session from the sidebar sessions list and drop it onto a pane.
- A session can only appear in one pane at a time within a board. If dragged to a new pane, it moves (swaps if the target pane already has a session).

#### Removing a Pane

1. Focus the pane.
2. Click [x Close Pane] in toolbar, or press `Cmd+Shift+W` while in board mode.
3. The pane is removed. Its sibling expands to fill the space.
4. The session is NOT closed -- it returns to the sidebar as a normal session.
5. If only one pane remains, the board stays in board mode with a single pane.

#### Resizing Panes

- Dividers between panes are draggable, matching the existing `ResizeHandle` pattern used for sidebar/right-panel.
- Minimum pane dimension: 120px width, 80px height.
- Double-click a divider to reset to 50/50 split.
- During resize, a subtle overlay prevents terminal mouse events from capturing the pointer (same pattern as `workspaceResizing` class).

### 1.5 Focus Management

**Focus** determines which pane receives keyboard input. The focused pane has a subtle accent-colored border glow (using `--theme-primary` at 30% opacity).

| Action | Behavior |
|--------|----------|
| Click on a pane | Focuses that pane |
| `Ctrl+Arrow` (or `Cmd+Option+Arrow` on macOS) | Moves focus in the arrow direction |
| Tab through panes | Not used (Tab is meaningful in terminals) |
| Creating a new split | New pane gets focus |
| Closing a pane | Focus moves to sibling |

Focus movement wraps: pressing Right on the rightmost pane wraps to the leftmost pane in the same row.

### 1.6 Board Management

- Boards are listed in the view switcher dropdown, scoped to the active project.
- Right-clicking a board name in the dropdown shows: Rename, Duplicate, Delete.
- Board layouts persist across app restarts (stored in the workspace store, persisted to localStorage keyed by `board:{projectId}:{boardId}`).
- Maximum boards per project: 10 (soft limit, shows a warning).

### 1.7 Visual Design

- Pane borders: 1px solid `var(--border)`, same as existing panel borders.
- Focused pane: border changes to `rgba(var(--theme-primary-rgb), 0.3)` with a subtle `box-shadow: 0 0 8px rgba(var(--theme-primary-rgb), 0.15)`.
- Divider handles: 4px wide/tall grab area, same style as `sidebarRightResizeHandle`.
- Empty pane: dark background (`var(--panel)`), centered placeholder text in `var(--muted)`.
- Board toolbar: same height and style as `terminalCommandBar` (~32px), uses `var(--panel-2)` background.

### 1.8 Responsive Behavior

- In mobile/responsive mode (window < 960px), boards are disabled. The view switcher does not appear. Users see only the single terminal view.
- If a board is active when the window shrinks below breakpoint, the app falls back to showing the board's focused pane as a single terminal.

---

## 2. Tasks Board View (Kanban)

### 2.1 Concept

A kanban-style board view that shows tasks as cards organized into columns by status. This provides a spatial overview of all tasks in a project, complementing the existing list-based MaestroPanel. It is accessed from a tab/toggle within the right panel, or can be popped out into the main workspace area.

### 2.2 Column Layout

The existing `TaskStatus` type defines: `todo`, `in_progress`, `in_review`, `completed`, `cancelled`, `blocked`.

**Column grouping strategy:**

| Column | Statuses Included | Header Label |
|--------|-------------------|-------------|
| Backlog | `todo` | BACKLOG |
| Blocked | `blocked` | BLOCKED |
| In Progress | `in_progress` | IN PROGRESS |
| Review | `in_review` | REVIEW |
| Done | `completed`, `cancelled` | DONE |

**Rationale:**
- 5 columns fit well in the workspace width without horizontal scrolling.
- `completed` and `cancelled` are grouped under "Done" since both represent terminal states. Cancelled items show a strikethrough style to differentiate.
- `blocked` gets its own column (instead of being grouped with backlog) because blocked tasks need visibility -- they indicate something is wrong.
- Columns are ordered left-to-right following the typical workflow progression.

### 2.3 Card Design

Each task card is compact but information-dense:

```
  ┌──────────────────────────────┐
  │ Fix login race condition     │  <- title (truncated at 2 lines)
  │                              │
  │ HIGH   claude   3m ago       │  <- priority | agent | time
  │ ◉ WORKING  ◉ WORKING        │  <- session status chips (if any)
  └──────────────────────────────┘
```

**Card elements:**

| Element | Position | Details |
|---------|----------|---------|
| Title | Top, bold | Max 2 lines, ellipsis overflow. Font: JetBrains Mono 12px |
| Priority badge | Bottom-left | Colored: HIGH=`#ef4444`, MED=`var(--theme-primary-dim)`, LOW=`var(--muted)` |
| Agent indicator | Bottom-center | Shows agent tool icon if assigned (e.g., claude/codex/gemini icon) |
| Time | Bottom-right | `formatTimeAgo()` from existing code |
| Session status chips | Below meta row | Reuses existing `terminalSessionStatusChip` pattern, with breathing animation for `working` |
| Subtask progress | Right of title | Small `2/5` counter if task has subtasks |
| Pin indicator | Top-right corner | Small dot if `task.pinned === true` |

**Card colors:**
- Default card background: `var(--panel-2)`
- Cards with active sessions (working): left border accent `var(--theme-primary)` 2px
- Blocked cards: left border `#ef4444` 2px
- Completed cards: reduced opacity (0.6)
- Cancelled cards: reduced opacity (0.4), title has strikethrough

### 2.4 Live Updates

Tasks update in real-time via the existing WebSocket connection (already handled by `useMaestroWebSocket` and the `useMaestroStore`).

**Transition animations:**

| Transition | Animation |
|-----------|-----------|
| Card moves to new column | Card slides out of source column (300ms ease-out), slides into target column (300ms ease-in). Uses FLIP technique. |
| New task created | Card fades in from transparent + slides down from -10px (200ms) |
| Task deleted | Card fades out + scales to 0.95 (200ms) |
| Status change (same column) | Brief flash of the card border in `var(--theme-primary)` (150ms) |

**Implementation approach:**
- Use `useLayoutEffect` to capture card positions before update (FLIP pattern), same as `ProjectTabBar` already does for tab reordering.
- The existing `slidingOutTasks` pattern in `MaestroPanel.tsx` can be extended for cross-column movement.
- Debounce rapid updates: if multiple status changes arrive within 100ms, batch the animations.

### 2.5 Interactions

#### Click to Expand

Clicking a card opens the existing `CreateTaskModal` in edit mode (the detail view), same behavior as clicking a task in the list view. This reuses existing UI without building new components.

#### Drag Between Columns

- Cards can be dragged between columns to change status.
- Use the same pointer-capture drag pattern as `ProjectTabBar` (no external library needed).
- While dragging, the source card becomes semi-transparent (opacity 0.5) and a drop indicator line appears between cards in the target column.
- Dropping a card onto a column updates `task.status` via `updateTask()`.
- Certain transitions may not be allowed (e.g., dragging to "Done" should trigger a confirmation if the task has in-progress sessions).
- Drag is disabled for completed/cancelled tasks (they can only be moved via the detail modal status picker).

#### Filter and Search

A filter bar sits above the columns (reuses `TaskFilters` component pattern):

```
  [Priority: All v]  [Agent: All v]  [Search: ________]  |  [List View]  [Board View]
```

- Priority filter: All / High / Medium / Low
- Agent filter: All / claude / codex / gemini
- Text search: filters cards by title substring (debounced 200ms)
- View toggle: switches between the existing list view and kanban board view

#### Collapse/Expand Columns

- Clicking a column header collapses it to a thin vertical strip showing just the count badge.
- Useful when a user wants to focus on specific workflow stages.
- Collapsed state persists per board.

### 2.6 Empty States

**Empty column:**
```
  ┌─────────────┐
  │  IN PROGRESS │
  │    (0)       │
  │              │
  │   No tasks   │
  │              │
  └─────────────┘
```
- Column header + count "0" remains visible.
- Muted text: "No tasks" centered in the column body.
- Column still accepts drops.

**Empty board (no tasks at all):**
```
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║        NO TASKS IN QUEUE              ║
  ║                                       ║
  ║        $ maestro new task             ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
```
- Reuses existing ASCII art empty state from `MaestroPanel`.
- Primary action button: `$ new task`.

### 2.7 Board Placement

The kanban view is available in two locations:

**Option A -- Inside the right panel (default):**
- The existing `MaestroPanel` tabs (`Tasks | Pinned | Completed`) gain a view toggle in the command bar area.
- When "Board View" is selected, the list is replaced by a horizontal-scrolling kanban within the right panel.
- Since the right panel may be narrow (~300px), columns stack horizontally with horizontal scroll. Each column is ~200px min-width.

**Option B -- Full workspace (recommended for active use):**
- A button in the right panel header: "Pop out to workspace".
- This replaces the terminal area with the kanban board (similar to how a Board view replaces the terminal).
- The view switcher becomes: `[Terminal] [Board v] [Tasks Board]`.

### 2.8 Visual Design

- Column background: `var(--bg)` (darkest)
- Column header: Uppercase, `var(--theme-text)`, border-bottom `var(--border)`
- Column header count badge: monospace, `var(--theme-primary-dim)`
- Card background: `var(--panel-2)`
- Card border: 1px solid `var(--border)`
- Card hover: border changes to `var(--border)` at higher opacity (0.15)
- Card shadow: none (flat design, matches terminal aesthetic)
- Spacing: 8px gap between cards, 12px column padding
- Column width: flexible, minimum 180px, maximum 280px, equally distributed
- Card width: 100% of column minus padding
- Font: JetBrains Mono throughout (inherits from app)

### 2.9 Keyboard Shortcuts (Tasks Board)

| Shortcut | Action |
|----------|--------|
| `N` | Create new task (when board is focused, not in a text input) |
| `Arrow keys` | Navigate between cards |
| `Enter` | Open selected card detail |
| `Esc` | Close detail / deselect card |

---

## 3. Integration with Existing Layout

### 3.1 Current Architecture

```
┌──────────────────────────────────────────────────────┐
│ ProjectTabBar                                         │
├──────────┬──────────────────────┬────────────────────┤
│ Sidebar  │ Main Workspace       │ Right Panel        │
│ (sessions│ (AppWorkspace.tsx)   │ (MaestroPanel)     │
│  list)   │                      │                    │
│          │ Currently:           │ Currently:         │
│          │ - terminalPane       │ - Task list        │
│          │ - codeEditorPanel    │ - Filters          │
│          │                      │ - Execution bar    │
├──────────┴──────────────────────┴────────────────────┤
│ CommandPalette (overlay)                              │
└──────────────────────────────────────────────────────┘
```

### 3.2 Proposed Changes

The `AppWorkspace` component gains a `viewMode` concept:

```typescript
type WorkspaceViewMode = 'terminal' | 'terminal-board' | 'tasks-board';
```

- `terminal` (default): Current behavior -- single session + optional code editor.
- `terminal-board`: Shows the split-pane terminal board layout.
- `tasks-board`: Shows the kanban task board in the full workspace area.

The `viewMode` is stored per-project in the workspace store.

### 3.3 View Switcher Component

A `WorkspaceViewSwitcher` component appears in the top-left of the workspace:

```
  [ > Terminal ]  [ :: Boards v ]  [ = Tasks ]
```

- Monospace, minimal, uses theme colors.
- Active view has an underline in `var(--theme-primary)`.
- "Boards" has a dropdown for selecting/creating boards.
- Fits within the existing `terminalArea` div, positioned absolutely at top.

### 3.4 State Management

New additions to `useWorkspaceStore`:

```typescript
// Per-project board data
boards: Record<string, Board[]>           // projectId -> boards
activeBoardId: Record<string, string>     // projectId -> active board id
workspaceViewMode: Record<string, WorkspaceViewMode>  // projectId -> view mode

// Kanban view state (per-project)
kanbanCollapsedColumns: Record<string, Set<string>>   // projectId -> collapsed column names
kanbanFilter: Record<string, KanbanFilter>            // projectId -> active filters
```

Persistence: stored in localStorage alongside existing workspace view data.

---

## 4. Accessibility

### 4.1 Terminals Board
- All panes have `role="region"` with `aria-label="Terminal pane N"`.
- Dividers have `role="separator"` with appropriate ARIA attributes (matches existing `ResizeHandle` pattern).
- Focus ring visible on keyboard navigation (matches existing terminal focus behavior).

### 4.2 Tasks Board
- Columns have `role="list"`, cards have `role="listitem"`.
- Drag-and-drop has keyboard alternative: select card, press `M` to enter move mode, arrow keys to choose target column, Enter to confirm.
- Screen reader announcements for live task status changes using `aria-live="polite"` region.
- All interactive elements have visible focus indicators.

---

## 5. Implementation Priority

### Phase 1 -- Terminal Board (Core)
1. Layout data model + workspace store additions
2. View switcher component
3. Split-pane renderer with recursive `LayoutNode`
4. Pane resize handles
5. Session assignment (dropdown)
6. Board CRUD (create, rename, delete)
7. Keyboard focus management

### Phase 2 -- Terminal Board (Polish)
8. Drag session from sidebar to pane
9. Pane swap via drag
10. Board persistence to localStorage
11. Responsive mode fallback

### Phase 3 -- Tasks Board (Core)
12. Kanban column layout component
13. Task card component
14. Drag-and-drop between columns
15. Live update animations (FLIP)
16. Filter bar integration

### Phase 4 -- Tasks Board (Polish)
17. Column collapse/expand
18. Pop-out to workspace mode
19. Keyboard navigation
20. Empty states and transitions

---

## 6. Component Hierarchy

### Terminals Board

```
AppWorkspace
  WorkspaceViewSwitcher
  TerminalBoardView
    BoardToolbar
    SplitPaneLayout (recursive)
      SplitDivider
      TerminalPane
        SessionTerminal (existing)
        PaneEmptyState
```

### Tasks Board

```
AppWorkspace
  WorkspaceViewSwitcher
  TasksBoardView
    KanbanFilterBar
    KanbanColumnsContainer
      KanbanColumn
        KanbanColumnHeader
        KanbanCard
          TaskPriorityBadge
          SessionStatusChips (existing pattern)
    KanbanEmptyState
```
