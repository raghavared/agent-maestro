# Board Views UI Design Specification

## 1. Design System Context

All board views inherit the existing Maestro dark-theme design tokens:

```
Background layers:  --bg (#0a0e16) > --panel (#10151e) > --panel-2 (#111820)
Borders:            --border (rgba 255,255,255,0.08), --border-subtle (rgba 255,255,255,0.04)
Text:               --text (#f0f4f8), --muted (rgba 240,244,248,0.7)
Accents:            --accent (#6b8afd), --accent-2 (#22d3ee), --accent-3 (#818cf8)
Theme-dynamic:      --theme-primary, --theme-primary-dim, --theme-primary-rgb, --theme-border, --theme-text, --theme-text-dim
Typography:         JetBrains Mono for all monospace/UI chrome; system sans-serif stack for body
Radius:             --radius-control (6px); most existing chrome uses 0 (sharp edges)
Transitions:        0.2s ease on color/border/background
```

The existing UI uses a "terminal aesthetic": monospaced fonts, ASCII art for empty states, `$` prompt prefixes on buttons, subtle CRT-like glow effects via `text-shadow` and `box-shadow` with `rgba(--theme-primary-rgb, ...)`.

---

## 2. Layout Integration

### Where boards live

Boards replace the **main workspace area** (the `<main className="main">` element containing `<AppWorkspace />`). The existing three-column layout remains unchanged:

```
[ Sidebar ] [ Main Content Area ] [ Right Panel (Maestro) ]
```

The main content area currently shows a single terminal (via `AppWorkspace > workspaceRow > terminalPane`). Board views will be an **alternative rendering mode** within this same zone.

### View Switcher

A **view mode toggle** is added to the sidebar header area, below the agent shortcut row. It presents three modes:

```
[ Terminal ]  [ Split Board ]  [ Task Board ]
```

- Rendered as a segmented control using `JetBrains Mono` 11px, uppercase, letter-spacing 1px
- Background: `rgba(var(--theme-primary-rgb), 0.03)`
- Border: `1px solid var(--theme-border)`
- Active segment: `background: rgba(var(--theme-primary-rgb), 0.12)`, `color: var(--theme-primary)`, left-accent bar `3px var(--theme-primary)`
- Inactive: `color: rgba(var(--theme-primary-rgb), 0.5)`

When "Terminal" is selected, the current `AppWorkspace` renders as-is. When "Split Board" or "Task Board" is selected, the main area renders the corresponding board component.

### Sidebar behavior in board mode

- In **Terminal mode**: sidebar shows sessions list (current behavior)
- In **Split Board mode**: sidebar still shows sessions list; sessions can be dragged into board panes
- In **Task Board mode**: sidebar shows sessions list; the right panel (Maestro) can optionally collapse since tasks are now visualized in the main area

---

## 3. Component Hierarchy

```
AppWorkspace
  |-- (viewMode === "terminal") --> existing workspaceRow / terminalPane
  |-- (viewMode === "split")    --> TerminalBoardView
  |-- (viewMode === "tasks")    --> TaskBoardView
```

### TerminalBoardView tree

```
TerminalBoardView
  +-- BoardToolbar
  |     +-- ToolbarButton (add terminal)
  |     +-- ToolbarButton (split horizontal)
  |     +-- ToolbarButton (split vertical)
  |     +-- LayoutPresetMenu
  |     +-- ToolbarSeparator
  |     +-- PaneCountIndicator
  +-- SplitContainer (recursive)
        +-- SplitPane
        |     +-- PaneHeader
        |     |     +-- SessionSelector (dropdown)
        |     |     +-- PaneTitle (session name)
        |     |     +-- PaneCloseButton
        |     +-- SessionTerminal (existing component, reused)
        +-- ResizeHandle
        +-- SplitPane
              +-- ...
```

### TaskBoardView tree

