# Multi-Project Board Design (v2)

## Core Principle

**One board component, two entry points.** The project-level board is just the multi-project board with one project pre-selected. There is no separate `TaskBoardOverlay` — it gets replaced by the unified board.

---

## Current Architecture

```
App.tsx
  ├─ ProjectTabBar
  │     └─ [+] button → new project / open saved project
  ├─ Sidebar (SessionsSection)
  ├─ Main (Terminal Area)
  └─ AppRightPanel
        └─ MaestroPanel (single projectId)
              └─ "$ board" button → TaskBoardOverlay (single-project overlay)
```

### Key Files
- `ProjectTabBar.tsx` — project tabs + [+] button + settings/sound buttons on right
- `AppRightPanel.tsx` — renders `MaestroPanel` for the active project
- `MaestroPanel.tsx` — task list, filters, "$ board" button opens `TaskBoardOverlay`
- `TaskBoardOverlay.tsx` — single-project kanban overlay with tasks/sessions tabs

---

## Proposed Design

### Entry Points

**1. MaestroPanel "$ board" button** (project-level board)
- Opens the board with the current project pre-selected
- Sidebar shows all projects but only the active one is checked
- User can check additional projects to expand into multi-project view
- Quick action — one click opens the board scoped to what you're working on

**2. ProjectTabBar board button** (multi-project board)
- New board icon button placed **to the left of the [+] button** in `projectTabBarActions`
- Opens the board with ALL open projects selected
- This is the "overview" mode for seeing everything at once

```
┌─ ProjectTabBar ────────────────────────────────────────────────┐
│ [agent-maestro] [my-api] [mobile-app]     [⊞] [+] [⚙] [🔊]  │
│                                             ↑                   │
│                                        Board button             │
└────────────────────────────────────────────────────────────────┘
```

### Architecture

```
App.tsx
  ├─ ProjectTabBar
  │     └─ projectTabBarActions: [⊞ Board] [+ Add] [⚙ Settings] [🔊 Sound]
  ├─ Sidebar / Main / AppRightPanel (existing)
  └─ <Board />  ← portal to body, replaces TaskBoardOverlay
       ├─ Project Selector Sidebar (left)
       ├─ Board Header (tabs, stats, layout toggle, close)
       └─ Board Content
            ├─ Tasks View (kanban)
            └─ Sessions View (terminals)
```

### Component: `Board`

The `Board` component replaces `TaskBoardOverlay`. It is a single unified component that handles both single-project and multi-project views.

```tsx
type BoardProps = {
  // Which projects to initially select
  initialSelectedProjectIds: string[];
  // Callbacks
  onClose: () => void;
  onSelectTask: (taskId: string, projectId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onWorkOnTask: (task: MaestroTask, project: MaestroProject) => void;
  onCreateMaestroSession: typeof createMaestroSession;
};
```

**Internal State:**
- `selectedProjectIds: Set<string>` — initialized from `initialSelectedProjectIds`
- `activeView: 'tasks' | 'sessions'`
- `layoutMode: 'grouped' | 'unified'`
- `collapsedProjects: Set<string>` — which project rows are collapsed
- `sidebarOpen: boolean` — whether project selector is visible

**Data Sources (reads from stores):**
- `useProjectStore` → `projects[]` (all open projects)
- `useMaestroStore` → `sessions` (maestro sessions, filtered by selected projects)
- `useSessionStore` → `sessions` (terminal sessions, filtered by selected projects)
- For tasks: calls `maestroClient.getTasks(projectId)` for each selected project

---

## Detailed Layout

### Board Header

```
┌─────────────────────────────────────────────────────────────────┐
│ [☰]  [⊞ Tasks] [◈ Sessions]   agent-maestro + 2 more           │
│                                                                  │
│                        ◉ 5  ○ 8  ✗ 2  ◎ 1  ✓ 12    [⊟][⊞] [✕] │
└─────────────────────────────────────────────────────────────────┘
  ↑                                                     ↑  ↑   ↑
  sidebar toggle                               layout toggles  close
```

- **Left:** Sidebar toggle `[☰]`, view tabs (Tasks/Sessions), project summary text
- **Right:** Aggregated task stats, layout toggle (grouped/unified), close button
- Project summary: shows first project name + "+ N more" if multiple selected

### Project Selector Sidebar

Collapsible left sidebar. When single project is selected (opened from MaestroPanel), sidebar is collapsed by default. When opened from ProjectTabBar, sidebar is expanded.

