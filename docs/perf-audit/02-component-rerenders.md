# Performance Audit: React Component Re-renders

**Date:** 2026-03-09
**Scope:** 7 large UI components analyzed for unnecessary re-render patterns
**Severity Scale:** Critical > High > Medium > Low

---

## Executive Summary

| Component | Size | React.memo | useMemo/useCallback | Inline Props | Store Selectors | Virtualization | Overall |
|---|---|---|---|---|---|---|---|
| MaestroPanel.tsx | 742 lines | Yes | Good | 8 inline fns | Good (useShallow) | No (delegates) | Medium |
| TaskListItem.tsx | 832 lines | Yes | Partial | Many | Bad (4 separate) | N/A | High |
| MultiProjectBoard.tsx | 616 lines | Partial | Good | 6 inline fns | Bad (2 bare) | Yes (tanstack) | Medium |
| ExecutionBar.tsx | 592 lines | No | Partial | Many | N/A | N/A | High |
| CreateTaskModal.tsx | 420 lines | No | Minimal | Many | Bad (2 bare) | N/A | Medium |
| Dashboard.tsx | 563 lines | Yes (top) | Good | Some | N/A | LazyVisible | Low-Med |
| SkillsPanel.tsx | 386 lines | No | Partial | Many | N/A | N/A | Low |

**Top 3 highest-impact issues:**
1. **TaskListItem store selectors** — every task item subscribes to the entire `tasks` and `teamMembers` objects. With 200+ tasks, a single task update re-renders every TaskListItem.
2. **ExecutionBar missing React.memo** — re-renders on every MaestroPanel state change (typing in search, toggling filters, etc.) despite props not changing.
3. **TaskListItem component splitting** — 832 lines with 13+ useState calls. Dropdown sub-sections should be extracted so opening one dropdown doesn't re-render the entire item.

---

## 1. MaestroPanel.tsx (742 lines)

### What's Good
- Wrapped in `React.memo`
- `TaskNodeRenderer` extracted as a memoized sub-component with explicit props interface
- Most handlers use `useCallback`
- Derived data uses `useMemo` (activeRoots, completedRoots, pinnedRoots, etc.)
- Store access uses `useShallow` to prevent unnecessary re-renders
- Module-scope `NOOP` constant avoids recreating empty callbacks

### Issues Found

#### [HIGH] Hooks after early returns (lines 553-559)
`handleSelectTask` and `handleNavigateToTask` are defined via `useCallback` after conditional `return` statements (lines 545-549). This violates React's rules of hooks — hooks must always be called in the same order. While this may work in practice because the early returns are rare, it will cause crashes if the conditions change mid-session.

```tsx
// BUG: These are after early returns on lines 545-549
const handleSelectTask = useCallback((taskId: string) => {
    useUIStore.getState().setTaskDetailOverlay({ taskId, projectId });
}, [projectId]);
```

**Fix:** Move all `useCallback`/`useMemo` hooks above the early return statements.

#### [MEDIUM] Inline arrow functions in JSX (8 occurrences)
Lines 597, 611-614, 699, 721-722, 733, 735 — new function references created each render:

```tsx
onNewTask={() => setShowCreateModal(true)}               // line 611
onNewTaskList={() => setTaskListCreateSignal(prev => prev + 1)}  // line 612
onNewTeam={() => {}}                                      // line 614
onClose={() => { setShowCreateModal(false); ... }}        // line 722
onSelectTask={(taskId, _projectId) => ...}                // line 733
onWorkOnTask={(task, _project) => handleWorkOnTask(task)} // line 735
```

These defeat `React.memo` on child components since the props are new references every render.

**Fix:** Extract as `useCallback` hooks or use module-scope noops where applicable.