```
TaskBoardView
  +-- BoardHeader
  |     +-- BoardTitle ("Task Board")
  |     +-- FilterBar
  |     |     +-- StatusFilterChips
  |     |     +-- PriorityFilterChips
  |     |     +-- SortDropdown
  |     +-- BoardStats (active/pending/review/done counts)
  +-- KanbanColumns (horizontal scroll container)
        +-- KanbanColumn (status: "todo")
        |     +-- ColumnHeader
        |     |     +-- StatusDot
        |     |     +-- ColumnTitle
        |     |     +-- TaskCount
        |     +-- ColumnBody (scrollable)
        |     |     +-- TaskCard (draggable)
        |     |     |     +-- CardPriorityStripe
        |     |     |     +-- CardTitle
        |     |     |     +-- CardMeta
        |     |     |     |     +-- AgentAvatar
        |     |     |     |     +-- TimeIndicator
        |     |     |     +-- LiveStatusDot
        |     |     +-- TaskCard ...
        |     |     +-- TaskCardSkeleton (loading)
        |     +-- ColumnFooter (+ add task button)
        +-- KanbanColumn (status: "in_progress")
        +-- KanbanColumn (status: "in_review")
        +-- KanbanColumn (status: "completed")
```

---

## 4. Terminal Board View Design

### 4.1 Board Toolbar

Positioned at the top of the main area, height 40px.

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

**Toolbar buttons** follow the existing `terminalCmd` pattern:
- Border: `1px solid var(--terminal-border)`
- Background: transparent
- Color: `var(--terminal-text-dim)`
- Padding: `4px 10px`
- Hover: `border-color: var(--terminal-green); box-shadow: 0 0 8px rgba(var(--theme-primary-rgb), 0.2)`

Buttons:
- `[+ Add]` -- adds an empty pane
- `[| Split H]` -- splits the focused pane horizontally
- `[-- Split V]` -- splits vertically
- Separator: `1px solid var(--theme-border)`, height 20px, margin 0 6px
- Layout presets dropdown: `[Layouts v]` showing options like "2-col", "3-col", "2x2 grid", "1+2 (main + sidebar)"

**Pane count indicator** (right side): `2/4 panes` in `color: var(--theme-text-dim); font-size: 10px`

### 4.2 Split Container & Resize Handles

The split container uses CSS flexbox with configurable flex-basis percentages. Each `SplitPane` has a flex value stored in state.

**Resize handle (vertical divider between horizontal panes):**

```css
.splitResizeHandle {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  flex-shrink: 0;
  z-index: 5;
}

.splitResizeHandle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 2px;
  background: var(--theme-border);
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.splitResizeHandle:hover::after,
.splitResizeHandle:active::after {
  background: var(--theme-primary);
  box-shadow: 0 0 8px rgba(var(--theme-primary-rgb), 0.4);
}
```

**Horizontal resize handle (between vertically stacked panes):**

```css
.splitResizeHandleH {
  height: 6px;
  cursor: row-resize;
  /* Same pattern, rotated: thin 2px line centered in 6px gutter */
}

.splitResizeHandleH::after {
  top: 2px;
  left: 0;
  right: 0;
  height: 2px;
  width: auto;
}
```

During active drag, add class `splitResizing` to the board container to set `user-select: none` and `pointer-events: none` on terminal panes (same pattern as existing sidebar resize).

### 4.3 Pane Header

Each pane has a minimal header bar (height 28px):

```css
.paneHeader {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  height: 28px;
  background: rgba(var(--theme-primary-rgb), 0.03);
  border-bottom: 1px solid var(--theme-border);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.paneTitle {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--theme-text-dim);
}

.paneSessionDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--theme-primary);
  box-shadow: 0 0 4px var(--theme-primary);
}

.paneCloseBtn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(var(--theme-primary-rgb), 0.3);
  font-size: 14px;
  cursor: pointer;
  transition: color 0.15s;
}

.paneCloseBtn:hover {
  color: var(--theme-primary);
}
```

