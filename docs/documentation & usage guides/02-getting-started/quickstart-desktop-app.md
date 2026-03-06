# Quickstart: Desktop App

> **Time:** 5 minutes | **Goal:** Create a project, task, and watch Claude work — all from the Maestro UI

This guide walks through the visual experience. Every action has a CLI equivalent, but if you prefer point-and-click, this is for you.

---

## Prerequisites

- Maestro fully installed (`./install.sh` — includes desktop app, requires Rust)
- Server running (`maestro-server` in a terminal)
- `ANTHROPIC_API_KEY` set in your environment

---

## Step 1: Launch Maestro

Open the Maestro app from your Applications folder, Dock, or Spotlight.

<!-- Screenshot: Maestro app icon in macOS Applications folder -->
![Maestro in Applications](screenshots/01-launch-app.png)

The app connects to the Maestro server at `localhost:2357` automatically. You'll see the main dashboard.

<!-- Screenshot: Empty Maestro dashboard on first launch -->
![Empty Dashboard](screenshots/02-empty-dashboard.png)

> **Server not running?** Open a terminal and run `maestro-server` first. The app will show a connection error until the server is available.

---

## Step 2: Create a Project

Click the **"+ New Project"** button in the sidebar.

<!-- Screenshot: New Project dialog with name and directory fields -->
![Create Project Dialog](screenshots/03-create-project.png)

Fill in:
- **Name:** `my-app`
- **Working Directory:** Select your project folder (e.g., `/Users/you/projects/my-app`)
- **Description:** *(optional)* A short description of your project

Click **Create**. Your project appears in the sidebar.

<!-- Screenshot: Sidebar showing the new project -->
![Project in Sidebar](screenshots/04-project-sidebar.png)

---

## Step 3: Create a Task

Click on your project to open it. You'll see the **Task Panel** — currently empty.

Click **"+ New Task"** at the top of the task panel.

<!-- Screenshot: New Task form with title, description, and priority fields -->
![Create Task Form](screenshots/05-create-task.png)

Fill in:
- **Title:** `Add a login page with email and password`
- **Description:** `Create a React login form with email/password validation and submit handler`
- **Priority:** `High`

Click **Create**. The task appears in the panel with status **Todo**.

<!-- Screenshot: Task panel showing the new task with "Todo" status badge -->
![Task in Panel](screenshots/06-task-created.png)

---

## Step 4: Start Claude on the Task

Click the **"Start"** button on the task card (or right-click → **Spawn Session**).

<!-- Screenshot: Task card with "Start" button highlighted -->
![Start Button on Task](screenshots/07-start-task.png)

A configuration dialog may appear letting you choose:
- **Model:** `sonnet` (default), `opus`, or `haiku`
- **Team Member:** *(optional)* Select a pre-configured AI identity
- **Permission Mode:** `accept-edits` (default) or others

Click **Spawn**. Maestro creates a new session and opens a **terminal window** inside the app.

<!-- Screenshot: Terminal window opening with Maestro init banner -->
![Terminal Window Opens](screenshots/08-terminal-spawning.png)

---

## Step 5: Watch Claude Work

The terminal shows the Maestro init banner, then Claude Code starts:

<!-- Screenshot: Terminal showing the full Maestro init banner with task details -->
![Maestro Init Banner](screenshots/09-init-banner.png)

```
╭────────────────────────────────────────────────────────────────╮
│   ⚡ MAESTRO  —  Worker Session                                 │
├────────────────────────────────────────────────────────────────┤
│   Session  sess_1709640240000_i9j0k1l2                          │
│   Model claude-sonnet-4-5  │  Perms accept-edits  │  Tool Claude Code │
╰────────────────────────────────────────────────────────────────╯

╭────────────────────────────────────────────────────────────────╮
│   📋 Task                                                       │
├────────────────────────────────────────────────────────────────┤
│     PRI        ST  Title                                        │
│   ─────────────────────────────────────────────────────────    │
│    HIGH       ○  Add a login page with email and password       │
╰────────────────────────────────────────────────────────────────╯

  ▶  Spawning Claude Code…
```

Claude begins working — reading your codebase, planning the implementation, writing files, running tests. You can watch everything happen in real-time in the terminal.

<!-- Screenshot: Terminal showing Claude actively reading files and writing code -->
![Claude Working](screenshots/10-claude-working.png)

---

## Step 6: Track Progress in the Timeline

While Claude works, switch to the **Timeline** tab on the task or session view.

<!-- Screenshot: Timeline panel showing events like "Reading src/App.tsx", "Created LoginPage.tsx" -->
![Task Timeline](screenshots/11-timeline.png)

The timeline shows a chronological list of everything Claude has done:
- Files read and written
- Commands executed
- Progress reports
- Completion status

The task card updates in real-time:
- **Status badge** changes from `Todo` → `In Progress` → `Completed`
- **Session indicator** shows the active session working on it

---

## Step 7: Review the Result

When Claude finishes, the task status updates to **Completed**.

<!-- Screenshot: Task card showing "Completed" status with green checkmark -->
![Task Completed](screenshots/12-task-completed.png)

Click on the task to see:
- **Timeline:** Full history of actions taken
- **Session logs:** The complete Claude conversation
- **Files changed:** What was created or modified

<!-- Screenshot: Completed task detail view showing timeline, session info, and file changes -->
![Task Detail View](screenshots/13-task-detail.png)

Check your project directory — the new files are there:

```bash
git diff --stat
```

```
 src/components/LoginPage.tsx    | 85 +++++++++++++
 src/components/LoginPage.css    | 42 +++++++
 src/App.tsx                     |  7 +-
 3 files changed, 132 insertions(+), 2 deletions(-)
```

---

## UI Overview

Here's what each area of the Maestro desktop app does:

<!-- Screenshot: Annotated full-app screenshot with numbered callouts -->
![App Overview](screenshots/14-app-overview.png)

| Area | What it shows |
|------|-------------|
| **Sidebar** | Projects list, navigation |
| **Task Panel** | All tasks for the current project with status, priority, hierarchy |
| **Session Panel** | Active and completed sessions with terminal access |
| **Timeline** | Chronological events for tasks and sessions |
| **Terminal** | Live Claude Code terminal for each session |

---

## What's Next?

- **Create subtasks** — Break large tasks into smaller pieces; right-click a task → "Add Subtask"
- **Run multiple sessions** — Spawn sessions on different tasks to run Claude in parallel
- **Create team members** — Give Claude persistent identities with specific roles and models
- **Use coordinators** — Let Maestro automatically decompose and parallelize complex work
- **[CLI-only guide](quickstart-cli-only.md)** — Learn the terminal commands behind every UI action