#### [MEDIUM] `renderTaskNode` dependency cascade (line 563-588)
The `useCallback` wrapping `renderTaskNode` has 16 dependencies. Any UI state change (collapsedTasks, slidingOutTasks, addingSubtaskTo, executionMode, etc.) recreates the callback and forces re-render of `SortableTaskList` and all `TaskTabContent` consumers.

**Fix:** Consider passing these as a context or reducing granularity of the dependency.

#### [LOW] `terminalSessions` full array selector (line 226)
```tsx
const terminalSessions = useSessionStore(s => s.sessions);
```
Returns the entire sessions array. Any session status change (e.g., a session becoming active) triggers a re-render of the entire panel.

**Fix:** Use a more targeted selector or derive `currentSessionTaskIds` inside the store.

---

## 2. TaskListItem.tsx (832 lines) — Highest Impact

### What's Good
- Wrapped in `React.memo`
- `useCallback` for `handleDragStart` and `computeDropdownPos`
- `useMemo` for `effectiveTeamMemberIds`, `assignedTeamMembers`, `allSessions`

### Issues Found

#### [CRITICAL] Broad store selectors cause cascade re-renders (lines 227-232)
```tsx
const tasks = useMaestroStore(s => s.tasks);           // entire tasks object
const teamMembersMap = useMaestroStore(s => s.teamMembers);  // entire map
const deleteTask = useMaestroStore(s => s.deleteTask);
const updateTask = useMaestroStore(s => s.updateTask);
```

Every `TaskListItem` instance subscribes to the entire `tasks` and `teamMembers` store slices. When **any** task is updated, **every** TaskListItem re-renders. With 200+ tasks this is O(n) re-renders per task update.

**Fix:** Use `useShallow` with a combined selector, or better yet, only select the specific actions needed:
```tsx
const { deleteTask, updateTask } = useMaestroStore(
    useShallow(s => ({ deleteTask: s.deleteTask, updateTask: s.updateTask }))
);
```
For `tasks` — only used for `subtaskCount`, `totalDescendantCount`, and `parentTask` — pass these as props from parent or use a derived hook.

#### [HIGH] Component too large — needs splitting (832 lines, 13+ useState)
The expanded meta panel contains 4 independent dropdown systems (status, priority, team member, launch model), each with their own state, position calculations, portal rendering, and event handlers. These should be extracted:

Suggested splits:
- `TaskListItemCollapsed` — the main row (status radio, title, action buttons)
- `StatusDropdown` — inline status picker with portal
- `PriorityDropdown` — inline priority picker with portal
- `TeamMemberDropdown` — inline team member picker with portal
- `LaunchModelDropdown` — launch model picker with portal
- `TaskSessionChips` — session status display
- `TaskDocsList` — docs row

Opening one dropdown currently re-renders the entire 832-line component including all other dropdowns.

#### [HIGH] `subtaskCount` not memoized (line 271)
```tsx
const subtaskCount = Object.values(tasks).filter(t => t.parentId === task.id).length;
```
`Object.values(tasks)` creates a new array and `.filter()` iterates all tasks on **every render**. With 200+ tasks and 200+ TaskListItems, this is O(n^2) work.

**Fix:** Wrap in `useMemo` or compute in parent and pass as prop.

#### [HIGH] `totalDescendantCount` recursion (lines 273-279)
```tsx
const totalDescendantCount = useMemo(() => {
    const countDescendants = (parentId: string): number => {
        const children = Object.values(tasks).filter(t => t.parentId === parentId);
        return children.reduce((sum, child) => sum + 1 + countDescendants(child.id), 0);
    };
    return countDescendants(task.id);
}, [tasks, task.id]);
```
Recursive `Object.values().filter()` runs on every `tasks` change. For deeply nested trees this is expensive. Also, `tasks` changes on every task update, defeating the memoization.

**Fix:** Pre-compute descendant counts in the parent (e.g., in the task tree hook) and pass as props.