When no session is assigned, the pane shows a **session selector dropdown** styled like the existing `sidebarActionMenuDropdown`: dark background, theme-bordered items. Clicking a session assigns it to the pane, mounting a `<SessionTerminal>` instance.

### 4.4 Empty Board State

When the split board has zero panes (initial state), display an empty state centered in the main area using the existing ASCII-art pattern:

```
  +-------------------------------------------+
  |                                           |
  |   NO TERMINAL PANES                       |
  |                                           |
  |   $ add terminal     $ split layout       |
  |                                           |
  +-------------------------------------------+
```

Font: `JetBrains Mono`, color: `var(--theme-text-dim)`, box border uses `var(--theme-border)`. Action buttons use `terminalCmd` / `terminalCmdPrimary` class styling.

---

## 5. Task Board View Design

### 5.1 Board Header

Height 48px, sits above the kanban columns.

```css
.taskBoardHeader {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 48px;
  background: var(--panel);
  border-bottom: 1px solid var(--theme-border);
  flex-shrink: 0;
}

.taskBoardTitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-primary);
  letter-spacing: 1px;
  text-transform: uppercase;
}
```

**Filter bar** reuses the existing `TaskFilters` styling: inline chips for status/priority, sort dropdown. Positioned to the right of the title with `margin-left: auto`.

**Board stats** follow the existing `terminalStats` pattern:
```
  [active dot] 3   [pending dot] 5   [review dot] 1   [done dot] 8
```

### 5.2 Kanban Columns

The columns container scrolls horizontally:

```css
.kanbanColumns {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  flex: 1;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--theme-primary-rgb), 0.15) transparent;
}
```

Each column:

```css
.kanbanColumn {
  display: flex;
  flex-direction: column;
  min-width: 280px;
  max-width: 320px;
  flex: 1 0 280px;
  background: rgba(var(--theme-primary-rgb), 0.02);
  border: 1px solid var(--theme-border);
  border-radius: 0;  /* sharp edges, consistent with terminal aesthetic */
}
```

### 5.3 Column Header

```css
.kanbanColumnHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--theme-border);
  background: rgba(var(--theme-primary-rgb), 0.04);
}

.kanbanColumnStatusDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Status-specific colors */
.kanbanColumnStatusDot--todo {
  background: var(--theme-text-dim);
}
.kanbanColumnStatusDot--in_progress {
  background: var(--terminal-cyan, #00d9ff);
  box-shadow: 0 0 6px var(--terminal-cyan, #00d9ff);
  animation: terminalPulse 1s ease-in-out infinite;
}
.kanbanColumnStatusDot--in_review {
  background: #a855f7;
  box-shadow: 0 0 6px #a855f7;
}
.kanbanColumnStatusDot--completed {
  background: var(--theme-primary);
  box-shadow: 0 0 4px var(--theme-primary);
}

.kanbanColumnTitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--theme-text-dim);
  flex: 1;
}

.kanbanColumnCount {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: rgba(var(--theme-primary-rgb), 0.5);
  background: rgba(var(--theme-primary-rgb), 0.1);
  border: 1px solid rgba(var(--theme-primary-rgb), 0.2);
  padding: 2px 6px;
  min-width: 18px;
  text-align: center;
}
```

### 5.4 Column Body

```css
.kanbanColumnBody {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--theme-primary-rgb), 0.12) transparent;
}
```

### 5.5 Task Card

```css
.taskCard {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--theme-border);
  padding: 10px 12px;
  cursor: grab;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  font-family: 'JetBrains Mono', monospace;
}

.taskCard:hover {
  border-color: rgba(var(--theme-primary-rgb), 0.3);
  box-shadow: 0 0 8px rgba(var(--theme-primary-rgb), 0.1);
  transform: translateY(-1px);
}

.taskCard:active {
  cursor: grabbing;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  transform: translateY(-2px);
  z-index: 10;
}

/* Drag ghost */
.taskCard--dragging {
  opacity: 0.5;
  border-color: var(--theme-primary);
}

/* Drop target indicator */
.taskCard--dropTarget {
  border-top: 2px solid var(--theme-primary);
  box-shadow: 0 -2px 8px rgba(var(--theme-primary-rgb), 0.3);
}
```