```
┌───────────────────────────┐
│ PROJECTS                  │
│ ─────────────────         │
│ [Select All]              │
│                           │
│ ● agent-maestro        ☑  │
│   12 tasks · 3 sessions   │
│                           │
│ ● my-api-server        ☑  │
│   5 tasks · 1 session     │
│                           │
│ ● docs-site            ☐  │
│   2 tasks · 0 sessions    │
│                           │
│ ● mobile-app           ☑  │
│   8 tasks · 2 sessions    │
└───────────────────────────┘
```

- Each project has an auto-assigned color dot `●`
- Checkbox toggles inclusion in the board
- Shows task count and active session count
- "Select All" / "Deselect All" toggle at top

### Tasks View — Grouped Layout (Default)

Each selected project gets a collapsible section with its own kanban row.

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │  ▼ ● agent-maestro                    ◉ 2  ○ 4  ✓ 6 │
│ PROJECTS │  ┌──────────┬──────────┬──────────┬────────┬───────┐ │
│          │  │ BACKLOG  │ BLOCKED  │IN PROGR  │REVIEW  │ DONE  │ │
│ ☑ maestro│  │ [Task 1] │ [Task 3] │ [Task 5] │ [T7]   │ [T9]  │ │
│ ☑ api    │  │ [Task 2] │          │ [Task 6] │        │ [T10] │ │
│ ☐ docs   │  └──────────┴──────────┴──────────┴────────┴───────┘ │
│ ☑ mobile │                                                       │
│          │  ▼ ● my-api-server                    ◉ 1  ○ 2  ✓ 2 │
│          │  ┌──────────┬──────────┬──────────┬────────┬───────┐ │
│          │  │ BACKLOG  │ BLOCKED  │IN PROGR  │REVIEW  │ DONE  │ │
│          │  │ [Task 11]│          │ [Task 13]│        │ [T15] │ │
│          │  └──────────┴──────────┴──────────┴────────┴───────┘ │
│          │                                                       │
│          │  ▼ ● mobile-app                       ◉ 2  ○ 2  ✓ 0 │
│          │  ┌──────────┬──────────┬──────────┬────────┬───────┐ │
│          │  │ BACKLOG  │ BLOCKED  │IN PROGR  │REVIEW  │ DONE  │ │
│          │  │ [Task 16]│ [Task 18]│ [Task 20]│        │       │ │
│          │  └──────────┴──────────┴──────────┴────────┴───────┘ │
└──────────┴──────────────────────────────────────────────────────┘
```

**Project Row Header:** Collapsible `▼`/`▶`, project color dot, project name, per-project stats
**Kanban Columns:** Same 5 columns as current (BACKLOG, BLOCKED, IN PROGRESS, REVIEW, DONE)
**Task Cards:** Same as current `TaskBoardCard` — no project badge needed in grouped mode since the project context is clear from the row

### Tasks View — Unified Layout

All tasks in one kanban, with project color badges on cards.

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │  BACKLOG        BLOCKED      IN PROGRESS  REVIEW DONE│
│ PROJECTS │  ┌──────────┐  ┌──────────┐ ┌──────────┐            │
│          │  │● maestro  │  │● maestro  │ │● maestro  │            │
│ ☑ maestro│  │ Task 1    │  │ Task 3    │ │ Task 5    │ ...        │
│ ☑ api    │  └──────────┘  └──────────┘ └──────────┘            │
│ ☐ docs   │  ┌──────────┐  ┌──────────┐ ┌──────────┐            │
│ ☑ mobile │  │● api      │  │● mobile   │ │● maestro  │            │
│          │  │ Task 11   │  │ Task 18   │ │ Task 6    │            │
│          │  └──────────┘  └──────────┘ └──────────┘            │
│          │  ┌──────────┐               ┌──────────┐            │
│          │  │● mobile   │               │● api      │            │
│          │  │ Task 16   │               │ Task 13   │            │
│          │  └──────────┘               └──────────┘            │
└──────────┴──────────────────────────────────────────────────────┘
```

Cards show a small project color dot + abbreviated project name. Cards within each column are grouped by project, then sorted by priority.

### Sessions View

Terminal sessions grouped by project. Same DOM reparenting approach as current `TerminalSessionColumn`.

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │  ● agent-maestro                                      │
│ PROJECTS │  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│          │  │ ◉ worker-1  │  │ ○ worker-2  │  │ ◉ orch-1   │      │
│ ☑ maestro│  │ [terminal]  │  │ [terminal]  │  │ [terminal]  │      │
│ ☑ api    │  └────────────┘  └────────────┘  └────────────┘      │
│ ☐ docs   │                                                       │
│ ☑ mobile │  ● my-api-server                                      │
│          │  ┌────────────┐                                       │
│          │  │ ○ worker-1  │                                       │
│          │  │ [terminal]  │                                       │
│          │  └────────────┘                                       │
│          │                                                       │
│          │  ● mobile-app                                          │
│          │  ┌────────────┐  ┌────────────┐                       │
│          │  │ ◉ worker-1  │  │ ○ worker-2  │                       │
│          │  │ [terminal]  │  │ [terminal]  │                       │
│          │  └────────────┘  └────────────┘                       │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## Integration Details