#### [HIGH] `useTaskSessions` called unconditionally for parent (line 255)
```tsx
const { sessions: parentSessions } = useTaskSessions(parentTask?.id);
```
Even non-subtask items trigger this hook (with `undefined`). If `useTaskSessions` makes API calls or subscribes to store data with `undefined`, it may cause unnecessary work.

**Fix:** Gate the hook call or ensure `useTaskSessions(undefined)` is a true no-op internally.

#### [MEDIUM] Many inline arrow functions in JSX
Approximately 20+ inline arrow functions in the JSX, especially in the expanded meta panel. Since the component is already `React.memo`'d, these don't cause external re-renders but do cause internal re-renders of child elements.

---

## 3. MultiProjectBoard.tsx (616 lines)

### What's Good
- `Board` and `UnifiedKanbanView` wrapped in `React.memo`
- `VirtualizedColumnBody` uses `@tanstack/react-virtual` for list virtualization
- Good use of `useCallback` for handlers
- Single-pass stats computation with `useMemo`

### Issues Found

#### [HIGH] `VirtualizedColumnBody` not wrapped in React.memo (line 416)
```tsx
function VirtualizedColumnBody({ tasks, dragState, ... }) {
```
This component re-renders whenever `UnifiedKanbanView` re-renders. During drag operations, `dragState` changes frequently, causing **all** columns (not just the dragged one) to re-render and re-virtualize.

**Fix:** Wrap in `React.memo`. Most columns' `tasks` prop is stable between renders.

#### [HIGH] Bare store selectors (lines 72-74)
```tsx
const maestroSessions = useMaestroStore((s) => s.sessions);
const teamMembers = useMaestroStore((s) => s.teamMembers);
const terminalSessions = useSessionStore((s) => s.sessions);
```
Three separate selectors returning full objects/arrays. Combined, any session or team member change triggers a Board re-render, which cascades to all children.

**Fix:** Use `useShallow` or combine selectors.

#### [MEDIUM] Inline object creation in `projectBadge` prop (lines 475-479)
```tsx
projectBadge={
    showProjectBadge
        ? { name: task.projectName, color: task.projectColor }
        : undefined
}
```
New object on every render per task card. With virtualization this is mitigated, but still creates GC pressure during scrolling.

**Fix:** Memoize per-task badge objects or use a stable cache.

#### [MEDIUM] Inline arrow functions for tab/layout buttons (6 occurrences)
```tsx
onClick={() => setActiveView("tasks")}    // line 247
onClick={() => setLayoutMode("grouped")}  // line 273
```

**Fix:** Use `useCallback` or event delegation.

---

## 4. ExecutionBar.tsx (592 lines)

### What's Good
- `useDropdownPosition` custom hook for portal positioning
- `useLayoutEffect` for synchronous position updates
- Sub-components (`TeamMemberDropdown`, `TeamMemberMultiDropdown`) are well-structured

### Issues Found

#### [HIGH] Main component not wrapped in React.memo
```tsx
export function ExecutionBar({ ... }: ExecutionBarProps) {
```
The parent (`MaestroPanel`) re-renders frequently (search input typing, filter changes, task updates). Every parent re-render re-renders ExecutionBar even when its props haven't changed.

**Fix:** Wrap in `React.memo`.

#### [HIGH] Sub-components not wrapped in React.memo
`TeamMemberDropdown` and `TeamMemberMultiDropdown` receive callback props and will re-render on every parent re-render.

**Fix:** Wrap both in `React.memo`.

#### [MEDIUM] Non-memoized handlers (lines 314-321)
```tsx
const handleSelectExecuteMember = (id: string | null) => { ... };
const handleSelectCoordinator = (id: string | null) => { ... };
```
These are plain functions, not `useCallback`. If ExecutionBar were memoized, these would need to be stable for children.

**Fix:** Wrap in `useCallback`.

