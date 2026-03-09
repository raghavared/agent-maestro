# Plan: React Memoization & Re-render Prevention

**Reference:** `docs/ui-rerender-analysis.md`
**Scope:** 34 issues across 16 components — this plan covers all CRITICAL, HIGH, and MEDIUM fixes.

---

## Phase 1: Quick Wins — React.memo Wrapping (8 components)

Low effort, high impact. Add `React.memo` to components that are rendered in lists or receive frequently-changing parent props.

### 1.1 Wrap `SessionsSection` in React.memo
- **File:** `maestro-ui/src/components/SessionsSection.tsx` (line 113)
- **Change:** `export const SessionsSection = React.memo(function SessionsSection({...}: SessionsSectionProps) { ... })`
- **Impact:** Prevents full sidebar re-render on every parent state change

### 1.2 Wrap `TaskListItem` in React.memo
- **File:** `maestro-ui/src/components/maestro/TaskListItem.tsx` (line 102)
- **Change:** `export const TaskListItem = React.memo(function TaskListItem({...}) { ... })`
- **Impact:** CRITICAL — every task in the list currently re-renders on any state change

### 1.3 Wrap `SortableTaskItem` in React.memo
- **File:** `maestro-ui/src/components/maestro/SortableTaskList.tsx` (line 26)
- **Change:** Wrap existing function in `React.memo`
- **Impact:** Prevents all sortable items from re-rendering on drag state changes

### 1.4 Wrap `SortableSessionItem` in React.memo
- **File:** `maestro-ui/src/components/SessionsSection.tsx` (line 83)
- **Change:** Wrap existing function in `React.memo`
- **Impact:** Prevents all session items from re-rendering on drag state changes

### 1.5 Wrap `MaestroSessionContent` in React.memo (with custom comparator)
- **File:** `maestro-ui/src/components/maestro/MaestroSessionContent.tsx` (line 127)
- **Change:** `export const MaestroSessionContent = React.memo(function MaestroSessionContent({...}) { ... })`
- **Note:** May need a custom comparator since it receives `allTasks: Map<string, MaestroTask>` whose reference changes on any task update. Alternatively, avoid passing the full Map and use a selector in the child.

### 1.6 Wrap `TreeTaskNodeContent` in React.memo
- **File:** `maestro-ui/src/components/maestro/MaestroSessionContent.tsx` (line 59)
- **Change:** Wrap in `React.memo` — this is recursive, so memoization prevents full-tree re-renders
- **Impact:** Prevents cascading re-renders in session content tree

### 1.7 Wrap `TaskStatusControl` in React.memo
- **File:** `maestro-ui/src/components/maestro/TaskStatusControl.tsx` (line 42)
- **Change:** Wrap in `React.memo`
- **Impact:** Rendered for every task that shows a status control

### 1.8 Wrap `TeamSessionGroup` in React.memo
- **File:** `maestro-ui/src/components/maestro/TeamSessionGroup.tsx` (line 16)
- **Change:** Wrap in `React.memo`
- **Impact:** Receives Map props that change frequently

### 1.9 Wrap `TaskTabContent` in React.memo
- **File:** `maestro-ui/src/components/maestro/TaskTabContent.tsx` (line 16)
- **Change:** Wrap in `React.memo`

---

## Phase 2: Move Static Constants to Module Scope

Zero-risk changes — move objects that don't depend on component state out of the function body.

### 2.1 Move `AGENT_TOOL_ICONS` to module scope
- **File:** `maestro-ui/src/components/SessionsSection.tsx` (lines 358-362)
- **Change:** Move the `const AGENT_TOOL_ICONS: Record<string, string> = {...}` declaration outside the component, to the top of the file (after imports).

### 2.2 Move `presets` array to module scope
- **File:** `maestro-ui/src/components/maestro/Dashboard.tsx` (lines 292-300)
- **Change:** Move the static `presets` array outside the component body.

### 2.3 Extract `showPermanentDelete` constant
- **File:** `maestro-ui/src/components/maestro/SortableTaskList.tsx` (lines 127-129)
- **Change:** Create a module-level constant: `const PERMANENT_DELETE_OPTIONS = { showPermanentDelete: true } as const;`

---

## Phase 3: useMemo for Computed Values

Memoize derived data that is recomputed on every render.

