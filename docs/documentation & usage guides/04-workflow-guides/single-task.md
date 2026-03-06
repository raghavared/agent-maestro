# Run a Single Task with Claude

**Scenario:** You have a task. You want Claude to do it. Here's how.

This is the simplest Maestro workflow — create a task, spawn a session, watch Claude work, done.

---

## Prerequisites

- Maestro installed and running (`maestro status` shows your project)
- A project created (`maestro project create "my-app"`)
- Claude Code available on your system

## Step 1: Create a Task

```bash
maestro task create "Add dark mode toggle to the settings page" \
  --desc "Add a toggle switch in the settings page that lets users switch between light and dark themes. Use the existing ThemeContext." \
  --priority high
```

Output:

```
Task created
ID: task_abc123
Title: Add dark mode toggle to the settings page
Priority: high
```

Save the task ID — you'll need it in the next step.

## Step 2: Spawn a Session

```bash
maestro session spawn --task task_abc123
```

Output:

```
Spawning maestro-worker session: Worker: Add dark mode toggle
   Task: Add dark mode toggle to the settings page
   Priority: high
   Agent Tool: claude-code
   Model: sonnet
   Session ID: sess_xyz789

   Waiting for Agent Maestro to open terminal window...
```

This creates a new terminal session where Claude receives your task with full context. Claude reads the task description, understands the codebase, and starts working.

**In the desktop app:** A new session card appears. Click it to see Claude's terminal in real time.

## Step 3: Watch Progress

From another terminal, watch what's happening:

```bash
maestro session watch sess_xyz789
```

Output:

```
[session:watch] Watching 1 session(s): sess_xyz789
[session:watch] Connected. Listening for events...
[14:32:01] sess_xyz789 status: working
[14:32:15] sess_xyz789 progress: Reading existing ThemeContext implementation
[14:33:42] sess_xyz789 progress: Adding toggle component to settings page
[14:35:10] sess_xyz789 progress: Testing dark mode toggle
[14:36:00] sess_xyz789 COMPLETED: Worker: Add dark mode toggle
[session:watch] All watched sessions have finished.
```

Or check session info at any point:

```bash
maestro session info sess_xyz789
```

**In the desktop app:** The session timeline shows every milestone in real time.

## Step 4: Verify Completion

Check the task status:

```bash
maestro task get task_abc123
```

The task status will show `completed` once Claude finishes. Review Claude's changes in your repo — all edits are made directly to your working directory.

---

## Using the Desktop App

The entire flow above works from the UI too:

1. Click **New Task** — fill in title, description, priority.
2. Click **Spawn Session** on the task card — choose worker mode, model, and go.
3. Watch the session timeline update live as Claude works.
4. Task card turns green when complete.

---

## Options

### Choose a model

```bash
maestro session spawn --task task_abc123 --model opus
```

### Choose an agent tool

```bash
maestro session spawn --task task_abc123 --agent-tool codex
```

Supported tools: `claude-code`, `codex`, `gemini`.

### Use a specific team member

```bash
maestro session spawn --task task_abc123 --team-member-id tm_frontend
```

### Give initial instructions

```bash
maestro session spawn --task task_abc123 \
  --subject "Focus area" \
  --message "Start with the ThemeContext changes before touching the UI component."
```

---

## What Next?

- **Task too big for one session?** See [Break Down a Big Task](./break-down-tasks.md).
- **Want to run multiple tasks at once?** See [Run Multiple Agents in Parallel](./parallel-agents.md).
- **Want Claude to plan and coordinate?** See [Use an Orchestrator](./orchestrator-coordination.md).
