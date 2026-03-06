# Screenshot & GIF Capture Guide

## Overview

This guide describes all visual assets that need to be captured as actual screenshots or screen recordings. Since these cannot be generated programmatically, this document provides detailed descriptions of what to capture, how to set it up, and where each asset will be used.

---

## 1. Hero GIF (15 seconds)

**Purpose**: The single most important visual asset. Sells the product in one animation.

**What to capture**:
1. Start with desktop app open showing a project with several tasks in the task panel
2. Click on a task to select it
3. Click "Start" to spawn a session
4. Show the terminal pane opening with the AI agent starting
5. Agent begins working (typing commands, reading files)
6. Progress appears in the session timeline panel
7. Task status updates from "todo" to "in_progress"

**Setup**:
- Window size: 1280x800 or 1440x900
- Use a real project with meaningful task names (not "test-task-1")
- Suggested project: A simple web app with tasks like "Add authentication", "Create API endpoints", "Write tests"
- Clean desktop background (solid color)

**Recording tool**: QuickTime Player (macOS) → Convert with gifski (`gifski --fps 10 --width 1200 frames/*.png -o hero.gif`)

**Where used**: Landing page hero section, README.md, social media

**File**: `hero-demo.gif`

---

## 2. Annotated Desktop App Screenshot

**Purpose**: Full workspace overview with numbered labels explaining each panel area.

**What to capture**:
- Full desktop app window with all panels visible
- At least 3-4 tasks visible in the task panel (mix of statuses)
- At least 2 active sessions visible
- One session's terminal output showing real Claude activity
- Timeline panel showing progress events

**Annotations to add** (numbered callouts):
1. **Project Selector** - Top left, shows current project name
2. **Task Panel** - Left sidebar, list of tasks with status indicators
3. **Session Panel** - Shows active sessions with status badges
4. **Terminal View** - Main area showing live AI agent output
5. **Timeline** - Right panel showing progress events and reports
6. **Status Bar** - Bottom area with connection status and quick actions

**Tool**: Take screenshot → Annotate in Figma, Skitch, or Preview.app with numbered circles and leader lines

**Where used**: "App Overview" page, quickstart guides

**File**: `desktop-app-annotated.png`

---

## 3. CLI Output Screenshots

**Purpose**: Show real terminal output for key commands to help users know what to expect.

### 3a. Task Tree Output
```
$ maestro task tree
```
**Expected output**: Hierarchical tree with tasks showing IDs, titles, statuses (color-coded), and assigned team members.

**File**: `cli-task-tree.png`

### 3b. Session List Output
```
$ maestro session list
```
**Expected output**: Table of sessions with IDs, names, statuses, task assignments, and timestamps.

**File**: `cli-session-list.png`

### 3c. Session Watch Output
```
$ maestro session watch <session-id>
```
**Expected output**: Live-updating view of session progress with timeline events appearing in real time.

**File**: `cli-session-watch.png` (or `cli-session-watch.gif` for animated version)

### 3d. Whoami Output
```
$ maestro whoami
```
**Expected output**: Shows current context including project, session ID, mode, team member info.

**File**: `cli-whoami.png`

### 3e. Status Output
```
$ maestro status
```
**Expected output**: Project overview with task counts by status, active sessions, team member listing.

**File**: `cli-status.png`

**Terminal setup**:
- Use a clean terminal theme (suggest: dark background, standard colors)
- Font size: 14-16px for readability
- Window width: ~100 columns
- Tool: Regular screenshot of Terminal.app or iTerm2

**Where used**: CLI Reference pages, quickstart guides, command documentation

---

## 4. Quickstart Step Screenshots

### Desktop App Quickstart

**Step 1**: Project creation dialog
- **Capture**: The "Create Project" modal with name and working directory fields filled in
- **File**: `quickstart-desktop-1-create-project.png`

**Step 2**: Task creation
- **Capture**: The task creation form with a sample task title and description
- **File**: `quickstart-desktop-2-create-task.png`

**Step 3**: Team member setup
- **Capture**: Team member creation/selection showing name, role, model picker
- **File**: `quickstart-desktop-3-team-member.png`

**Step 4**: Spawning a session
- **Capture**: The spawn dialog or the moment after clicking "Start" with task selected
- **File**: `quickstart-desktop-4-spawn.png`