### MaestroPanel Changes

Replace the current board button and `TaskBoardOverlay` usage:

```tsx
// MaestroPanel.tsx — BEFORE
const [showBoard, setShowBoard] = useState(false);

// In command bar:
<button onClick={() => setShowBoard(true)}>$ board</button>

// In render:
{showBoard && <TaskBoardOverlay tasks={...} projectName={...} onClose={...} />}
```

```tsx
// MaestroPanel.tsx — AFTER
// Remove showBoard state and TaskBoardOverlay import
// Add new prop:
type MaestroPanelProps = {
  // ... existing props ...
  onOpenBoard: (projectId: string) => void;  // NEW
};

// In command bar:
<button onClick={() => onOpenBoard(projectId)}>$ board</button>
```

### ProjectTabBar Changes

Add a board button in `projectTabBarActions`:

```tsx
// ProjectTabBar.tsx — add new prop
type ProjectTabBarProps = {
  // ... existing props ...
  onOpenBoard: () => void;  // NEW — opens board with all projects
};

// In projectTabBarActions div, before the [+] button:
<button
  type="button"
  className="projectTabBarBtn"
  onClick={onOpenBoard}
  title="Project Board"
>
  <Icon name="grid" size={14} />  {/* or "board" icon */}
</button>
```

### App.tsx Changes

Manage board state at the App level since both ProjectTabBar and MaestroPanel need to open it:

```tsx
// App.tsx
const [boardOpen, setBoardOpen] = useState(false);
const [boardInitialProjects, setBoardInitialProjects] = useState<string[]>([]);

const handleOpenProjectBoard = useCallback((projectId: string) => {
  // Single project board — opened from MaestroPanel "$ board"
  setBoardInitialProjects([projectId]);
  setBoardOpen(true);
}, []);

const handleOpenMultiProjectBoard = useCallback(() => {
  // Multi-project board — opened from ProjectTabBar button
  // Pre-select all currently open projects
  setBoardInitialProjects(projects.map(p => p.id));
  setBoardOpen(true);
}, [projects]);

// Pass to ProjectTabBar:
<ProjectTabBar
  {...existingProps}
  onOpenBoard={handleOpenMultiProjectBoard}
/>

// Pass to MaestroPanel (via AppRightPanel):
<MaestroPanel
  {...existingProps}
  onOpenBoard={handleOpenProjectBoard}
/>

// Render board:
{boardOpen && (
  <Board
    initialSelectedProjectIds={boardInitialProjects}
    onClose={() => setBoardOpen(false)}
    onSelectTask={handleBoardSelectTask}
    onUpdateTaskStatus={handleBoardUpdateTaskStatus}
    onWorkOnTask={handleBoardWorkOnTask}
    onCreateMaestroSession={createMaestroSession}
  />
)}
```

### AppRightPanel Changes

Pass the new `onOpenBoard` prop through to MaestroPanel:

```tsx
// AppRightPanel.tsx
type AppRightPanelProps = {
  forceMobileOpen?: boolean;
  onOpenBoard?: (projectId: string) => void;  // NEW
};

// Pass down:
<MaestroPanel
  {...existingProps}
  onOpenBoard={(projectId) => onOpenBoard?.(projectId)}
/>
```

---

## Data Flow

### Task Loading

```typescript
// Inside Board component
const projects = useProjectStore(s => s.projects);

// Custom hook that fetches tasks for multiple projects
const useMultiProjectTasks = (selectedProjectIds: string[]) => {
  const [tasksByProject, setTasksByProject] = useState<Map<string, MaestroTask[]>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedProjectIds.length === 0) return;
    setLoading(true);

    Promise.all(
      selectedProjectIds.map(async (pid) => {
        const tasks = await maestroClient.getTasks(pid);
        return [pid, tasks] as const;
      })
    ).then(results => {
      const map = new Map(results);
      setTasksByProject(map);
      setLoading(false);
    });
  }, [selectedProjectIds]);

  return { tasksByProject, loading };
};
```

### Session Filtering

```typescript
// Terminal sessions scoped to selected projects
const filteredTerminalSessions = useMemo(() => {
  return terminalSessions.filter(s =>
    !s.exited && !s.closing &&
    selectedProjectIds.has(s.projectId)
  );
}, [terminalSessions, selectedProjectIds]);

// Maestro sessions scoped to selected projects
const filteredMaestroSessions = useMemo(() => {
  return Array.from(maestroSessions.values()).filter(s =>
    selectedProjectIds.has(s.projectId)
  );
}, [maestroSessions, selectedProjectIds]);
```

