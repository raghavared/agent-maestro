# Workers vs Orchestrators

**Maestro has two fundamental roles: workers execute tasks, orchestrators plan and coordinate. Understanding which to use — and when — is key to getting the most out of Maestro.**

---

## The Two Roles

Think of it like a construction site:

- A **worker** is the person with the hammer. They get a task ("build this wall"), they do it, they report back.
- An **orchestrator** is the project manager. They look at the big picture ("build this house"), break it down into parts, assign workers to each part, and make sure everything comes together.

## The Four Modes

Maestro has four agent modes — two base roles, each with a standalone and coordinated variant:

| Mode | Role | Spawned By | Use Case |
|------|------|------------|----------|
| `worker` | Executor | You (human) | Simple, self-contained tasks |
| `coordinator` | Planner | You (human) | Complex tasks that need decomposition |
| `coordinated-worker` | Executor | A coordinator | Subtasks created by a coordinator |
| `coordinated-coordinator` | Planner | A coordinator | Sub-projects within a larger coordination |

### Worker

A worker gets tasks and executes them directly. It writes code, runs tests, fixes bugs — whatever the task says. It reports progress and marks tasks complete when done.

```bash
# Spawn a worker for a simple task
maestro session spawn --task <task-id> --mode worker
```

What a worker does:
- Reads the task description
- Works in the project directory
- Reports progress via `maestro task report progress`
- Reports completion via `maestro task report complete`
- Asks for input if stuck via `maestro session needs-input`

Workers are **focused**. They don't create subtasks or spawn other sessions. They just execute.

### Coordinator

A coordinator analyzes complex tasks, breaks them into subtasks, spawns workers to handle each piece, and monitors everything until the job is done.

```bash
# Spawn a coordinator for a complex task
maestro session spawn --task <task-id> --mode coordinator
```

What a coordinator does:
1. **Analyzes** the assigned task to understand scope
2. **Decomposes** it into subtasks with clear dependencies
3. **Spawns workers** for each subtask (or batch of subtasks)
4. **Monitors** worker progress via session watching
5. **Unblocks** workers that get stuck (sends prompts, clarifies requirements)
6. **Verifies** the final result meets acceptance criteria
7. **Reports** completion when everything is done

Coordinators don't write code themselves — they delegate.

### Coordinated Worker

A coordinated worker is just a worker that was spawned by a coordinator (not by a human). The difference:

- It has a `parentSessionId` pointing to its coordinator
- It has a `rootSessionId` pointing to the top-level session
- It can communicate with sibling sessions via `maestro session siblings` and `maestro session prompt`
- It reports back to its coordinator automatically

```bash
# Spawned by a coordinator, not by you directly
# The coordinator runs something like:
maestro session spawn --task <subtask-id> --mode coordinated-worker
```

### Coordinated Coordinator

A coordinated coordinator is an orchestrator spawned by another orchestrator. It creates a hierarchy:

```
You (human)
 └─ Coordinator (top-level)
     ├─ Coordinated Worker (writes frontend)
     ├─ Coordinated Worker (writes API)
     └─ Coordinated Coordinator (manages backend)
         ├─ Coordinated Worker (writes database layer)
         └─ Coordinated Worker (writes business logic)
```

This is for genuinely large projects where one coordinator can't manage everything. A top-level coordinator delegates an entire subsystem to a sub-coordinator, which then spawns its own workers.

## When to Use Which

### Use a Worker When:

- The task is self-contained: "Fix this bug," "Add this endpoint," "Write tests for this module"
- You know exactly what needs to happen
- One Claude session can handle it from start to finish
- The task doesn't need to be broken down further

### Use a Coordinator When:

- The task is too big for one session: "Build the authentication system," "Refactor the entire API layer"
- The task has multiple independent parts that can be parallelized
- You want Claude to figure out the decomposition
- You need multiple agents working simultaneously

### Use Coordinated modes when:

- A coordinator is spawning sub-sessions (this happens automatically — you don't set coordinated modes manually from the CLI)

## Real Example: The Difference

**Task:** "Add user authentication to the app"

### Worker approach

You spawn a single worker. It reads the task, builds everything sequentially: login page, registration, JWT handling, middleware, tests. One session, one process, done.

```bash
maestro task create "Add user authentication" --priority high
maestro session spawn --task <task-id> --mode worker
```

Good for: small apps, prototypes, when you want simplicity.

### Coordinator approach

You spawn a coordinator. It analyzes the task, creates subtasks, and spawns workers in parallel:

```bash
maestro task create "Add user authentication" --priority high
maestro session spawn --task <task-id> --mode coordinator
```

The coordinator then autonomously:
1. Creates subtask: "Build login/registration UI" → spawns worker
2. Creates subtask: "Implement JWT auth middleware" → spawns worker
3. Creates subtask: "Add user database schema and models" → spawns worker
4. Creates subtask: "Write auth integration tests" → spawns worker (depends on 1-3)
5. Monitors all four workers
6. Unblocks any that get stuck
7. Verifies the integrated result

Good for: complex features, multi-file changes, when speed matters (parallel execution).

## Communication Between Sessions

Coordinated sessions can talk to each other:

```bash
# See your sibling sessions (other workers from the same coordinator)
maestro session siblings

# Send a message to another session
maestro session prompt <sibling-session-id> --message "I updated the User model — please use the new schema"
```

This is how agents collaborate — the database worker tells the API worker about schema changes, the frontend worker asks the API worker for endpoint specs, etc.

## Choosing a Model for Each Role

Different roles benefit from different models:

| Role | Recommended Model | Why |
|------|------------------|-----|
| Coordinator | `opus` | Needs strong planning and decomposition ability |
| Worker (complex) | `opus` or `sonnet` | Needs good code generation |
| Worker (simple) | `sonnet` or `haiku` | Fast execution, lower cost |

```bash
# Coordinator with Opus
maestro session spawn --task <task-id> --mode coordinator --model opus

# Workers with Sonnet (set at team member level)
maestro team-member create "frontend-dev" --role "Frontend Developer" --model sonnet
```

> **Next:** [Teams & Team Members](./teams-and-members.md) — Give your agents names, roles, and personalities.