### 3.1 Memoize `SortableContext` items in SessionsSection
- **File:** `maestro-ui/src/components/SessionsSection.tsx` (line 893)
- **Change:**
  ```tsx
  const sortableSessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  // Then use: <SortableContext items={sortableSessionIds}>
  ```

### 3.2 Memoize `ids` array in SortableTaskList
- **File:** `maestro-ui/src/components/maestro/SortableTaskList.tsx` (line 106)
- **Change:**
  ```tsx
  const ids = useMemo(() => roots.map((r) => r.id), [roots]);
  ```

### 3.3 Memoize `activeRoots`, `completedRoots`, `pinnedRoots`, `archivedRoots` in MaestroPanel
- **File:** `maestro-ui/src/components/maestro/MaestroPanel.tsx` (lines 367-396)
- **Change:** Wrap each in `useMemo` with appropriate dependencies (taskTree, searchQuery, activeTab, pinnedTaskIds):
  ```tsx
  const activeRoots = useMemo(() => {
    return filterBySearch(taskTree.filter(...).sort(...));
  }, [taskTree, searchQuery, /* other deps */]);
  // Repeat for completedRoots, pinnedRoots, archivedRoots
  ```

### 3.4 Memoize `SortableTaskItem` style object
- **File:** `maestro-ui/src/components/maestro/SortableTaskList.tsx` (lines 36-41)
- **Change:** Use `useMemo` based on `transform`, `transition`, `isDragging`

### 3.5 Memoize `SortableSessionItem` style object
- **File:** `maestro-ui/src/components/SessionsSection.tsx` (lines 93-98)
- **Change:** Same as 3.4

---

## Phase 4: Extract `SessionItem` Component from `renderSessionItem`

This is the single highest-impact refactor for the sidebar.

### 4.1 Create `SessionItem` as a separate memoized component
- **File:** Create in `maestro-ui/src/components/SessionItem.tsx` (or inline in SessionsSection.tsx)
- **Current:** `renderSessionItem` (lines 365-645 in SessionsSection.tsx) is a 280-line inline function that captures the entire parent scope.
- **Change:**
  1. Extract `SessionItem` as a standalone `React.memo`-wrapped component
  2. Define explicit props interface:
     ```tsx
     interface SessionItemProps {
       session: Session;
       teamColor: TeamColor | null;
       isActive: boolean;
       isExpanded: boolean;
       maestroSession: MaestroSession | null;
       tasks: MaestroTask[];
       isLoadingTasks: boolean;
       isResuming: boolean;
       onSelect: (id: string) => void;
       onToggleExpand: (sessionId: string, maestroSessionId?: string | null) => void;
       onClose: (id: string) => void;
       onOpenSessionModal: (id: string) => void;
       onOpenLogModal: (id: string) => void;
       onResume: (id: string) => Promise<void>;
     }
     ```
  3. In `SessionsSection`, replace `renderSessionItem(s, teamColor)` calls with `<SessionItem session={s} teamColor={teamColor} ... />`
  4. Ensure all callback props are stable (see Phase 5)

- **Impact:** Each session item only re-renders when its own props change, not when any sibling or parent state changes.

---

## Phase 5: Convert MaestroPanel Handlers to useCallback

Convert all 11 non-memoized handlers to `useCallback`.

### 5.1 Convert all handler functions in MaestroPanel
- **File:** `maestro-ui/src/components/maestro/MaestroPanel.tsx`
- **Handlers to convert (lines 245-355):**

| Handler | Line | Dependencies |
|---------|------|-------------|
| `handleCreateTask` | 245 | `[createTask, projectId]` |
| `handleUpdateTask` | 281 | `[updateTask]` |
| `handleDeleteTask` | 285 | `[deleteTask]` |
| `handleWorkOnTask` | 289 | `[workOnTask, projectId, agentTool, selectedModel]` |
| `handleAssignTeamMember` | 310 | `[assignTeamMember]` |
| `handleAddSubtask` | 314 | `[setAddingSubtaskTo, addingSubtaskTo]` |
| `handleInlineAddSubtask` | 319 | `[createTask, projectId]` |
| `handleToggleCollapse` | 329 | `[setCollapsedTasks]` |
| `handleToggleAddSubtask` | 338 | `[handleAddSubtask, handleToggleCollapse]` |
| `handleToggleSubtask` | 343 | `[toggleSubtaskCompletion]` |
| `handleDeleteSubtask` | 351 | `[deleteSubtask]` |
| `handleTogglePin` | 355 | `[togglePin]` |

