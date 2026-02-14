# Board Architecture Analysis

## Overview

There are two board contexts in the application:

1. **Project Board** (`TaskBoardOverlay`) - opened from MaestroPanel's `$ board` button, shows tasks for a single project
2. **Multi-Project Board** (`MultiProjectBoard`) - shows tasks across all projects with two layout modes

Both boards render kanban columns (BACKLOG, BLOCKED, IN PROGRESS, REVIEW, DONE) with draggable task cards. However, they use **completely different drag implementations** and **duplicate task card components**.

---

## Component Map

```
MaestroPanel.tsx (line 898)
  └── TaskBoardOverlay.tsx          ← Single-project board
        ├── TaskBoardCard             (pointer-based drag via useBoardDrag)
        ├── DragGhostCard             (floating ghost that follows cursor)
        └── TerminalSessionsBoard     (sessions tab)

MultiProjectBoard.tsx               ← Multi-project board
  ├── ProjectSelectorSidebar.tsx      (left sidebar to pick projects)
  ├── ProjectKanbanRow.tsx            (grouped view - one row per project)
  │     └── GroupedTaskCard           (native HTML5 drag API)
  ├── UnifiedKanbanView              (unified view - single kanban)
  │     └── UnifiedTaskCard           (native HTML5 drag API)
  └── MultiProjectSessionsView.tsx   (sessions tab)
```

---

## The Core Problem: Two Different Drag Systems

### 1. TaskBoardOverlay (WORKS) - Pointer-based drag via `useBoardDrag` hook

**File:** `maestro-ui/src/hooks/useBoardDrag.ts`

The single-project board uses a **custom pointer-event-based drag system** that:
- Captures `pointerdown` on the card, records card geometry
- Waits for 4px movement threshold before starting drag
- Tracks `pointermove` to update ghost card position
- Hit-tests column elements via `getBoundingClientRect()` to determine drop target
- Fires drop callback on `pointerup`
- Supports `Escape` to cancel
- Renders a floating `DragGhostCard` component that follows the cursor

**Why it works well:**
- Pointer events are reliable across all platforms including Tauri/WebView
- No reliance on browser drag-and-drop internals
- Custom ghost card gives full visual control
- Column hit-testing is deterministic (uses registered column refs)

### 2. MultiProjectBoard (BROKEN) - Native HTML5 Drag API

**Files:** `MultiProjectBoard.tsx` (UnifiedKanbanView), `ProjectKanbanRow.tsx` (GroupedTaskCard)

Both the grouped and unified views in the multi-project board use the **native HTML5 Drag and Drop API**:
- `draggable` attribute on cards
- `onDragStart` / `onDragEnd` on cards
- `onDragOver` / `onDragLeave` / `onDrop` on columns
- `e.dataTransfer.setData("text/plain", taskId)` to pass task ID
- Sets a 1x1 transparent GIF as drag image (`setDragImage`)

**Why it breaks:**
- Native HTML5 drag events are **notoriously unreliable in Tauri/WebView** environments
- `dragover`/`dragleave` events fire inconsistently, especially across nested elements
- `dataTransfer.getData()` may return empty in some WebView contexts
- No custom ghost card - the transparent GIF means the user sees nothing while dragging
- `dragLeave` fires when crossing child element boundaries within a column, causing flickering

---

## Duplicated Code

### 3 Nearly-Identical Task Card Components

| Component | File | Drag Method | Extra Feature |
|---|---|---|---|
| `TaskBoardCard` | TaskBoardOverlay.tsx:680 | Pointer events (`onPointerDown`) | wasDraggingRef to suppress click |
| `UnifiedTaskCard` | MultiProjectBoard.tsx:543 | HTML5 drag (`draggable`, `onDragStart`) | Project badge |
| `GroupedTaskCard` | ProjectKanbanRow.tsx:235 | HTML5 drag (`draggable`, `onDragStart`) | No project badge |

All three render the same visual structure:
- Priority color stripe
- Title (with cancelled strikethrough)
- Meta row (priority badge, subtask count, time ago)
- Session indicator
- "$ work on" action button

### Duplicated Constants (defined in 3 files)

- `COLUMNS` array (5 statuses) - in TaskBoardOverlay.tsx:27, MultiProjectBoard.tsx:337, ProjectKanbanRow.tsx:5
- `PRIORITY_COLORS` record - in TaskBoardOverlay.tsx:35, MultiProjectBoard.tsx:345, ProjectKanbanRow.tsx:13
- `timeAgo()` function - in TaskBoardOverlay.tsx:59, MultiProjectBoard.tsx:351, ProjectKanbanRow.tsx:19

### Duplicated Column Rendering Logic

The column rendering (header + body + empty state + collapse) is reimplemented in:
1. `TaskBoardOverlay` (lines 241-306)
2. `UnifiedKanbanView` (lines 456-529)
3. `ProjectKanbanRow` (lines 150-219)

### Duplicated Drag Logic

The HTML5 drag handlers (`handleDragStart`, `handleDragEnd`, `handleDragOver`, `handleDragLeave`, `handleDrop`) are copy-pasted between:
1. `UnifiedKanbanView` (lines 399-445)
2. `ProjectKanbanRow` (lines 89-135)

---

## Recommended Unification

### Step 1: Create a shared `TaskCard` component

A single `TaskCard` that:
- Accepts an optional `projectBadge` prop (for multi-project context)
- Uses pointer-based drag (receives `onPointerDown` from parent)
- Has the `wasDraggingRef` pattern from `TaskBoardCard`

### Step 2: Migrate MultiProjectBoard to use `useBoardDrag`

Replace native HTML5 drag in both `UnifiedKanbanView` and `ProjectKanbanRow` with the `useBoardDrag` hook:
- Each `ProjectKanbanRow` gets its own `useBoardDrag` instance (scoped to that row's columns)
- `UnifiedKanbanView` gets a single `useBoardDrag` instance
- Add `DragGhostCard` rendering to both views

### Step 3: Extract shared constants

Move `COLUMNS`, `PRIORITY_COLORS`, and `timeAgo` to a shared `boardConstants.ts` file.

### Step 4: Extract shared `KanbanColumn` component

A single `KanbanColumn` component that handles:
- Column header (symbol, label, count, collapse toggle)
- Column body (cards or empty state)
- `registerColumn` ref callback from `useBoardDrag`
- `dragOver` highlight state

---

## File Inventory

| File | Lines | Purpose |
|---|---|---|
| `MaestroPanel.tsx` | 917 | Main panel, opens TaskBoardOverlay |
| `TaskBoardOverlay.tsx` | 778 | Single-project board (pointer drag) |
| `MultiProjectBoard.tsx` | 608 | Multi-project board wrapper + UnifiedKanbanView |
| `ProjectKanbanRow.tsx` | 295 | Grouped view row (HTML5 drag) |
| `ProjectSelectorSidebar.tsx` | 125 | Project filter sidebar |
| `MultiProjectSessionsView.tsx` | 335 | Multi-project sessions tab |
| `useBoardDrag.ts` | 153 | Pointer-based drag hook (only used by TaskBoardOverlay) |
| `useMultiProjectTasks.ts` | 76 | Multi-project task fetching hook |
