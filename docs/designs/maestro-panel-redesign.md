# Maestro Panel UI/UX Redesign

## Current State Analysis

### Task List Item - Current Actions (Right Side)
```
┌────────────────────────────────────────────────────────────────────┐
│ [Status] Task Title  [Priority]  [Sessions...]  2m ago            │
│                                        [Subtasks] [Pin] [▶ Play] │
└────────────────────────────────────────────────────────────────────┘
```

**Current buttons:**
1. **Subtask Button** — Toggle expand/collapse subtasks, or add new subtask if none exist
2. **Pin Button** — Toggle pin/unpin task (amber highlight when pinned)
3. **Play Button** — Execute task immediately (creates a new session with `simple` strategy)

**Current execution modes (via ExecutionBar, separate from task items):**
- `$ execute` — Enter multi-select mode, pick tasks, choose strategy (simple/queue), batch execute
- `$ orchestrate` — Enter multi-select mode, pick tasks + team members, choose strategy (default/batching/dag), orchestrate

### Problems with Current Design
1. **Three buttons feel crowded** on each task row, especially on smaller panels
2. **Pin is rarely used** but takes up prime visual real estate
3. **No way to launch orchestration/coordination from a single task** — must go through ExecutionBar batch flow
4. **No way to delete a task** from the list item itself
5. **Play button always does the same thing** (simple execute) — no strategy choice at task level
6. **Disconnect between single-task and multi-task workflows** — different UI patterns for similar operations

---

## Proposed Redesign

### Design 1: Streamlined Task Actions with Three-Dot Menu

```
┌────────────────────────────────────────────────────────────────────┐
│ [Status] Task Title  [Priority]  [Sessions...]  2m ago            │
│                                      [Subtasks] [▶ Play] [⋯]    │
└────────────────────────────────────────────────────────────────────┘
```

**Visible buttons (always shown):**
1. **Subtask Button** — Same as current (expand/collapse/add)
2. **Play Button** — Quick execute (default: simple strategy, single agent)
3. **Three-Dot Menu (⋯)** — Opens a dropdown with all secondary actions

**Three-Dot Menu Contents:**

```
┌──────────────────────────────────┐
│  ▶  Execute                      │
│     ├─ Simple (1 agent)          │
│     └─ Queue                     │
│                                  │
│  ⚡ Orchestrate                  │
│     ├─ Default                   │
│     ├─ Batching                  │
│     └─ DAG                       │
│                                  │
│  ──────────────────────────────  │
│  📌 Pin / Unpin                  │
│  ✏️  Edit Task                   │
│  📋 Duplicate                    │
│  🗑️  Delete                      │
│  ──────────────────────────────  │
│  → Move to Project...            │
│  ↗ Add to Running Session...     │
└──────────────────────────────────┘
```

**Benefits:**
- Clean two-button + menu layout — less visual clutter
- Play button is the primary CTA (most common action), always one click
- All launch modes accessible from any individual task (not just batch)
- Pin, delete, edit tucked away but still accessible
- Orchestrate with strategy selection directly from a single task

---

### Design 2: Context-Aware Play Button with Smart Menu

Building on Design 1, the Play button itself could be context-aware:

```
┌────────────────────────────────────────────────────────────────────┐
│ [Status] Task Title  [Priority]  [Sessions...]  2m ago            │
│                                      [Subtasks] [▶ ▾] [⋯]       │
└────────────────────────────────────────────────────────────────────┘
```

**Split Play Button:**
- **Click the ▶ area** → Instant execute (simple strategy)
- **Click the ▾ dropdown** → Shows execution options:

```
┌──────────────────────────────────┐
│  ▶ Execute (simple)       ← default │
│  ▶ Execute (queue)                │
│  ─────────────────────────────── │
│  ⚡ Orchestrate (default)        │
│  ⚡ Orchestrate (batching)       │
│  ⚡ Orchestrate (DAG)            │
│  ─────────────────────────────── │
│  ⚙ Choose Agent...              │
└──────────────────────────────────┘
```

**Three-Dot Menu (⋯) — Only non-execution actions:**

```
┌──────────────────────────────────┐
│  📌 Pin / Unpin                  │
│  ✏️  Edit Task                   │
│  📋 Duplicate                    │
│  🗑️  Delete                      │
│  ──────────────────────────────  │
│  → Move to Project...            │
│  ↗ Add to Running Session...     │
└──────────────────────────────────┘
```

