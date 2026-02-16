# Maestro Panel UI/UX Redesign v2

## Overview

This document builds on the original Maestro Panel Redesign, incorporating key architectural changes around team members, auto-assignment, and a unified launch experience. The core principle: **team members are a first-class layer built on top of sessions**, and the two default team members — **Worker** and **Coordinator** — are always present.

---

## 1. Team Members Architecture

### 1.1 Team Members as a Layered API

Team members sit **on top of** the session layer. Sessions remain unchanged — they are the raw execution primitive. Team members add identity, configuration, and assignment semantics.

```
┌──────────────────────────────────┐
│       Team Members Layer         │  ← Identity, roles, assignment
│  (Worker, Coordinator, custom)   │
├──────────────────────────────────┤
│         Session Layer            │  ← Raw execution (spawn, monitor)
│  (spawning, idle, working, ...)  │
└──────────────────────────────────┘
```

**Key principle:** Every session is spawned *through* a team member. The team member determines the agent mode (`execute` vs `coordinate`), model, agent tool, identity prompt, and skills.

### 1.2 Default Team Members

Two team members are **always present** and cannot be deleted:

| Member | Role | Mode | Description |
|--------|------|------|-------------|
| **Worker** | Default executor | `execute` | Runs tasks directly. Uses `simple` strategy by default. This is what the Play button invokes. |
| **Coordinator** | Task orchestrator | `coordinate` | Decomposes tasks, assigns to other team members, monitors progress. Uses `default` strategy. |

These are the built-in team members. Users can create additional custom team members (e.g., "Frontend Dev", "Tester", "DB Architect") with their own identity, avatar, model, and agent tool.

### 1.3 Team Member Data (Server API)

The server exposes a Team Members API built on top of sessions:

```
GET    /api/projects/:projectId/team-members          → List all members
POST   /api/projects/:projectId/team-members          → Create member
GET    /api/projects/:projectId/team-members/:id       → Get member
PATCH  /api/projects/:projectId/team-members/:id       → Update member
DELETE /api/projects/:projectId/team-members/:id       → Delete member (not defaults)
```

Each team member stores:
- `id`, `name`, `role`, `identity` (prompt), `avatar` (emoji)
- `mode`: `execute` | `coordinate`
- `model`, `agentTool`, `skillIds`
- `isDefault`: `true` for Worker and Coordinator
- `sessionIds[]`: sessions spawned through this member

When spawning a session, the request includes `teamMemberId` instead of raw config. The server resolves the team member's config and passes it through to the session spawn flow.

---

## 2. Task List Item Redesign

### 2.1 Recommended Design: Split Play + Three-Dot Menu

This is the approved design from the original document (Design 2), with team member integration added.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [todo ▾] Task Title Here  [high ▾]  🟢🟡  2m ago   [+₃] [▶|▾] [...]  │
└────────────────────────────────────────────────────────────────────────────┘

Legend:
  [todo ▾]  — Clickable status badge with dropdown
  [high ▾]  — Clickable priority badge with dropdown
  🟢🟡     — Active session indicators (green=working, yellow=idle)
  2m ago    — Last updated timestamp
  [+₃]     — Subtask button with count badge
  [▶|▾]    — Split play button (click ▶ to run with Worker, ▾ for options)
  [...]    — Three-dot menu for management actions
```

### 2.2 Split Play Button Dropdown

Clicking the ▾ reveals execution options organized by team member:

```
┌──────────────────────────────────────┐
│  Run with...                         │
│                                      │
│  🔧 Worker (execute)         ← default│
│     ├─ Simple (1 agent)              │
│     └─ Queue                         │
│                                      │
│  🎯 Coordinator (orchestrate)        │
│     ├─ Default                       │
│     ├─ Batching                      │
│     └─ DAG                           │
│                                      │
│  ─────────────────────────────────── │
│  🎨 Frontend Dev (execute)           │
│  🧪 Tester (execute)                 │
│  📐 DB Architect (execute)           │
│                                      │
│  ─────────────────────────────────── │
│  + New Team Member...                │
└──────────────────────────────────────┘
```

**Behavior:**
- Click ▶ → Runs with default Worker (simple strategy). One click.
- Click ▾ → Shows all team members grouped by type, with strategy sub-options for Worker and Coordinator.
- Custom team members show their avatar and name, execute with their configured mode.

### 2.3 Three-Dot Menu (Management Actions Only)

```
┌──────────────────────────────────┐
│  → Mark In Progress              │
│  → Mark Completed                │
│  → Mark Blocked                  │
│  ──────────────────────────────  │
│  Pin / Unpin                     │
│  Edit Task                       │
│  Duplicate                       │
│  Delete                          │
│  ──────────────────────────────  │
│  → Move to Project...            │
│  ↗ Add to Running Session...     │
└──────────────────────────────────┘
```

### 2.4 Session Chips with Team Member Avatars

When a task has active sessions, each session chip shows the **team member avatar** that spawned it:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [in_progress ▾] Build login page  [high ▾]                                │
│ [🔧 working] [🎨 idle] [🧪 working]              2m ago  [+₃] [▶|▾] [...]│
└────────────────────────────────────────────────────────────────────────────┘
```

