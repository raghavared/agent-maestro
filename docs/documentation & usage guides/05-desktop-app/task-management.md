# Task Management

**Create tasks, organize them into columns, and track what every agent is doing.**

---

## The Task Panel

Open the Maestro panel by clicking the **Tasks** icon in the icon rail (or pressing `Cmd+T` to create a task directly). The task panel has two main views: a **sortable list** and a **kanban board**.

[screenshot placeholder: Task panel showing the command bar, filter bar, and task list]

---

## Command Bar

At the top of the task panel, the command bar gives you a quick action button and status overview.

```
┌──────────────────────────────────────────────────────┐
│  $ new task                    ◉ 3  ○ 5  ◎ 1  ✓ 12  │
└──────────────────────────────────────────────────────┘
```

| Element | Meaning |
|---------|---------|
| `$ new task` | Click to open the task creation modal |
| `◉` (green) | Number of tasks currently **in progress** |
| `○` (dim) | Number of **todo** tasks |
| `◎` (yellow) | Number of tasks **in review** |
| `✓` (bright) | Number of **completed** tasks |

---

## Creating Tasks

Click `$ new task` or press `Cmd+T` to open the task creation modal.

[screenshot placeholder: Task creation modal with title, description, priority, and parent task fields]

Fill in:

| Field | Description |
|-------|-------------|
| **Title** | A short name for the task |
| **Description** | Detailed instructions, acceptance criteria, context. Supports markdown. |
| **Priority** | `Low`, `Medium`, or `High` — shown as a colored stripe on the task card |
| **Parent task** | Optional — nest this as a subtask under another task |
| **Due date** | Optional — tasks past their due date are flagged as overdue |

Click **Create** to save. The task appears immediately in the list.

### Adding Subtasks

From the task list view, click a task to expand it. Use the **Add Subtask** input at the bottom of the subtask section to quickly create child tasks without opening a modal.

---

## Task Cards

Each task is displayed as a card showing key information at a glance.

[screenshot placeholder: A single task card showing priority stripe, title, metadata, and action button]

```
┌─────────────────────────────────────┐
│▌ Build the authentication module    │
│  HIGH  2/5 subtasks  Due Mar 15     │
│  ● 2 sessions            3m ago     │
│  $ work on                          │
└─────────────────────────────────────┘
```

| Element | Description |
|---------|-------------|
| **Priority stripe** | Colored left border — red for high, yellow for medium, blue for low |
| **Title** | The task name. Struck through if cancelled. |
| **Priority badge** | `HIGH`, `MEDIUM`, or `LOW` label |
| **Subtask progress** | `completed/total` when subtasks exist |
| **Due date** | Shows "Overdue" in red if past due, otherwise the date |
| **Session count** | Number of sessions working on this task, with an activity dot |
| **Time ago** | When the task was last updated |
| **`$ work on` button** | Appears on `todo` and `blocked` tasks — click to spawn a session for this task |

Task cards are **draggable** — you can drag them into terminal sessions to add context, or between kanban columns to change status.

---

## Task Detail View

Click a task card to open the full task detail modal. It has multiple tabs:

[screenshot placeholder: Task detail modal showing the Details tab with description, status controls, and metadata]

### Details Tab
- Edit title, description, priority, and due date
- Change task status via the status control dropdown
- View and edit the initial prompt (what gets sent to the agent)
- Add reference docs and images

### Subtasks Tab
- View all child tasks with their status
- Add new subtasks inline
- Click a subtask to open its detail view

### Sessions Tab
- See all sessions that have worked on this task
- View session status (spawning, working, idle, completed, failed)
- Click to jump to a session's terminal

### Timeline Tab
- Chronological log of all events: status changes, progress reports, completion messages
- Filterable by event type

### Generated Docs Tab
- Documents produced by agent sessions while working on this task

### Reference Docs Tab
- Attach files and documents as reference material for agents

### Launch Config Panel
- Configure how sessions should be spawned for this task
- Select team member, agent tool, model, strategy, and execution mode
- Assign skills and set command permissions

---

## Filtering Tasks

Click the **⚙ Filters** button to expand the filter bar.

[screenshot placeholder: Expanded filter bar showing status chips, priority chips, and sort options]

### Status Filters

Toggle chips to show/hide tasks by status:

| Status | Symbol | Color |
|--------|--------|-------|
| Todo | ○ | Dim |
| In Progress | ◉ | Green |
| In Review | ◎ | Yellow |
| Completed | ✓ | Bright |
| Blocked | ⊘ | Red |
| Cancelled | ✕ | Dim/strikethrough |

### Priority Filters

Toggle chips to filter by priority level: **High**, **Medium**, **Low**.

### Due Date Filters

Toggle the **Overdue** chip to show only tasks that are past their due date.

### Sort Options

Choose how tasks are ordered:

| Sort | Description |
|------|-------------|
| **Custom** | Manual drag-and-drop ordering |
| **Updated** | Most recently updated first (default) |
| **Created** | Most recently created first |
| **Priority** | High → Medium → Low |
| **Due Date** | Earliest due date first |

Active filters show as removable chips in the collapsed filter bar. Click **Clear all** to reset.

---

## Kanban Board

Switch to the kanban view using the board icon in the panel navigation. Tasks are organized into columns by status.

[screenshot placeholder: Kanban board showing columns for Todo, In Progress, In Review, and Completed with task cards]

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  ○ TODO  │ ◉ IN     │ ◎ IN     │ ✓ DONE   │ ⊘ BLOCKED│
│          │ PROGRESS │ REVIEW   │          │          │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │          │
│ │Task 1│ │ │Task 3│ │ │Task 5│ │ │Task 7│ │          │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │          │
│ ┌──────┐ │ ┌──────┐ │          │ ┌──────┐ │          │
│ │Task 2│ │ │Task 4│ │          │ │Task 8│ │          │
│ └──────┘ │ └──────┘ │          │ └──────┘ │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Drag cards between columns** to change their status. Drop a card from "Todo" into "In Progress" and the task status updates automatically.

Each column header shows the status symbol, label, and task count. Columns can be **collapsed** by clicking the header to save screen space.

### Multi-Project Board

Click the **layers icon** in the project tab bar (or press `Cmd+Shift+B`) to open the multi-project board. This shows tasks from all open projects in a single kanban view, with colored project badges on each card so you can distinguish which task belongs to which project.

---

## Drag-and-Drop Ordering

In the list view with **Custom** sort selected, tasks are drag-reorderable. Grab a task card and move it up or down to set your preferred order. The ordering is saved automatically and persists across sessions.

---

## Task Status Control

On the task detail view, the status dropdown lets you manually transition tasks between states:

```
todo → in_progress → in_review → completed
                  ↘ blocked
                  ↘ cancelled
```

Agents also update task status automatically as they work — reporting progress, completion, or blockers through the Maestro CLI.

> **Next:** [Session Management](./session-management.md) — Spawn and monitor agent sessions.