- **Pattern:**
  ```tsx
  const handleDeleteTask = useCallback(async (taskId: string) => {
    await deleteTask(taskId);
  }, [deleteTask]);
  ```

### 5.2 Convert SessionsSection handlers to useCallback
- **File:** `maestro-ui/src/components/SessionsSection.tsx`
- **Handlers:**
  - `toggleSession` (line 281) → `useCallback` with `[expandedSessions, fetchMaestroData]`
  - `fetchMaestroData` (line 298) → `useCallback` with `[fetchSession]`
  - `onToggleCollapse` (line 357) → `useCallback`
  - Settings button `onClick` (line 691) → `useCallback`

---

## Phase 6: Extract `TaskNodeRenderer` Component

Second highest-impact refactor — the task list.

### 6.1 Extract `renderTaskNode` into a memoized `TaskNodeRenderer` component
- **File:** `maestro-ui/src/components/maestro/MaestroPanel.tsx` (lines 402-459)
- **Current:** `renderTaskNode` is an inline function that captures 15+ closure variables and creates 10+ inline arrow function props per task node.
- **Change:**
  1. Create `TaskNodeRenderer` as a `React.memo`-wrapped component (can live in MaestroPanel.tsx or a separate file)
  2. Props interface:
     ```tsx
     interface TaskNodeRendererProps {
       node: TaskTreeNode;
       depth: number;
       showPermanentDelete?: boolean;
       projectId: string;
       isCollapsed: boolean;
       isSlidingOut: boolean;
       isAddingSubtask: boolean;
       executionMode: ExecutionMode;
       isSelectedForExecution: boolean;
       isSessionTask: boolean;
       onSelect: (taskId: string) => void;
       onWorkOn: (taskId: string) => void;
       onWorkOnWithOverride: (taskId: string, agentTool: AgentTool, model: ModelType) => void;
       onAssignTeamMember: (taskId: string, tmId: string) => void;
       onJumpToSession: (sid: string) => void;
       onNavigateToTask: (taskId: string) => void;
       onToggleChildrenCollapse: (taskId: string) => void;
       onTogglePin: (taskId: string) => void;
       onToggleSelect: (taskId: string) => void;
       onAddSubtask: (parentId: string, title: string) => void;
     }
     ```
  3. **Key insight:** All callbacks should accept `taskId` as a parameter instead of closing over `node`. This means the parent passes stable callbacks (via `useCallback`) that don't change per-node:
     ```tsx
     // In MaestroPanel:
     const handleSelectTask = useCallback((taskId: string) => {
       useUIStore.getState().setTaskDetailOverlay({ taskId, projectId });
     }, [projectId]);

     // In TaskNodeRenderer:
     <TaskListItem onSelect={() => onSelect(node.id)} ... />
     ```
  4. This eliminates the per-node inline closures — the parent has a single stable `handleSelectTask`, and the child creates a trivial wrapper (which React.memo on TaskListItem handles).

---

## Phase 7: Replace Per-Item Inline Closures in Kanban Views

### 7.1 Fix inline closures in `UnifiedKanbanView`
- **File:** `maestro-ui/src/components/maestro/MultiProjectBoard.tsx` (lines 546-552)
- **Change:** Convert `onSelectTask` and `onWorkOnTask` to accept `taskId` and look up the task internally, OR use a curried callback pattern:
  ```tsx
  // Option A: ID-based callbacks
  const handleSelectTask = useCallback((taskId: string, projectId: string) => {
    onSelectTask(taskId, projectId);
  }, [onSelectTask]);
  // TaskCard receives taskId and calls handleSelectTask(task.id, task.projectId)

  // Option B: Curried callbacks (if TaskCard must accept simple onClick)
  // Less ideal but simpler — leave as-is if TaskCard is already memoized with React.memo
  ```
- **For `projectBadge` object:** Pass `projectName` and `projectColor` as separate string props to `TaskCard` instead of creating a new object.

### 7.2 Fix inline closures in `ProjectKanbanRow`
- **File:** `maestro-ui/src/components/maestro/ProjectKanbanRow.tsx` (lines 140-141)
- **Same pattern as 7.1**