- `[🔧 working]` = Worker session, currently working
- `[🎨 idle]` = Frontend Dev session, idle
- `[🧪 working]` = Tester session, working

Clicking a session chip opens that session's terminal. The avatar makes it immediately clear which team member is handling what, without needing to expand or hover.

The same chip component is reused in the Sessions panel sidebar — each session row shows the team member avatar if one is associated.

### 2.5 Expanded Task State

```
┌────────────────────────────────────────────────────────────────────────────┐
│    [todo ▾] Task Title Here  [high ▾]  🔧🎨  2m ago   [+₃] [▶|▾] [...] │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ [Context] [Sessions] [Timeline] [Details]                           │  │
│ │                                                                      │  │
│ │ Description text here...                                             │  │
│ │                                                                      │  │
│ │ Referenced: task_abc, task_def                                       │  │
│ │ Docs: design-spec.md                                                 │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ ├─ [in_progress] Subtask 1  [med]  🔧         [+] [▶|▾] [...]          │
│ ├─ [todo]        Subtask 2  [low]              [+] [▶|▾] [...]          │
│ └─ [+ Add subtask...]                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Unified Launch Experience (Replacing Execute/Orchestrate Buttons)

### 3.1 Problem with Current Approach

The current ExecutionBar has two separate buttons — "$ execute" and "$ orchestrate" — that switch the panel into a batch selection mode. This creates:
- A modal state that takes over the entire task list
- A disconnect between single-task and multi-task workflows
- Confusion about when to use execute vs. orchestrate

### 3.2 Proposed Design: Selection-First with Smart Launch Bar

Instead of dedicated mode buttons, use a **selection-first** approach:

**Step 1: Select tasks via long-press or checkbox toggle**

A small "Select" toggle in the task filter bar enables multi-select mode:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Filter ▾] [Sort ▾] [Search...]                          [☐ Select]     │
└────────────────────────────────────────────────────────────────────────────┘
```

When toggled, checkboxes appear on all tasks. Alternatively, long-pressing any task enters selection mode and selects that task.

**Step 2: Smart Launch Bar appears at bottom when tasks are selected**

Once 1+ tasks are selected, a sticky bottom bar slides up:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ☑ 3 tasks selected    [Select All] [Clear]                               │
│                                                                            │
│  Run with: [🔧 Worker ▾]  Strategy: [simple ▾]                           │
│                                                                            │
│                                    [Cancel]  [▶ Run 3 Tasks]              │
└────────────────────────────────────────────────────────────────────────────┘
```

**The "Run with" dropdown lists all team members:**

```
┌──────────────────────────────────┐
│  🔧 Worker              ← default│
│  🎯 Coordinator                  │
│  ──────────────────────────────  │
│  🎨 Frontend Dev                 │
│  🧪 Tester                       │
│  📐 DB Architect                 │
│  ──────────────────────────────  │
│  + New Team Member...            │
└──────────────────────────────────┘
```

**Strategy dropdown changes based on selected team member:**
- Worker selected → `simple`, `queue`
- Coordinator selected → `default`, `batching`, `dag`
- Custom member → strategies based on their mode

**Benefits over current design:**
- No separate "execute" / "orchestrate" modes — the team member selection determines the mode
- One unified flow for single and multi-task operations
- The Play button on individual tasks is still 1-click for the most common case
- The distinction between execute and orchestrate is now expressed through team members, which is more intuitive

### 3.3 Single Task: Just Click Play

For the most common case — running a single task — nothing changes. Click ▶ and it runs with the Worker. The split button ▾ gives access to other team members and strategies.

No batch selection needed. No mode switching.

### 3.4 Coordinator Flow with Auto-Assignment

When the Coordinator is selected (either via split button on a single task or via the Launch Bar for multiple tasks), a special assignment panel appears:

**Single task orchestration (inline below the task):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [todo] Build Authentication System  [high]            [+₃] [▶|▾] [...]  │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ Orchestrate with Coordinator                                         │  │
│ │                                                                      │  │
│ │ Strategy: [default ▾]                                                │  │
│ │                                                                      │  │
│ │ Assignment:  (●) Auto-assign (Coordinator decides)                   │  │
│ │              ( ) Manual assignment                                    │  │
│ │                                                                      │  │
│ │ Team: [🔧 Worker] [🎨 Frontend] [🧪 Tester] [+ Add]                │  │
│ │                                                                      │  │
│ │                          [Cancel]  [▶ Start Orchestration]           │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Multi-task orchestration (via Launch Bar):**

When Coordinator is selected in the Launch Bar and "Manual assignment" is chosen, each selected task shows an inline team member dropdown:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ☑ Build login page  [high]         → Assigned to: [🎨 Frontend Dev ▾]   │
│ ☑ Write API tests   [med]          → Assigned to: [🧪 Tester ▾]         │
│ ☑ Design schema     [high]         → Assigned to: [Auto ▾]              │
└────────────────────────────────────────────────────────────────────────────┘
```

