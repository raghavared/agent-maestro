# UI Re-render Analysis — React Component Tree

## Executive Summary

Analysis of all React components in `maestro-ui/src/components/` for unnecessary re-renders, missing optimizations, and patterns causing cascading updates. Found **34 issues** across **16 components**, categorized by severity.

---

## Severity Legend

- **CRITICAL** — Causes re-renders on every frame or on every store update; affects many child components
- **HIGH** — Creates new references on every render, defeating `React.memo` on children
- **MEDIUM** — Suboptimal but impact is limited to a smaller subtree
- **LOW** — Minor; fix for completeness

---

## 1. SessionsSection (CRITICAL — No Memo, Many Issues)

**File:** `maestro-ui/src/components/SessionsSection.tsx`

### 1.1 Missing React.memo [CRITICAL]
- **Line 113:** `export function SessionsSection({...})` — Not wrapped in `React.memo`. This is one of the most rendered components in the app (sidebar session list). Every parent state change causes full re-render of all session items.
- **Fix:** Wrap in `React.memo`.

### 1.2 Inline `renderSessionItem` function [CRITICAL]
- **Lines 365–644:** `const renderSessionItem = (s: Session, teamColor: TeamColor | null) => {...}` — This is a massive inline function defined inside the component body. It captures many closure variables and is called for every session. Because it's not memoized, any state change in `SessionsSection` recreates this function, and since it produces JSX directly, all session items re-render.
- **Fix:** Extract `SessionItem` as a separate memoized component with explicit props.

### 1.3 Inline anonymous functions passed to child components [HIGH]
- **Line 357:** `onToggleCollapse={() => setSidebarCollapsed((v) => !v)}` — inline arrow
- **Line 691:** `onClick={() => setSettingsOpen((prev) => !prev)}` — inline arrow
- **Line 810–825:** Resume button `onClick` with async handler defined inline
- **Fix:** Use `useCallback` for all event handlers passed as props.

### 1.4 `toggleSession` and `fetchMaestroData` not memoized [HIGH]
- **Lines 281–311:** Both are plain functions (not wrapped in `useCallback`), recreated on every render. `toggleSession` is used in onClick handlers.
- **Fix:** Wrap in `useCallback`.