### 7.3 Fix inline closures in `KanbanColumn`
- **File:** `maestro-ui/src/components/maestro/KanbanColumn.tsx` (lines 95-97)
- **Same pattern as 7.1**

### 7.4 Update `TaskCard` to accept ID-based callbacks
- **File:** `maestro-ui/src/components/maestro/TaskCard.tsx`
- **Change:** Modify `TaskCard` props to accept `taskId` + stable callbacks instead of pre-bound closures:
  ```tsx
  // Before:
  onClick: () => void;
  // After:
  onClick: (taskId: string) => void;
  ```
  Then internally: `onClick={() => props.onClick(task.id)}`
  Since TaskCard is already `React.memo`-wrapped, this ensures stable references prevent re-renders.

### 7.5 Fix `TaskCard` `handleDragStart` dependency
- **File:** `maestro-ui/src/components/maestro/TaskCard.tsx` (line 62)
- **Change:** `}, [task])` → `}, [task.title, task.description, task.initialPrompt])`

---

## Phase 8: Narrow Zustand Selectors

### 8.1 Fix `SessionDetailModal` broad selector
- **File:** `maestro-ui/src/components/maestro/SessionDetailModal.tsx` (line 51)
- **Current:** `const tasks = useMaestroStore((s) => s.tasks)` — subscribes to entire tasks Map
- **Change:** Only select the specific tasks needed:
  ```tsx
  const linkedTasks = useMaestroStore(useCallback((s) => {
    if (!session?.taskIds?.length) return [];
    return session.taskIds.map(id => s.tasks.get(id)).filter(Boolean);
  }, [session?.taskIds]));
  ```

### 8.2 Audit `TaskListItem` store subscriptions
- **File:** `maestro-ui/src/components/maestro/TaskListItem.tsx` (lines 227-232)
- **Current:** Subscribes to `s.tasks`, `s.teamMembers`, `s.openDocument`, `s.setActiveId`, `s.deleteTask`, `s.updateTask`
- **Change:**
  - `s.tasks` is very broad — if only used for subtask lookup, pass subtasks as props from parent
  - `s.teamMembers` — check if a narrower selector (e.g., specific team member by ID) is feasible
  - Action selectors (`deleteTask`, `updateTask`) are fine — they're stable references

---

## Phase 9: Task-Modal & Dashboard (LOW priority)

### 9.1 Wrap task-modal tab components in React.memo
- **Files:** `maestro-ui/src/components/maestro/task-modal/*.tsx`
- **Components:** `DetailsTab`, `SessionsTab`, `SubtasksTab`, `TimelineTab`, `TaskFormHeader`
- **Change:** Add `React.memo` wrapper to each

### 9.2 Wrap Dashboard sub-components in React.memo
- **File:** `maestro-ui/src/components/maestro/Dashboard.tsx`
- **Components:** `MetricCard`, `CalendarHeatmap` (rendered in lists)

---

## Execution Order (Recommended)

| Order | Phase | Est. Risk | Reason |
|-------|-------|-----------|--------|
| 1 | Phase 2 | None | Move constants — zero behavioral change |
| 2 | Phase 1 | Very Low | Add React.memo — worst case: no improvement |
| 3 | Phase 3 | Very Low | Add useMemo — same output, just cached |
| 4 | Phase 5 | Low | useCallback — stable references |
| 5 | Phase 8 | Low | Narrow selectors — less re-rendering |
| 6 | Phase 4 | Medium | Extract SessionItem — refactor |
| 7 | Phase 6 | Medium | Extract TaskNodeRenderer — refactor |
| 8 | Phase 7 | Medium | Kanban callback pattern — API change |
| 9 | Phase 9 | Very Low | Low-priority memos |

---

## Testing Strategy

1. **Visual regression:** Manually verify sidebar session list, task list, kanban board, and session content render correctly after each phase
2. **Performance verification:** Use React DevTools Profiler before/after to measure:
   - Number of component re-renders on task update
   - Number of component re-renders on session selection
   - Time per render cycle
3. **Functional testing:** Verify all interactions still work:
   - Session selection, expansion, drag reorder
   - Task CRUD, drag reorder, subtask add/toggle
   - Kanban card click, work-on button
   - Session resume/close
4. **Edge cases:**
   - Empty states (no sessions, no tasks)
   - Large lists (50+ sessions, 100+ tasks)
   - Rapid state changes (quick toggling, multiple clicks)