**Step 5**: Watching progress
- **Capture**: Full app showing session running, timeline updating, task status changing
- **File**: `quickstart-desktop-5-running.png`

**Step 6**: Completion
- **Capture**: App showing completed task (green checkmark), session completed, timeline summary
- **File**: `quickstart-desktop-6-complete.png`

### CLI Quickstart

**Step 1**: Project creation
```
$ maestro project create "my-web-app"
```
- **File**: `quickstart-cli-1-create-project.png`

**Step 2**: Task creation
```
$ maestro task create "Add user authentication" --desc "Implement JWT-based auth..."
```
- **File**: `quickstart-cli-2-create-task.png`

**Step 3**: Session spawn
```
$ maestro session spawn --task <task-id> --mode worker
```
- **File**: `quickstart-cli-3-spawn.png`

**Step 4**: Session running
- **Capture**: Terminal showing Claude working with progress reports appearing
- **File**: `quickstart-cli-4-running.png`

**Step 5**: Completion
```
$ maestro status
```
- **Capture**: Status showing completed task
- **File**: `quickstart-cli-5-complete.png`

**Where used**: Quickstart pages (both desktop and CLI versions)

---

## 5. Before/After Comparison

**Purpose**: Visually demonstrate the value proposition of Maestro.

### Before Maestro
**What to capture**: A chaotic screenshot showing:
- 4 separate terminal windows open side by side
- Each running a different Claude Code session
- No visible coordination between them
- Scattered, confusing
- Caption: "Before: 4 independent terminals, no coordination, no progress tracking"

**File**: `before-maestro.png`

### After Maestro
**What to capture**: The Maestro desktop app showing:
- Same 4 tasks organized in the task panel
- 4 sessions running simultaneously but coordinated
- Progress visible in timeline
- Clear status for each task
- Caption: "After: One dashboard, full visibility, coordinated execution"

**File**: `after-maestro.png`

**Layout**: Side-by-side or stacked with clear "Before" / "After" labels

**Where used**: "Why Maestro?" hook page, landing page, README

---

## 6. Additional Screenshots (Nice-to-Have)

### Team Management View
- **Capture**: Team creation/management UI showing team hierarchy
- **File**: `team-management.png`

### Multi-Session Dashboard
- **Capture**: Desktop app with 4+ sessions running simultaneously, showing the orchestrator pattern in action
- **File**: `multi-session-dashboard.png`

### Skill Configuration
- **Capture**: Skill listing or configuration UI
- **File**: `skill-config.png`

### Error/Blocked State
- **Capture**: A session in error or blocked state, showing how Maestro surfaces problems
- **File**: `session-error-state.png`

---

## File Organization

```
docs/documentation & usage guides/10-visual-assets/
├── architecture-diagram.md          ← Mermaid (ready)
├── task-lifecycle.md                ← Mermaid (ready)
├── session-lifecycle.md             ← Mermaid (ready)
├── orchestrator-flow.md             ← Mermaid (ready)
├── team-structure.md                ← Mermaid (ready)
├── spawn-flow.md                    ← Mermaid (ready)
├── screenshot-guide.md              ← This file
└── assets/                          ← To be created
    ├── hero-demo.gif
    ├── desktop-app-annotated.png
    ├── before-maestro.png
    ├── after-maestro.png
    ├── cli-task-tree.png
    ├── cli-session-list.png
    ├── cli-session-watch.png
    ├── cli-whoami.png
    ├── cli-status.png
    ├── quickstart-desktop-*.png
    ├── quickstart-cli-*.png
    ├── team-management.png
    ├── multi-session-dashboard.png
    ├── skill-config.png
    └── session-error-state.png
```

## Capture Checklist

- [ ] Hero GIF (15 seconds)
- [ ] Annotated desktop app screenshot
- [ ] CLI: task tree
- [ ] CLI: session list
- [ ] CLI: session watch
- [ ] CLI: whoami
- [ ] CLI: status
- [ ] Quickstart desktop: steps 1-6
- [ ] Quickstart CLI: steps 1-5
- [ ] Before/After comparison
- [ ] Team management view
- [ ] Multi-session dashboard
- [ ] Skill configuration
- [ ] Error/blocked state