**Benefits over Design 1:**
- Separates execution concerns from management concerns
- Power users can access any strategy in two clicks (▾ → strategy)
- Three-dot menu stays lean and focused on task management

---

### Design 3: Hover-Reveal Actions (Minimal Default)

For an even cleaner look, only show the Play button by default, and reveal the rest on hover:

```
Default state:
┌────────────────────────────────────────────────────────────────────┐
│ [Status] Task Title  [Priority]  [Sessions...]  2m ago     [▶]   │
└────────────────────────────────────────────────────────────────────┘

Hover state:
┌────────────────────────────────────────────────────────────────────┐
│ [Status] Task Title  [Priority]  [Sessions...]  2m ago            │
│                                      [Subtasks] [▶ Play] [⋯]    │
└────────────────────────────────────────────────────────────────────┘
```

The subtask count badge would still show on the task row even in default state if subtasks exist — just the button would be hidden until hover.

---

## Recommended Approach: Design 2 (Split Play + Three-Dot)

**Rationale:**
- Most common action (execute) is always 1 click
- All execution strategies accessible via split button dropdown
- Three-dot menu stays clean with only management actions
- No loss of functionality — everything from current design is preserved
- Natural grouping: execution actions vs. task management actions
- The split-button pattern is well-understood (VS Code, GitHub, etc.)

---

## Additional UI/UX Improvements

### A. Batch Selection Mode Enhancements

**Current:** Clicking `$ execute` or `$ orchestrate` in the ExecutionBar enters selection mode, showing checkboxes on all tasks.

**Proposed improvements:**

1. **Sticky selection footer** — When in selection mode, show a fixed bottom bar:
```
┌────────────────────────────────────────────────────────────────────┐
│  ☑ 3 tasks selected    [Select All] [Clear]                       │
│  Strategy: [simple ▾]           [Cancel]  [$ Execute 3 Tasks]     │
└────────────────────────────────────────────────────────────────────┘
```

2. **Quick-select gestures** — Shift+click to select range, Cmd+click for multi-select

3. **Visual feedback** — Selected tasks get a left border highlight (green for execute, purple for orchestrate)

### B. Team Member Integration in Orchestration

**Current:** Team members shown as a separate list above tasks when in orchestrate mode.

**Proposed improvements:**

1. **Inline team member assignment** — When orchestrating, each selected task could show a team member dropdown:
```
┌────────────────────────────────────────────────────────────────────┐
│ ☑ Build login page  [Priority: high]  → Assigned to: [Frontend ▾]│
│ ☑ Write API tests   [Priority: med]   → Assigned to: [Tester ▾]  │
│ ☑ Design schema     [Priority: high]  → Assigned to: [Auto ▾]    │
└────────────────────────────────────────────────────────────────────┘
```

2. **Team member pills** — Show selected team members as removable pills in the orchestration bar:
```
┌────────────────────────────────────────────────────────────────────┐
│  Team: [🎨 Frontend ×] [🧪 Tester ×] [+ Add Member]              │
│  Strategy: [default ▾]        [Cancel]  [$ Orchestrate]           │
└────────────────────────────────────────────────────────────────────┘
```

### C. Single-Task Orchestration Flow

Currently there's no way to orchestrate a single task (decompose it into subtasks with team members). The three-dot menu or split-play button enables this:

**Flow:**
1. User clicks ⚡ Orchestrate on a single task
2. A compact inline panel appears below the task:
```
┌────────────────────────────────────────────────────────────────────┐
│ [Status] Build Authentication System  [high]                       │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ Orchestrate this task                                          │ │
│ │ Strategy: [default] [batching] [dag]                           │ │
│ │ Team:     [🎨 Frontend ×] [🧪 Tester ×] [+ Add]              │ │
│ │                              [Cancel] [$ Start Orchestration]  │ │
│ └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

3. This creates an orchestrator session for just that task, which will auto-decompose and delegate.

### D. Running Session Indicators on Task Items

When a task has active sessions, show them more prominently:

```
┌────────────────────────────────────────────────────────────────────┐
│ [In Progress] Build login page  [high]                             │
│ 🟢 sess_abc (working) • 🟡 sess_def (idle)          [▶ ▾] [⋯]  │
└────────────────────────────────────────────────────────────────────┘
```

Clicking a session chip jumps to that session's terminal.

### E. Task Status Quick-Actions

In the three-dot menu, add status transitions as quick actions:

```
┌──────────────────────────────────┐
│  → Mark In Progress              │
│  → Mark Completed                │
│  → Mark Blocked                  │
│  ──────────────────────────────  │
│  📌 Pin / Unpin                  │
│  ✏️  Edit Task                   │
│  ...                             │
└──────────────────────────────────┘
```

---

## Complete Task List Item Wireframe (Recommended Design)

### Collapsed State
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ☐  [todo ▾] Task Title Here  [high ▾]  🟢🟡  2m ago   [⊞₃] [▶|▾] [⋯] │
└────────────────────────────────────────────────────────────────────────────┘

Legend:
  ☐         — Selection checkbox (only visible in batch mode)
  [todo ▾]  — Clickable status badge with dropdown
  [high ▾]  — Clickable priority badge with dropdown
  🟢🟡     — Active session indicators (green=working, yellow=idle)
  2m ago    — Last updated timestamp
  [⊞₃]     — Subtask button with count badge
  [▶|▾]    — Split play button (click ▶ to execute, ▾ for options)
  [⋯]      — Three-dot menu for management actions
```

### Expanded State (Click on task row)
```
┌────────────────────────────────────────────────────────────────────────────┐
│    [todo ▾] Task Title Here  [high ▾]  🟢🟡  2m ago   [⊞₃] [▶|▾] [⋯] │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ [Context] [Sessions] [Timeline] [Details]                           │  │
│ │                                                                      │  │
│ │ Description text here...                                             │  │
│ │                                                                      │  │
│ │ Referenced: task_abc, task_def                                       │  │
│ │ Docs: design-spec.md                                                 │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ ├─ [in_progress] Subtask 1  [med]  🟢         [⊞] [▶|▾] [⋯]          │
│ ├─ [todo]        Subtask 2  [low]              [⊞] [▶|▾] [⋯]          │
│ └─ [+ Add subtask...]                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Execution Flow Summary

| Action | Clicks | How |
|--------|--------|-----|
| Execute single task (simple) | 1 | Click ▶ on task |
| Execute single task (queue) | 2 | Click ▾ → Queue |
| Orchestrate single task | 2 | Click ▾ → Orchestrate strategy |
| Execute multiple tasks | 3-4 | ExecutionBar → select tasks → strategy → execute |
| Orchestrate multiple tasks | 4-5 | ExecutionBar → select tasks → select team → strategy → orchestrate |
| Pin a task | 2 | Click ⋯ → Pin |
| Delete a task | 2 | Click ⋯ → Delete |
| Change status | 2 | Click status badge → new status |
| Change priority | 2 | Click priority badge → new priority |

---

## Implementation Priority

1. **Phase 1:** Replace Pin + Play with Split Play + Three-Dot Menu (Design 2)
2. **Phase 2:** Add orchestration options to split-play dropdown
3. **Phase 3:** Enhance batch selection mode with sticky footer
4. **Phase 4:** Team member pills in orchestration bar
5. **Phase 5:** Single-task inline orchestration panel
6. **Phase 6:** Hover-reveal polish (Design 3 elements)

---

## CSS Considerations

The three-dot menu should use the existing terminal theme:
- Background: `rgba(0, 0, 0, 0.95)` with `backdrop-filter: blur(8px)`
- Border: `1px solid rgba(255, 255, 255, 0.1)`
- Items: `rgba(255, 255, 255, 0.7)` text, highlight on hover with `rgba(primary-rgb, 0.15)`
- Separators: `border-top: 1px solid rgba(255, 255, 255, 0.06)`
- Use portal-based positioning (like existing status/priority dropdowns)
- Animate in with `transform: scale(0.95) → scale(1)` and `opacity: 0 → 1`

The split-play button:
- Left side (▶): Same green glow as current play button
- Right side (▾): Subtle separator line, same background
- Combined width similar to current play button
- Right side reveals dropdown on click

---

## Open Questions for Discussion

1. Should the three-dot menu include "Add to running session" for tasks that have active sessions?
2. Should we show different play button states (e.g., pause icon) when a task already has a working session?
3. Should the split-button dropdown remember the last-used strategy per task?
4. How should we handle orchestration from the task-level when no team members are defined yet?
5. Should right-click on a task also open the three-dot menu (context menu)?