### 1.5 `AGENT_TOOL_ICONS` object recreated every render [MEDIUM]
- **Line 358:** `const AGENT_TOOL_ICONS: Record<string, string> = {...}` — Defined inside the component body. Creates a new object reference each render.
- **Fix:** Move to module scope (it's a static constant).

### 1.6 `SortableContext` items array recreated [MEDIUM]
- **Line 893:** `items={sessions.map((s) => s.id)}` — Creates new array on every render, causing `SortableContext` to diff unnecessarily.
- **Fix:** Memoize with `useMemo`.

---

## 2. MaestroPanel [HIGH — Handler Functions Not Memoized]

**File:** `maestro-ui/src/components/maestro/MaestroPanel.tsx`

### 2.1 Many handler functions defined after early returns [CRITICAL]
- **Lines 245–360:** `handleCreateTask`, `handleUpdateTask`, `handleDeleteTask`, `handleWorkOnTask`, `handleAssignTeamMember`, `handleAddSubtask`, `handleInlineAddSubtask`, `handleToggleCollapse`, `handleToggleAddSubtask`, `handleToggleSubtask`, `handleDeleteSubtask`, `handleTogglePin` — ALL defined as plain `const` arrow functions (NOT `useCallback`). These are passed as props to `TaskListItem`, `SortableTaskList`, `TaskTabContent`, etc.
- Since `MaestroPanel` is wrapped in `React.memo`, the internal re-renders come from hook changes (tasks, sessions, etc.), but every such change recreates ALL these handler functions, which then cascade to every child.
- **Fix:** Wrap each in `useCallback` with appropriate dependencies.

### 2.2 `renderTaskNode` function recreated every render [CRITICAL]
- **Line 402:** `const renderTaskNode = (node: TaskTreeNode, depth: number = 0, options?: ...) => {...}` — This render function captures `collapsedTasks`, `slidingOutTasks`, `addingSubtaskTo`, `execution.executionMode`, `execution.selectedForExecution`, `currentSessionTaskIds`, and all the handler functions above. Any state change recreates it, causing the entire task list to re-render.
- **Fix:** Extract `TaskNodeRenderer` as a memoized component, or use `useCallback` for `renderTaskNode` with proper deps and accept state via context/params.

### 2.3 Inline function props in renderTaskNode [HIGH]
- **Line 412:** `onSelect={() => useUIStore.getState().setTaskDetailOverlay({...})}` — New arrow every render
- **Line 413:** `onWorkOn={() => handleWorkOnTask(node)}` — New arrow every render
- **Line 414:** `onWorkOnWithOverride={(agentTool, model) => handleWorkOnTask(node, {...})}` — New arrow
- **Line 415:** `onAssignTeamMember={(tmId) => handleAssignTeamMember(node.id, tmId)}` — New arrow
- **Line 417:** `onJumpToSession={(sid) => onJumpToSession?.(sid)}` — New arrow
- **Line 418:** `onNavigateToTask={(taskId) => useUIStore.getState().setTaskDetailOverlay({...})}` — New arrow
- **Line 423:** `onToggleChildrenCollapse={() => handleToggleAddSubtask(node.id, hasChildren)}` — New arrow
- **Line 424:** `onTogglePin={() => handleTogglePin(node.id)}` — New arrow
- **Line 427:** `onToggleSelect={() => execution.handleToggleTaskSelection(node.id)}` — New arrow
- **Impact:** Every `TaskListItem` gets new function references on every render, completely defeating any memoization on `TaskListItem`.
- **Fix:** Each `TaskListItem` should receive `taskId` + a single stable callback (or use context), not per-item closures.

### 2.4 `activeRoots`, `completedRoots`, `pinnedRoots`, `archivedRoots` computed inline [MEDIUM]
- **Lines 367–396:** These are computed in the component body without `useMemo`, meaning they're recomputed on every render.
- **Fix:** Wrap each in `useMemo`.

---

## 3. TaskListItem [HIGH — Missing React.memo]

**File:** `maestro-ui/src/components/maestro/TaskListItem.tsx`

### 3.1 Missing React.memo [CRITICAL]
- **Line 102:** `export function TaskListItem({...})` — NOT wrapped in `React.memo`. This is rendered for EVERY task in the list. Combined with the new function props from `MaestroPanel` (issue 2.3), this means every single `TaskListItem` re-renders whenever ANY state in `MaestroPanel` changes.
- **Fix:** Wrap in `React.memo`.

### 3.2 Zustand store subscriptions inside list items [HIGH]
- **Lines 5–7:** Imports and uses `useMaestroStore`, `useSpacesStore`, `useSessionStore` directly. Each `TaskListItem` subscribes to these stores. Any store update triggers re-render of ALL `TaskListItem` instances.
- Need to verify selectors are granular — if selecting broad slices (like `s.sessions`), every session update re-renders every task item.
- **Fix:** Use narrow selectors or move data lookup to parent and pass as props.

---

## 4. UnifiedKanbanView (in MultiProjectBoard.tsx) [HIGH]

**File:** `maestro-ui/src/components/maestro/MultiProjectBoard.tsx`

### 4.1 Inline arrow functions for each TaskCard [HIGH]
- **Line 546:** `onClick={() => onSelectTask(task.id, task.projectId)}` — New function per task per render
- **Line 547:** `onWorkOn={() => onWorkOnTask(task)}` — New function per task per render
- **Lines 548–552:** `projectBadge={showProjectBadge ? { name: ..., color: ... } : undefined}` — Creates new object literal per task per render
- **Impact:** Even though `TaskCard` is wrapped in `React.memo`, these new references cause it to re-render every time.
- **Fix:** Use `useCallback` with task ID, or make `TaskCard` accept IDs and look up data internally, or use a curried callback pattern.

### 4.2 Inline object for projectBadge [HIGH]
- **Line 549:** `{ name: (task as BoardTask).projectName, color: (task as BoardTask).projectColor }` — New object every render for every card.
- **Fix:** Memoize per-task or pass `projectName`/`projectColor` as separate string props.

---

## 5. ProjectKanbanRow [HIGH — Same Inline Function Pattern]

**File:** `maestro-ui/src/components/maestro/ProjectKanbanRow.tsx`

### 5.1 Inline arrow functions for each TaskCard [HIGH]
- **Line 140:** `onClick={() => onSelectTask(task.id)}` — New function per task per render
- **Line 141:** `onWorkOn={() => onWorkOnTask(task)}` — New function per task per render
- **Impact:** Same as 4.1 — defeats `TaskCard`'s `React.memo`.
- **Fix:** Same as 4.1.

---

## 6. KanbanColumn [HIGH — Same Inline Function Pattern]

**File:** `maestro-ui/src/components/maestro/KanbanColumn.tsx`

### 6.1 Inline arrow functions for each TaskCard [HIGH]
- **Line 95:** `onClick={() => onSelectTask(task)}` — New function per task per render
- **Line 96:** `onWorkOn={() => onWorkOnTask(task)}` — New function per task per render
- **Line 97:** `projectBadge={projectBadge?.(task)}` — Calls function prop per task per render (returns new object)
- **Fix:** Same approach as 4.1.

---

## 7. SortableTaskList [MEDIUM]

**File:** `maestro-ui/src/components/maestro/SortableTaskList.tsx`

### 7.1 `SortableTaskItem` not memoized [MEDIUM]
- **Line 26:** `function SortableTaskItem({...})` — Not wrapped in `React.memo`. Every drag state change re-renders all sortable items.
- **Fix:** Wrap in `React.memo`.

### 7.2 Inline style object [LOW]
- **Lines 36–41:** `const style: React.CSSProperties = {...}` — Creates new object each render inside `SortableTaskItem`.
- **Fix:** Use `useMemo` based on `transform`, `transition`, `isDragging`.

### 7.3 `ids` array recreated every render [MEDIUM]
- **Line 106:** `const ids = roots.map((r) => r.id)` — Not memoized. Passed to `SortableContext`, which may cause unnecessary diffing.
- **Fix:** Wrap in `useMemo`.

### 7.4 `showPermanentDelete` conditional creates new object [LOW]
- **Lines 127–129:** `showPermanentDelete ? { showPermanentDelete: true } : undefined` — Creates new object per item per render.
- **Fix:** Extract as a stable constant.

---

## 8. SortableSessionItem (in SessionsSection) [MEDIUM]

**File:** `maestro-ui/src/components/SessionsSection.tsx`

### 8.1 `SortableSessionItem` not memoized [MEDIUM]
- **Line 83:** `function SortableSessionItem({...})` — Same issue as 7.1.
- **Fix:** Wrap in `React.memo`.

### 8.2 Inline style object [LOW]
- **Lines 93–98:** Same as 7.2.
- **Fix:** `useMemo`.

---

## 9. MaestroSessionContent [MEDIUM — Missing React.memo]

**File:** `maestro-ui/src/components/maestro/MaestroSessionContent.tsx`

### 9.1 Missing React.memo [MEDIUM]
- **Line 127:** `export function MaestroSessionContent({...})` — Not memoized. Receives `allTasks: Map<string, MaestroTask>` which is a reference from the Zustand store — Map references change whenever any task updates.
- **Fix:** Wrap in `React.memo` with a custom comparator (or avoid passing the full Map).

### 9.2 `TreeTaskNodeContent` not memoized [MEDIUM]
- **Line 59:** `function TreeTaskNodeContent({...})` — Recursive component, not memoized.
- **Fix:** Wrap in `React.memo`.

---

## 10. TaskTabContent [LOW]

**File:** `maestro-ui/src/components/maestro/TaskTabContent.tsx`

### 10.1 Uses `React.FC` pattern, not memoized [LOW]
- **Line 16:** `export const TaskTabContent: React.FC<...> = ({...})` — Not wrapped in `React.memo`. However, the main cost is in `renderTaskNode` which is the real problem (see issue 2.2).
- **Fix:** Wrap in `React.memo`.

---

## 11. SessionDetailModal [MEDIUM]

**File:** `maestro-ui/src/components/maestro/SessionDetailModal.tsx`

### 11.1 Broad Zustand selector [MEDIUM]
- **Line 51:** `const tasks = useMaestroStore((s) => s.tasks)` — Subscribes to the ENTIRE tasks Map. ANY task update anywhere triggers re-render of this modal.
- **Fix:** Only select the specific task IDs needed: `const linkedTaskIds = session?.taskIds; const linkedTasks = useMemo(...)`.

---

## 12. TeamSessionGroup [LOW — Minor Issues]

**File:** `maestro-ui/src/components/maestro/TeamSessionGroup.tsx`

### 12.1 Missing React.memo [LOW]
- **Line 16:** `export function TeamSessionGroup({...})` — Not memoized. Receives `maestroSessions` and `maestroTasks` Maps which change frequently.
- **Fix:** Wrap in `React.memo`.

---

## 13. TaskCard [GOOD — Minor Issues]

**File:** `maestro-ui/src/components/maestro/TaskCard.tsx`

### 13.1 `handleDragStart` depends on full `task` object [LOW]
- **Line 62:** `}, [task])` — Dependency is the entire task object. If the parent recreates the task object reference (even with same values), this callback is recreated.
- **Fix:** Depend on specific fields: `[task.title, task.description, task.initialPrompt]`.

### 13.2 Inline onClick handler for "work on" button [LOW]
- **Lines 117–119:** `onClick={(e) => { e.stopPropagation(); onWorkOn(); }}` — Inline arrow. Minor since this is already inside a memoized component and only renders for todo/blocked tasks.
- **Fix:** Extract with `useCallback`.

---

## 14. Dashboard [GOOD — Minor Issue]

**File:** `maestro-ui/src/components/maestro/Dashboard.tsx`

### 14.1 `presets` array recreated every render [LOW]
- **Lines 292–300:** `const presets = [...]` — Static data recreated inside the component.
- **Fix:** Move to module scope.

### 14.2 Sub-components not memoized [LOW]
- `ChartTooltip`, `MetricCard`, `CalendarHeatmap`, `DueDateList`, `TeamMemberStatsView` — None wrapped in `React.memo`. However since `Dashboard` itself is memoized, impact is limited.
- **Fix:** Wrap `MetricCard` and `CalendarHeatmap` in `React.memo` (they're rendered in lists).

---

## 15. task-modal Components [LOW]

**File:** `maestro-ui/src/components/maestro/task-modal/*.tsx`

### 15.1 `DetailsTab` not memoized [LOW]
- **Line 22:** `export function DetailsTab({...})` — Not memoized.

### 15.2 `SessionsTab` not memoized [LOW]
- **Line 12:** `export function SessionsTab({...})` — Not memoized. Receives `tasks: Map<string, MaestroTask>` (full Map).

### 15.3 `SubtasksTab` not memoized [LOW]
- **Line 29:** `export function SubtasksTab({...})` — Not memoized. Multiple inline onClick handlers.

### 15.4 `TimelineTab` not memoized [LOW]
- **Line 9:** `export function TimelineTab({...})` — Not memoized.

### 15.5 `TaskFormHeader` not memoized [LOW]
- **Line 28:** `export function TaskFormHeader({...})` — Not memoized.

---

## 16. TaskStatusControl [MEDIUM]

**File:** `maestro-ui/src/components/maestro/TaskStatusControl.tsx`

### 16.1 Missing React.memo [MEDIUM]
- **Line 42:** `export function TaskStatusControl({...})` — Not memoized. Rendered for every task that shows status control.
- **Fix:** Wrap in `React.memo`.

---

## Summary: Top Priority Fixes (Highest Impact)

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| 1 | **SessionsSection** | No React.memo, inline renderSessionItem | Every sidebar update re-renders all sessions |
| 2 | **MaestroPanel** | 12+ handlers not useCallback'd, renderTaskNode recreated | Every state change cascades to all tasks |
| 3 | **TaskListItem** | No React.memo + store subscriptions | Every task re-renders on any change |
| 4 | **UnifiedKanbanView** | Inline onClick/onWorkOn/projectBadge per TaskCard | Defeats TaskCard memo (board view) |
| 5 | **ProjectKanbanRow** | Inline onClick/onWorkOn per TaskCard | Defeats TaskCard memo (grouped view) |
| 6 | **KanbanColumn** | Inline onClick/onWorkOn per TaskCard | Defeats TaskCard memo (reusable column) |
| 7 | **SortableTaskList** | SortableTaskItem not memoized, ids not memoized | Drag interactions re-render all items |
| 8 | **SessionDetailModal** | Broad `s.tasks` selector | Any task update re-renders open modal |

### Quick Wins (Low effort, high impact):
1. Add `React.memo` to: `SessionsSection`, `TaskListItem`, `TaskStatusControl`, `MaestroSessionContent`, `TeamSessionGroup`, `SortableTaskItem`, `SortableSessionItem`
2. Move `AGENT_TOOL_ICONS` and `presets` to module scope
3. Memoize `ids` array in `SortableTaskList`
4. Use narrow Zustand selectors in `SessionDetailModal`

### Larger Refactors:
1. Extract `SessionItem` from `renderSessionItem` in `SessionsSection`
2. Convert all MaestroPanel handlers to `useCallback`
3. Extract `renderTaskNode` into a memoized `TaskNodeRenderer` component
4. Replace per-item inline closures in kanban views with ID-based callbacks
5. Audit `TaskListItem`'s direct store subscriptions and move to parent-provided props