#### [MEDIUM] Inline functions in orchestrate mode (lines 453-462)
```tsx
onToggle={(id) => { ... }}
onSelectAll={() => setSelectedWorkerIds(new Set(workerMembers.map(m => m.id)))}
onClearAll={() => setSelectedWorkerIds(new Set())}
```
New functions per render, defeating any memoization on `TeamMemberMultiDropdown`.

**Fix:** Extract as `useCallback` hooks.

#### [LOW] Duplicated `AGENT_TOOLS` constant
Same constant appears in both `ExecutionBar.tsx` and `TaskListItem.tsx`.

**Fix:** Extract to a shared constants file (e.g., `boardConstants.ts`).

---

## 5. CreateTaskModal.tsx (420 lines)

### What's Good
- Well-decomposed into sub-components (`TaskFormHeader`, `TaskDescriptionField`, `TaskTabBar`, etc.)
- Form logic extracted to `useTaskForm` hook
- Reference picker extracted to `useReferenceTaskPicker` hook
- Early return for `!isOpen`

### Issues Found

#### [MEDIUM] Not wrapped in React.memo
```tsx
export function CreateTaskModal({ ... }: CreateTaskModalProps) {
```
Parent always triggers re-render of this component, running all hooks even when `isOpen=false`. While the early return prevents JSX rendering, hooks still execute.

**Fix:** Wrap in `React.memo`. Since `isOpen` changes infrequently, this prevents hook execution on unrelated parent state changes.

#### [MEDIUM] Broad store selectors (lines 90-91)
```tsx
const tasks = useMaestroStore(s => s.tasks);
const teamMembersMap = useMaestroStore(s => s.teamMembers);
```
Every task/team member update triggers re-render even when modal is open.

**Fix:** Use `useShallow` or only select when `isOpen` is true.

#### [MEDIUM] `JSON.stringify` in effect deps (line 113)
```tsx
useEffect(() => { ... }, [isEditMode, isOpen, task?.id, JSON.stringify(task?.referenceTaskIds)]);
```
`JSON.stringify` runs on every render to produce a dep value. This is an anti-pattern — use a custom comparison or stable reference.

**Fix:** Use `useMemo` to create a stable key:
```tsx
const refTaskIdsKey = useMemo(() => task?.referenceTaskIds?.join(',') ?? '', [task?.referenceTaskIds]);
```

#### [LOW] Non-memoized handlers (lines 124-195)
`handleClose`, `handleConfirmDiscard`, `handleToggleLaunchConfig`, `handleSubmit`, `handleSave`, `handleAddSubtask`, `handleKeyDown` — all plain functions. Low impact since the modal is typically the leaf of the render tree.

#### [LOW] Inline style objects (lines 257-290)
Multiple inline `style={{...}}` objects for image previews and buttons. Creates new objects each render.

**Fix:** Extract to CSS classes or module-level constants.

---

## 6. Dashboard.tsx (563 lines)

### What's Good
- Main component wrapped in `React.memo`
- `useMemo` for `timeRange`
- Data computation delegated to `useDashboardData` hook
- `LazyVisible` component with IntersectionObserver for deferred chart rendering
- Module-scope `TIME_RANGE_PRESETS` constant

### Issues Found

#### [MEDIUM] Sub-components not memoized
`ChartTooltip`, `MetricCard`, `CalendarHeatmap`, `DueDateList`, `TeamMemberStatsView` — none wrapped in `React.memo`. When the dashboard re-renders (time range change), all sub-components re-render even if their data hasn't changed.

**Fix:** Wrap `MetricCard`, `CalendarHeatmap`, `DueDateList`, `TeamMemberStatsView` in `React.memo`. `ChartTooltip` is lightweight and called by Recharts internally, so less important.

#### [MEDIUM] Recharts tooltip JSX recreation (lines 404, 446, 478, 514)
```tsx
<Tooltip content={<ChartTooltip />} />
```
Creates new JSX element reference each render. Recharts may or may not optimize this internally.