**Priority stripe** (left edge):

```css
.taskCardPriorityStripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.taskCardPriorityStripe--high {
  background: #ff6464;
  box-shadow: 0 0 6px rgba(255, 100, 100, 0.4);
}

.taskCardPriorityStripe--medium {
  background: #ffb000;
  box-shadow: 0 0 4px rgba(255, 176, 0, 0.3);
}

.taskCardPriorityStripe--low {
  background: rgba(var(--theme-primary-rgb), 0.3);
}
```

**Card content layout:**

```css
.taskCardTitle {
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-text);
  line-height: 1.4;
  margin-bottom: 8px;
  /* Two-line clamp */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.taskCardMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--theme-text-dim);
}

.taskCardAgent {
  display: flex;
  align-items: center;
  gap: 4px;
}

.taskCardAgentIcon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  border: 1px solid var(--theme-border);
}

.taskCardAgentFallback {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  background: rgba(var(--theme-primary-rgb), 0.1);
  border: 1px solid var(--theme-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: var(--theme-primary);
}

.taskCardTime {
  color: rgba(var(--theme-primary-rgb), 0.4);
  font-size: 10px;
  margin-left: auto;
}
```

### 5.6 Live Status Indicator

For tasks that are `in_progress`:

```css
.taskCardLiveStatus {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.taskCardLiveStatus--active {
  background: var(--terminal-cyan, #00d9ff);
  box-shadow: 0 0 6px var(--terminal-cyan, #00d9ff);
  animation: taskLivePulse 2s ease-in-out infinite;
}

@keyframes taskLivePulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 6px var(--terminal-cyan, #00d9ff);
  }
  50% {
    opacity: 0.4;
    box-shadow: 0 0 12px var(--terminal-cyan, #00d9ff), 0 0 24px rgba(0, 217, 255, 0.2);
  }
}

.taskCardLiveStatus--review {
  background: #a855f7;
  box-shadow: 0 0 6px #a855f7;
  animation: taskLivePulse 2s ease-in-out infinite;
}
```

### 5.7 Column Transitions

When a task moves between columns (via drag-and-drop or status update), use CSS transitions:

```css
/* Card leaving a column */
.taskCard--exiting {
  animation: taskCardExit 0.3s ease-in forwards;
}

@keyframes taskCardExit {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.95); height: 0; padding: 0; margin: 0; border-width: 0; overflow: hidden; }
}

/* Card entering a column */
.taskCard--entering {
  animation: taskCardEnter 0.3s ease-out;
}

@keyframes taskCardEnter {
  0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
```

The transition logic uses `React.useLayoutEffect` to detect status changes and apply the entering/exiting classes with timeouts matching the animation durations, following the same pattern used in `MaestroPanel` for `terminalTaskSlideOut`.

### 5.8 Loading Skeleton Cards

```css
.taskCardSkeleton {
  background: var(--panel);
  border: 1px solid var(--theme-border);
  padding: 10px 12px;
  position: relative;
  overflow: hidden;
}

.taskCardSkeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(var(--theme-primary-rgb), 0.04) 50%,
    transparent 100%
  );
  animation: skeletonShimmer 1.5s ease-in-out infinite;
}

@keyframes skeletonShimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.taskCardSkeletonLine {
  height: 10px;
  border-radius: 2px;
  background: rgba(var(--theme-primary-rgb), 0.06);
  margin-bottom: 6px;
}

.taskCardSkeletonLine--title {
  width: 75%;
  height: 12px;
}

.taskCardSkeletonLine--meta {
  width: 40%;
  height: 8px;
}
```

