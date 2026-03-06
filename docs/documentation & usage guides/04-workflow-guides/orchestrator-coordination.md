# Use an Orchestrator to Coordinate Work

**Scenario:** You have a complex project. Let Claude plan the work, break it down, spawn workers, and coordinate everything.

This is Maestro's power feature. One coordinator Claude analyzes your task, creates a plan, assigns subtasks to worker Claudes, monitors their progress, and verifies everything works together.

---

## Prerequisites

- A project set up in Maestro
- A task that benefits from automated coordination (multiple moving parts, dependencies between subtasks)

## Step 1: Create the High-Level Task

Write a clear, comprehensive task. The coordinator uses this to plan everything.

```bash
maestro task create "Build a REST API for blog posts" \
  --desc "Create a full CRUD API for blog posts with:
- Database schema (posts table with title, body, author, timestamps)
- GET /api/posts (list all, with pagination)
- GET /api/posts/:id (single post)
- POST /api/posts (create, requires auth)
- PUT /api/posts/:id (update, requires auth)
- DELETE /api/posts/:id (delete, requires auth)
- Input validation on all endpoints
- Integration tests for every endpoint
Use Express, Prisma, and Zod for validation." \
  --priority high
```

```
Task created
ID: task_blog_001
Title: Build a REST API for blog posts
Priority: high
```

## Step 2: Spawn the Orchestrator

```bash
maestro session spawn --task task_blog_001 \
  --skill maestro-orchestrator
```

```
Spawning maestro-orchestrator session: Coordinator: Build REST API
   Task: Build a REST API for blog posts
   Priority: high
   Agent Tool: claude-code
   Session ID: sess_coord_001

   Waiting for Agent Maestro to open terminal window...
```

## Step 3: The Orchestrator Takes Over

Here's what happens behind the scenes:

### What the Orchestrator Sees

The coordinator receives a system prompt that tells it to:
1. Analyze the task
2. Decompose into subtasks
3. Spawn worker sessions
4. Monitor workers
5. Verify and complete

### The Orchestrator's Actions

**Phase 1 — Analysis and Planning:**

The orchestrator reads your task, analyzes the codebase, and creates subtasks:

```
Coordinator creates:
├── task_blog_002: "Set up Prisma schema for blog posts"
├── task_blog_003: "Build GET /api/posts endpoints"
├── task_blog_004: "Build POST/PUT/DELETE /api/posts endpoints"
├── task_blog_005: "Add Zod validation to all endpoints"
└── task_blog_006: "Write integration tests for blog API"
```

**Phase 2 — Spawning Workers:**

The orchestrator spawns worker sessions for independent tasks:

```
Coordinator spawns:
→ Worker A: task_blog_002 (database schema) — starts first
→ Worker B: task_blog_003 (GET endpoints) — after schema done
→ Worker C: task_blog_004 (POST/PUT/DELETE) — after schema done
→ Worker D: task_blog_005 (validation) — after endpoints done
→ Worker E: task_blog_006 (tests) — after everything done
```

**Phase 3 — Monitoring:**

The orchestrator watches workers and manages the flow:

```bash
# The orchestrator runs commands like:
maestro session logs --my-workers        # Check worker output
maestro session watch sess_w1,sess_w2    # Watch active workers
maestro session prompt sess_w2 --message "Schema is ready, you can start building endpoints"
```

**Phase 4 — Verification:**

Once all workers complete, the orchestrator:
- Reviews the combined output
- Runs tests if applicable
- Reports the parent task as complete

### What the Workers See

Each worker receives:
- Its specific subtask description
- The coordinator's session ID (for reporting back)
- Context about the overall project
- Instructions to report progress via `maestro task report` commands

Workers execute autonomously, reporting milestones:

```bash
maestro task report progress task_blog_003 "GET /api/posts endpoint done, starting GET /api/posts/:id"
maestro task report complete task_blog_003 "Both GET endpoints implemented with pagination"
```

## Step 4: Watch From Your Side

You can monitor the entire operation:

```bash
# Watch the coordinator
maestro session watch sess_coord_001

# See all sessions
maestro session list

# View the task tree
maestro task tree
```

```
📋 Project Tasks
├── 🔄 Build a REST API for blog posts (task_blog_001) [Coordinator]
│   ├── ✅ Set up Prisma schema (task_blog_002) [Worker A]
│   ├── ✅ Build GET endpoints (task_blog_003) [Worker B]
│   ├── 🔄 Build POST/PUT/DELETE endpoints (task_blog_004) [Worker C]
│   ├── ⬜ Add Zod validation (task_blog_005) [Waiting]
│   └── ⬜ Write integration tests (task_blog_006) [Waiting]
```

**In the desktop app:** You see the coordinator session alongside all worker sessions. The timeline shows coordination events — subtask creation, worker spawning, progress updates, completions.

## Step 5: Done

When all workers finish and the orchestrator verifies the result:

```
[14:45:00] sess_coord_001 COMPLETED: Coordinator: Build REST API
```

The parent task moves to `completed`. All code is in your working directory.

---

## Orchestrator Workflow Templates

Maestro includes built-in coordination strategies:

| Template | Strategy |
|----------|----------|
| `coordinate-default` | Decompose → spawn workers → monitor → verify |
| `coordinate-batching` | Group independent tasks into parallel batches |
| `coordinate-dag` | DAG-based execution in topological order |

The default template works for most cases. The orchestrator adapts its strategy based on task dependencies.

---

## Giving the Orchestrator More Context

### Initial directive

```bash
maestro session spawn --task task_blog_001 \
  --skill maestro-orchestrator \
  --subject "Architecture constraints" \
  --message "Use the existing Express app in src/app.ts. Don't create a new server. Follow the pattern in src/routes/users.ts for new routes."
```

### Team members for workers

Pre-create specialized team members and the orchestrator can assign them:

```bash
maestro team-member create "DB Specialist" --role "Database and schema expert" --avatar "🗄️" --mode coordinated-worker
maestro team-member create "API Dev" --role "REST API developer" --avatar "🔌" --mode coordinated-worker
maestro team-member create "QA" --role "Test writer" --avatar "🧪" --mode coordinated-worker
```

The orchestrator sees available team members and can assign them to subtasks.

---

## Tips

- **Write detailed parent tasks.** The better your task description, the better the orchestrator's plan.
- **Trust the process.** The orchestrator handles sequencing and dependencies. You don't need to micromanage.
- **Intervene when needed.** You can send messages to any session:

```bash
maestro session prompt sess_coord_001 --message "Skip the tests for now, focus on getting the endpoints working first."
```

- **Check logs for debugging:**

```bash
maestro session logs sess_coord_001 --tail 50
```

---

## What Next?

- **Want pre-configured team members?** See [Set Up a Team](./team-setup.md).
- **Want sequential task processing?** See [Queue Mode](./queue-mode.md).
- **Want to track everything in real time?** See [Track Progress](./real-time-tracking.md).