Each task's dropdown includes:
```
┌──────────────────────────────────┐
│  ✨ Auto (Coordinator decides)   │
│  ──────────────────────────────  │
│  🔧 Worker                       │
│  🎨 Frontend Dev                 │
│  🧪 Tester                       │
│  📐 DB Architect                 │
└──────────────────────────────────┘
```

**Auto-assign** is the default. The Coordinator will analyze the task and pick the best team member. Manual overrides are per-task — you can auto-assign most tasks but pin specific ones to specific members.

**Launch Bar in orchestration mode:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ☑ 3 tasks selected    [Select All] [Clear]                               │
│                                                                            │
│  Run with: [🎯 Coordinator ▾]  Strategy: [default ▾]                     │
│  Assignment: [Auto-assign ▾]                                               │
│                                                                            │
│  Team: [🔧 Worker x] [🎨 Frontend x] [🧪 Tester x] [+ Add]             │
│                                                                            │
│                               [Cancel]  [▶ Orchestrate 3 Tasks]           │
└────────────────────────────────────────────────────────────────────────────┘
```

The "Team" row shows removable pills for the team members available to the Coordinator. The Coordinator will only assign to members shown in this list.

---

## 4. Team Tab Redesign

### 4.1 Current State

The Team tab shows a flat list of team members with checkboxes for selection during orchestration. Members are stored as tasks with `taskType: 'team-member'`.

### 4.2 Proposed Design

The Team tab becomes the **management hub** for team members:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Team Members                                              [+ New Member]  │
│                                                                            │
│ DEFAULT                                                                    │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ 🔧 Worker          Default executor         3 active sessions       │  │
│ │    Role: Runs tasks directly                 [Configure]             │  │
│ ├──────────────────────────────────────────────────────────────────────┤  │
│ │ 🎯 Coordinator      Task orchestrator        1 active session       │  │
│ │    Role: Decomposes and delegates tasks       [Configure]            │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ CUSTOM                                                                     │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ 🎨 Frontend Dev     Frontend specialist      0 active sessions      │  │
│ │    Model: sonnet  Agent: claude-code          [Configure] [...]     │  │
│ ├──────────────────────────────────────────────────────────────────────┤  │
│ │ 🧪 Tester           QA & testing             1 active session       │  │
│ │    Model: haiku   Agent: claude-code          [Configure] [...]     │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

- Default members (Worker, Coordinator) are always at the top, cannot be deleted
- Custom members show model/agent info, have a [...] menu for edit/delete
- "Active sessions" count links to the Sessions panel filtered by that member
- [Configure] opens the member's settings (identity prompt, model, agent tool, skills)

---

## 5. Sessions Panel Integration

### 5.1 Team Member Avatars on Session Chips

In the Sessions sidebar, each session shows the team member avatar:

```
┌──────────────────────────────────────────────────────────┐
│ Sessions                                                  │
│                                                           │
│ [🔧] sess_abc  WORKING  Build login page      [x]       │
│ [🎨] sess_def  IDLE     Style components      [x]       │
│ [🎯] sess_ghi  WORKING  Orchestrate auth      [x]       │
│ [  ] Terminal 1                                [x]       │
└──────────────────────────────────────────────────────────┘
```

The avatar prefix makes it immediately clear which team member spawned each session. Sessions without a team member (plain terminals) show no avatar.

### 5.2 Session Expansion

When expanding a maestro session in the sidebar, the team member info is shown:

```
┌──────────────────────────────────────────────────────────┐
│ ▾ [🎯] sess_ghi  WORKING  Orchestrate auth              │
│   Team Member: 🎯 Coordinator                            │
│   Strategy: default                                       │
│   Tasks: Build login (🔧 working), Write tests (🧪 idle)│
└──────────────────────────────────────────────────────────┘
```

---

## 6. Complete Task List Item Wireframe

### Collapsed State
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ☐  [todo ▾] Task Title  [high ▾]  [🔧w][🎨i]  2m ago  [+₃] [▶|▾] [...] │
└────────────────────────────────────────────────────────────────────────────┘

Legend:
  ☐         — Selection checkbox (visible in select mode)
  [todo ▾]  — Clickable status badge
  [high ▾]  — Clickable priority badge
  [🔧w]    — Worker session chip (w=working)
  [🎨i]    — Frontend Dev session chip (i=idle)
  2m ago    — Last updated
  [+₃]     — Subtask count + expand
  [▶|▾]    — Split play (▶ = Worker execute, ▾ = team member picker)
  [...]    — Three-dot management menu
```