### 5.9 Empty Column State

When a column has zero tasks:

```css
.kanbanColumnEmpty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.kanbanColumnEmptyText {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: rgba(var(--theme-primary-rgb), 0.25);
  text-align: center;
  line-height: 1.6;
}
```

Content examples:
- Todo: `"No pending tasks"`
- In Progress: `"No active tasks"`
- In Review: `"No tasks in review"`
- Completed: `"No completed tasks"`

### 5.10 Column Footer

```css
.kanbanColumnFooter {
  padding: 8px;
  border-top: 1px solid var(--border-subtle);
}

.kanbanAddTaskBtn {
  width: 100%;
  padding: 6px 10px;
  border: 1px dashed rgba(var(--theme-primary-rgb), 0.15);
  background: transparent;
  color: rgba(var(--theme-primary-rgb), 0.3);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.kanbanAddTaskBtn:hover {
  border-color: rgba(var(--theme-primary-rgb), 0.4);
  color: var(--theme-primary);
  background: rgba(var(--theme-primary-rgb), 0.05);
}
```

---

## 6. Drag and Drop

### Task Board

Use the HTML Drag and Drop API (or a library like `@dnd-kit/core` if already available). Visual feedback:

1. **Drag start**: Card gets `taskCard--dragging` (opacity 0.5, theme-primary border)
2. **Over a column**: Column gets `kanbanColumn--dropTarget` adding a subtle top-glow: `box-shadow: inset 0 2px 8px rgba(var(--theme-primary-rgb), 0.15)`
3. **Over a specific card position**: Target card gets `taskCard--dropTarget` showing a 2px theme-primary line above it
4. **Drop**: Remove drag classes, animate the card entering with `taskCard--entering`

### Terminal Board

Sessions can be dragged from the sidebar into empty panes. Use the same drag overlay pattern with a ghost element showing the session name in a small badge.

---

## 7. Responsive Behavior

At `window.innerWidth < 960` (existing breakpoint):

- **Terminal Board**: Collapses to a single pane (like current terminal view). The toolbar shows a dropdown to switch between panes instead of showing them simultaneously.
- **Task Board**: Columns stack vertically with a horizontal tab strip at the top to select which column to view. Each column becomes full-width.
- The mobile panel switcher gains the board options alongside "Sessions", "Terminal", and "Maestro".

---

## 8. Color Reference for Status Columns

| Status       | Dot Color                           | Column accent                       |
|-------------|-------------------------------------|--------------------------------------|
| Todo        | `var(--theme-text-dim)`             | none                                 |
| In Progress | `#00d9ff` (cyan) + glow + pulse     | `border-top: 2px solid #00d9ff`      |
| In Review   | `#a855f7` (purple) + glow           | `border-top: 2px solid #a855f7`      |
| Completed   | `var(--theme-primary)` + glow       | `border-top: 2px solid var(--theme-primary)` |

---

## 9. Accessibility Notes

- All interactive elements have `title` / `aria-label` attributes
- Resize handles use `role="separator"` with `aria-orientation` and `aria-valuemin/max/now` (matching existing sidebar resize pattern)
- Drag-and-drop includes keyboard support: focus a card, use Arrow keys to move between columns, Enter to pick up/drop
- Column headers use semantic `role="heading"` or `<h3>` elements
- Status dots use `aria-label` to describe the status for screen readers
- Sufficient color contrast: all text colors meet WCAG AA against `--panel` / `--bg` backgrounds

---

## 10. Animation Performance

- All animations use `transform` and `opacity` only (GPU-composited properties)
- During drag operations, set `will-change: transform` on the dragged element
- During resize, set `pointer-events: none` on terminal panes and `user-select: none` on the container (matching existing resize pattern)
- Skeleton shimmer uses `translateX` transforms, not width/background-position