---

## Drag-and-Drop Rules

1. **Within same project:** Status changes freely (same as current)
2. **Cross-project:** Disallowed — visual "no drop" cursor when dragging over a different project's columns
3. **Grouped mode:** Drag data includes `projectId`; drop handler checks project match
4. **Unified mode:** Cards carry project context; columns check on drop

```typescript
const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus, targetProjectId: string) => {
  const taskId = e.dataTransfer.getData('text/plain');
  const taskProjectId = e.dataTransfer.getData('application/x-project-id');

  // Block cross-project drops
  if (taskProjectId !== targetProjectId) {
    setDragOverColumn(null);
    return;
  }

  onUpdateTaskStatus(taskId, targetStatus);
};
```

---

## Project Colors

Auto-assigned from a palette, keyed by project index in the store:

```typescript
const PROJECT_COLORS = [
  '#00d9ff', // cyan
  '#ff6464', // red
  '#ffb000', // amber
  '#4ade80', // green
  '#a78bfa', // purple
  '#f472b6', // pink
  '#fb923c', // orange
  '#38bdf8', // sky
];

const getProjectColor = (projectId: string, allProjects: MaestroProject[]): string => {
  const index = allProjects.findIndex(p => p.id === projectId);
  return PROJECT_COLORS[Math.max(0, index) % PROJECT_COLORS.length];
};
```

---

## File Structure

```
maestro-ui/src/components/maestro/
  ├─ Board.tsx                      ← main board overlay (replaces TaskBoardOverlay)
  ├─ BoardHeader.tsx                ← header with tabs, stats, layout toggle, close
  ├─ BoardProjectSidebar.tsx        ← project selector sidebar
  ├─ BoardProjectRow.tsx            ← single project's kanban row (grouped mode)
  ├─ BoardUnifiedKanban.tsx         ← unified kanban view
  ├─ BoardSessionsView.tsx          ← sessions view grouped by project
  ├─ BoardTaskCard.tsx              ← enhanced task card (optional project badge)
  └─ TaskBoardOverlay.tsx           ← DEPRECATED (remove after migration)

maestro-ui/src/hooks/
  └─ useMultiProjectTasks.ts        ← fetches tasks for multiple projects
```

---

## Implementation Plan

### Phase 1: Board Shell + Project Board (replace TaskBoardOverlay)
1. Create `Board.tsx` — portal overlay with header, sidebar placeholder, content area
2. Create `BoardHeader.tsx` — tabs (Tasks/Sessions), stats, close button
3. Create `BoardProjectSidebar.tsx` — project list with checkboxes
4. Create `BoardProjectRow.tsx` — grouped kanban row per project (reuse column/card logic from TaskBoardOverlay)
5. Create `BoardTaskCard.tsx` — task card with optional project badge
6. Wire up `MaestroPanel` "$ board" → opens Board with current project
7. Remove `TaskBoardOverlay` import from MaestroPanel

### Phase 2: Multi-Project Entry Point
1. Add board button to `ProjectTabBar` in `projectTabBarActions`
2. Wire up App.tsx state management for board open/close
3. Pass `onOpenBoard` through `AppRightPanel` → `MaestroPanel`
4. Pass `onOpenBoard` to `ProjectTabBar`
5. Persist selected projects to localStorage

### Phase 3: Sessions View
1. Create `BoardSessionsView.tsx` — sessions grouped by project
2. Reuse `TerminalSessionColumn` component with project headers
3. Filter by selected projects
4. Terminal DOM reparenting per session

### Phase 4: Unified Layout + Polish
1. Create `BoardUnifiedKanban.tsx` — single kanban with project badges on cards
2. Add layout toggle in header (grouped ↔ unified)
3. Drag-and-drop with cross-project restrictions
4. Keyboard shortcut (Cmd+Shift+B) to open multi-project board
5. Performance: virtualize task lists for large boards

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Component** | `TaskBoardOverlay` (single-project) | `Board` (unified, multi-project) |
| **Entry: MaestroPanel** | `$ board` → single-project overlay | `$ board` → Board with 1 project selected |
| **Entry: ProjectTabBar** | N/A | `[⊞]` button → Board with all projects selected |
| **Project selection** | None (hardcoded to active project) | Sidebar with checkboxes per project |
| **Layout** | Single kanban | Grouped (per-project rows) or Unified (single kanban) |
| **Sessions** | All terminals shown | Terminals filtered & grouped by selected projects |
| **Drag-drop** | Status changes only | Status changes, cross-project blocked |