**Fix:** Memoize as a module-scope constant: `const CHART_TOOLTIP = <ChartTooltip />;`

#### [LOW] Inline `onClick` in time range buttons (line 348)
```tsx
onClick={() => setPreset(p.value)}
```
Creates new function per preset per render.

**Fix:** Use event delegation or extract a memoized `TimeRangeButton` component.

#### [LOW] CalendarHeatmap recomputes SVG layout every render
The weeks/months grouping logic runs on every data change even if only the time range preset changed. This is acceptable given the IntersectionObserver guard via `LazyVisible`.

---

## 7. SkillsPanel.tsx (386 lines)

### What's Good
- `useMemo` for filtering/grouping skills
- `useCallback` for `loadSkills`
- Moderate complexity, well-structured

### Issues Found

#### [MEDIUM] Not wrapped in React.memo
```tsx
export function SkillsPanel({ project }: SkillsPanelProps) {
```
Re-renders on any MaestroPanel state change when the skills tab is active.

**Fix:** Wrap in `React.memo`.

#### [LOW] `renderSkillCard` and `renderSection` are inline closures (lines 79, 171)
These create new function references and new closures on every render. Skills list is typically small (<50 items) so impact is low.

**Fix:** Extract as memoized sub-components if skills lists grow.

#### [LOW] `toggleSection` not wrapped in useCallback (line 70)
```tsx
const toggleSection = (section: string) => { ... };
```

**Fix:** Wrap in `useCallback`.

---

## Prioritized Recommendations

### P0 — Do Now (highest impact, lowest effort)

1. **Wrap `ExecutionBar` in `React.memo`** — single line change, prevents re-renders from MaestroPanel search/filter typing
2. **Fix TaskListItem store selectors** — use `useShallow` to combine selectors; prevents O(n) cascade re-renders
3. **Wrap `VirtualizedColumnBody` in `React.memo`** — prevents all-columns re-render during drag
4. **Move hooks above early returns in MaestroPanel** — bug fix for rules of hooks violation

### P1 — Do Soon (high impact, moderate effort)

5. **Split TaskListItem into sub-components** — extract dropdown sections into memoized components
6. **Memoize `subtaskCount` and pre-compute `totalDescendantCount`** in parent/tree hook
7. **Convert broad store selectors to `useShallow`** in MultiProjectBoard (lines 72-74) and CreateTaskModal (lines 90-91)
8. **Memoize inline callbacks** in MaestroPanel JSX (8 occurrences) and ExecutionBar (4 occurrences)

### P2 — Do Later (moderate impact)

9. **Wrap Dashboard sub-components in `React.memo`** (MetricCard, CalendarHeatmap, etc.)
10. **Wrap `SkillsPanel` and `CreateTaskModal` in `React.memo`**
11. **Extract `AGENT_TOOLS` to shared constants** (deduplicate between TaskListItem and ExecutionBar)
12. **Replace `JSON.stringify` deps** in CreateTaskModal with stable keys

### P3 — Nice to Have (low impact)

13. **Extract inline style objects** to CSS classes or module-scope constants
14. **Memoize Recharts tooltip elements** as module-scope constants
15. **Event delegation** for repeated button groups (time range presets, tab buttons)

---

## Estimated Impact

Assuming a project with ~200 tasks, ~10 team members, ~20 active sessions:

| Fix | Re-renders Saved Per Action | Affected Actions |
|---|---|---|
| TaskListItem store selectors | ~200 per task update | Task CRUD, status change, assignment |
| ExecutionBar React.memo | ~1 per keystroke/filter | Search typing, filter toggling |
| VirtualizedColumnBody memo | ~5 columns per drag frame | Board drag & drop |
| TaskListItem splitting | ~4 sub-trees per dropdown toggle | Expanding any task meta |
| Memoize subtaskCount | ~200 computations per task update | Any task change |
| Board store selectors | ~1 full board re-render | Any session/member change |
