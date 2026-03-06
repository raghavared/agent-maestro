# App Overview

**Your command center for multi-agent orchestration.**

---

When you launch the Maestro desktop app, you're looking at a single workspace where every project, task, session, and agent is visible at a glance. Here's what each part does.

[screenshot placeholder: Full annotated screenshot of the main workspace with all panels labeled]

## Workspace Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROJECT TAB BAR                                          [⚙] [🔊] │
├────┬────────────────────────────────────────────┬───────┬───────────┤
│    │                                            │       │           │
│ S  │                                            │  I    │  RIGHT    │
│ I  │          MAIN CONTENT AREA                 │  C    │  PANEL    │
│ D  │                                            │  O    │           │
│ E  │     (Terminal / Editor / Board)            │  N    │ (Maestro  │
│ B  │                                            │       │  Panel or │
│ A  │                                            │  R    │  File     │
│ R  │                                            │  A    │  Explorer)│
│    │                                            │  I    │           │
│    │                                            │  L    │           │
├────┴────────────────────────────────────────────┴───────┴───────────┤
│  STATUS BAR                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Tab Bar (Top)

The horizontal bar across the top of the window. Every open project gets a tab.

[screenshot placeholder: Project Tab Bar with multiple project tabs, working agent indicators, and action buttons]

| Element | What It Does |
|---------|-------------|
| **Project tabs** | Click to switch between projects. Each tab shows the project name, active session count, and a green dot with working agent count when agents are active. |
| **Master project badge** | A ★ star icon appears on tabs marked as master projects (sessions in master projects can access all other projects). |
| **Needs input indicator** | Tabs pulse when a session inside that project needs user input. |
| **+ button** | Opens a dropdown with **New Project** and **Open Saved Project** options. |
| **Multi-Project Board** | Opens the kanban board view showing tasks from all open projects side by side. |
| **Whiteboard** | Opens a freeform canvas for brainstorming and planning. |
| **Settings gear** | Opens the global app settings dialog (theme, display, sounds, shortcuts). |
| **Sound toggle** | Mute/unmute notification sounds globally. |

Project tabs are **drag-reorderable** — grab a tab and drag it left or right to rearrange your workspace.

Right-click the settings icon on any active project tab to open **Project Settings**, where you can view project info, toggle master project mode, configure per-project sounds, close, or delete the project.

---

## Left Sidebar

The sidebar on the left side of the window. It's divided into three sections with a resizable divider between them.

[screenshot placeholder: Left sidebar showing projects list, quick prompts, and sessions list]

### Projects Section

A list of all open projects. Each row shows:
- Project name
- Active session count badge
- Working agent count (green dot when agents are running)

Click a project to switch to it. Drag to reorder. Use the header buttons to create new projects or open settings.

### Quick Prompts Section

Pre-configured prompts you can fire at the active session with one click. Useful for repetitive instructions like "run tests" or "fix linting errors."

- Click a prompt to send it to the active terminal session
- Edit prompts inline or open the full prompts management panel
- Pin your most-used prompts for quick access via `Cmd+1` through `Cmd+5`

### Sessions Section

A list of all terminal sessions in the current project. Each session shows:
- Session name and status indicator
- Whether it's a regular terminal, a Maestro agent session, or an SSH connection

**Session controls at the top:**
- **+ New Session** — Open a fresh terminal
- **Persistent Sessions** — View and reattach tmux-backed terminals
- **SSH Manager** — Connect to remote machines
- **Agent Shortcuts** — Quick-launch pre-configured agent workflows
- **Manage Terminals** — Reorder terminal tabs

Sessions are **drag-reorderable** in the sidebar list.

---

## Icon Rail (Right of Sidebar)

A narrow vertical strip of icon buttons between the sidebar and the right panel. It controls what section is visible in the Maestro right panel.

[screenshot placeholder: Icon rail showing Tasks, Members, Teams, Skills, Lists, and Files icons]

| Icon | Section | Description |
|------|---------|-------------|
| Tasks | Task management | Create, edit, filter, and organize tasks |
| Members | Team members | Create and configure AI agent profiles |
| Teams | Teams | Group members into teams, launch team sessions |
| Skills | Skills | Browse installed skills, assign to sessions |
| Lists | Task lists | Create custom task collections |
| Files | File explorer | Browse local or remote files |

Badge counts appear on Tasks, Members, and Teams icons showing how many items exist.

A **Whiteboard** button at the bottom of the rail opens the freeform canvas.

---

## Main Content Area (Center)

The large central area where you interact with terminals and editors.

[screenshot placeholder: Main content area showing an active terminal session with Claude working]

This area displays one of:
- **Terminal session** — An xterm.js terminal where agents run. This is the primary view.
- **Code editor** — A Monaco-based editor when you open a file from the file explorer.
- **Multi-Project Board** — A full-screen kanban view of tasks across all projects.
- **Team View** — A split-screen overlay showing all terminals for a running team simultaneously.

The terminal supports full ANSI color, scrollback, and copy/paste. When a Maestro session is running, you see the agent's live output here.

---

## Right Panel

A collapsible panel on the right side. Toggle it via the Icon Rail. It shows either:

### Maestro Panel
The full task and team management interface. Contains:
- **Task tab** — Task list with filters, sorting, kanban board, and task creation
- **Members tab** — Team member profiles with configuration
- **Teams tab** — Team management and launch controls
- **Skills tab** — Installed skills browser
- **Lists tab** — Custom task list management

### File Explorer Panel
A file tree browser for the current project's working directory. Supports:
- Local filesystem browsing
- SSH/remote file browsing (when connected to a remote machine)
- Click a file to open it in the Monaco editor

---

## Resize Handles

All panel boundaries are resizable:
- **Sidebar width** — Drag the edge between sidebar and main content
- **Projects/Sessions divider** — Drag the horizontal separator in the sidebar (double-click to auto-fit)
- **Right panel width** — Drag the left edge of the right panel

---

## Quick Orientation

When you first launch Maestro:

1. **Create a project** — Click the + button in the tab bar, name it, and point it at your codebase
2. **Open the Maestro panel** — Click the Tasks icon in the icon rail
3. **Create tasks** — Use `$ new task` in the command bar or `Cmd+T`
4. **Spawn sessions** — Click the ▶ play button on a task card to launch an agent
5. **Watch your agents work** — Terminal sessions appear in the sidebar; click to view

> **Next:** [Task Management](./task-management.md) — Create, organize, and track tasks.