### Expanded State
```
┌────────────────────────────────────────────────────────────────────────────┐
│    [in_progress ▾] Task Title  [high ▾]  [🔧w][🎨i]  2m  [+₃] [▶|▾] [...]│
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ [Context] [Sessions] [Timeline] [Details]                           │  │
│ │                                                                      │  │
│ │ Description text here...                                             │  │
│ │ Referenced: task_abc, task_def                                       │  │
│ │ Docs: design-spec.md                                                 │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ ├─ [in_progress] Subtask 1  [med]  [🔧w]        [+] [▶|▾] [...]        │
│ ├─ [todo]        Subtask 2  [low]                [+] [▶|▾] [...]        │
│ └─ [+ Add subtask...]                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Execution Flow Summary

| Action | Clicks | How |
|--------|--------|-----|
| Execute single task (Worker, simple) | 1 | Click ▶ on task |
| Execute single task (specific member) | 2 | Click ▾ → member |
| Orchestrate single task | 2-3 | Click ▾ → Coordinator → strategy |
| Select multiple tasks | 1+N | Click "Select" toggle + check tasks |
| Run multiple tasks (Worker) | 2 | Select → ▶ Run N Tasks |
| Orchestrate multiple tasks (auto-assign) | 3 | Select → Coordinator → ▶ Orchestrate |
| Orchestrate multiple tasks (manual assign) | 3+N | Select → Coordinator → Manual → assign each → ▶ Orchestrate |
| Pin a task | 2 | Click [...] → Pin |
| Delete a task | 2 | Click [...] → Delete |
| Change status | 2 | Click status badge → new status |
| Change priority | 2 | Click priority badge → new priority |

---

## 8. Implementation Priority

### Phase 1: Team Member Foundation
- Add Team Members API to server (layered on sessions)
- Create default Worker and Coordinator members on project init
- Migrate existing team member task storage to new API

### Phase 2: Task List Item Redesign
- Replace Pin + Play with Split Play + Three-Dot Menu
- Add team member picker to split-play dropdown
- Show team member avatars on session chips

### Phase 3: Unified Launch Bar
- Replace "$ execute" / "$ orchestrate" buttons with Select toggle
- Implement Smart Launch Bar with team member selector
- Strategy auto-switching based on team member mode

### Phase 4: Coordinator Auto-Assignment
- Add auto-assign / manual-assign toggle in orchestration flow
- Per-task team member assignment dropdowns
- Team member pills (removable) in Launch Bar

### Phase 5: Team Tab Overhaul
- Separate default vs. custom member sections
- Active session counts per member
- Configure panel for member settings

### Phase 6: Session Panel Integration
- Team member avatars on all session items
- Expanded session view with member info and task assignments

---

## 9. CSS Considerations

### Split Play Button
```
- Left side (▶): Primary action, green glow on hover
- Right side (▾): Subtle left border separator, same background
- Combined width ≈ current play button
- Dropdown: standard terminal menu (dark bg, blur, border)
```

### Smart Launch Bar
```
- Position: sticky bottom of task list, above any scrollbar
- Background: rgba(0, 0, 0, 0.95) with backdrop-filter: blur(8px)
- Slide-up animation on appear (translateY(100%) → 0)
- Team member pills: rounded, avatar + name, × to remove
- Strategy chips: radio-button style, highlight when selected
```

### Team Member Session Chips
```
- Compact: avatar + single letter status (w/i/s)
- Breathing animation when working (existing pattern)
- Tooltip on hover: "🔧 Worker — session_abc (working)"
- Click to jump to session terminal
```

### Three-Dot Menu
```
- Background: rgba(0, 0, 0, 0.95) with backdrop-filter: blur(8px)
- Border: 1px solid rgba(255, 255, 255, 0.1)
- Items: rgba(255, 255, 255, 0.7) text
- Hover: rgba(primary-rgb, 0.15) background
- Separators: 1px solid rgba(255, 255, 255, 0.06)
- Portal-based positioning (like existing dropdowns)
- Animate: scale(0.95) → scale(1), opacity 0 → 1
```

---

## 10. Open Questions

1. Should the Coordinator's auto-assignment be visible in real-time (i.e., show which member it chose as it assigns), or only after all assignments are made?
2. Should team members have a "max concurrent sessions" limit to prevent overloading?
3. When a custom team member's session finishes, should it auto-return to a "pool" for the Coordinator to reuse?
4. Should the Worker default strategy be configurable per-project (e.g., some projects prefer queue)?
5. Should team member configurations be exportable/shareable across projects?
