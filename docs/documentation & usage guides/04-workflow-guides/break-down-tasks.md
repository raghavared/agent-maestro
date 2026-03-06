# Break Down a Big Task into Subtasks

**Scenario:** Your task is too big for one shot. Break it down into manageable pieces.

---

## Prerequisites

- A project set up in Maestro
- A parent task that needs decomposition

## When to Break Down Tasks

One session works best with a focused, well-scoped task. If your task involves multiple unrelated files, different areas of the codebase, or would take multiple hours for a human — break it down.

---

## Approach 1: Manual Breakdown

You know the work best. Create the parent task, then add subtasks.

### Step 1: Create the Parent Task

```bash
maestro task create "Implement user authentication" \
  --desc "Add full auth flow: signup, login, logout, session management." \
  --priority high
```

```
Task created
ID: task_auth_001
Title: Implement user authentication
Priority: high
```

### Step 2: Create Subtasks

```bash
maestro task create "Set up auth database schema" \
  --desc "Create users table with email, password hash, and session tokens." \
  --priority high \
  --parent task_auth_001

maestro task create "Build signup API endpoint" \
  --desc "POST /api/auth/signup — validate input, hash password, create user, return token." \
  --priority high \
  --parent task_auth_001

maestro task create "Build login API endpoint" \
  --desc "POST /api/auth/login — verify credentials, create session, return token." \
  --priority high \
  --parent task_auth_001

maestro task create "Build logout API endpoint" \
  --desc "POST /api/auth/logout — invalidate session token." \
  --priority medium \
  --parent task_auth_001

maestro task create "Add auth middleware" \
  --desc "Express middleware that verifies session token on protected routes." \
  --priority high \
  --parent task_auth_001
```

### Step 3: View the Task Tree

```bash
maestro task tree
```

```
📋 Project Tasks
├── ⬜ Implement user authentication (task_auth_001)
│   ├── ⬜ Set up auth database schema (task_auth_002)
│   ├── ⬜ Build signup API endpoint (task_auth_003)
│   ├── ⬜ Build login API endpoint (task_auth_004)
│   ├── ⬜ Build logout API endpoint (task_auth_005)
│   └── ⬜ Add auth middleware (task_auth_006)
```

Status icons: ⬜ todo, 🔄 in_progress, ✅ completed, 🚫 blocked, ⊘ cancelled

### Step 4: Spawn Sessions for Each Subtask

Run them one at a time, or in parallel:

```bash
# One at a time
maestro session spawn --task task_auth_002

# Or spawn multiple (see parallel-agents.md for details)
maestro session spawn --task task_auth_002
maestro session spawn --task task_auth_003
maestro session spawn --task task_auth_006
```

### Step 5: Track Progress

```bash
maestro task tree
```

```
📋 Project Tasks
├── 🔄 Implement user authentication (task_auth_001)
│   ├── ✅ Set up auth database schema (task_auth_002)
│   ├── 🔄 Build signup API endpoint (task_auth_003)
│   ├── ⬜ Build login API endpoint (task_auth_004)
│   ├── ⬜ Build logout API endpoint (task_auth_005)
│   └── 🔄 Add auth middleware (task_auth_006)
```

---

## Approach 2: Let an Orchestrator Do It

Don't want to plan the breakdown yourself? Spawn a coordinator and let Claude decompose the work.

### Step 1: Create the High-Level Task

```bash
maestro task create "Implement user authentication" \
  --desc "Add full auth flow: signup, login, logout, session management. Use JWT tokens with Express middleware." \
  --priority high
```

### Step 2: Spawn a Coordinator

```bash
maestro session spawn --task task_auth_001 \
  --skill maestro-orchestrator
```

The coordinator will:
1. Analyze the task
2. Break it into subtasks automatically
3. Spawn worker sessions for each subtask
4. Monitor workers and report progress
5. Verify everything works together

See [Use an Orchestrator to Coordinate Work](./orchestrator-coordination.md) for the full guide.

---

## Tips

- **Keep subtasks focused.** Each subtask should be completable by one session without touching unrelated code.
- **Write clear descriptions.** The description is all Claude sees. Include file paths, API contracts, and constraints.
- **Use priorities.** High-priority tasks can be tackled first when running in parallel.
- **View children only:**

```bash
maestro task children task_auth_001
```

Shows just the direct children of a task.

```bash
maestro task children task_auth_001 --recursive
```

Shows the full subtree.

---

## What Next?

- **Run all subtasks at once?** See [Run Multiple Agents in Parallel](./parallel-agents.md).
- **Let Claude manage the breakdown?** See [Use an Orchestrator](./orchestrator-coordination.md).
- **Process subtasks in order?** See [Queue Mode](./queue-mode.md).
