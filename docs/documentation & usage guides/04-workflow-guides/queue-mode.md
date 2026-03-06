# Process Tasks with Queue Mode

**Scenario:** You have an ordered list of tasks. Process them one by one, in sequence, using a task list.

---

## Prerequisites

- A project set up in Maestro
- Tasks that need to run in a specific order (each depends on the previous)

## When to Use Queue Mode

Queue mode is for ordered, sequential work:
- Migration steps that must run in order
- Refactoring passes (rename → restructure → clean up)
- Tutorial chapters that build on each other
- Any pipeline where step N depends on step N-1

---

## Step 1: Create Your Tasks

```bash
maestro task create "Step 1: Extract database queries into repository layer" \
  --desc "Move all raw SQL queries from route handlers into src/repositories/. Create one repository file per table." \
  --priority high

maestro task create "Step 2: Add TypeScript types for all repositories" \
  --desc "Create interfaces for all repository return types in src/types/. Update repository functions to use them." \
  --priority high

maestro task create "Step 3: Replace direct DB calls in routes with repository calls" \
  --desc "Update all route handlers to use repositories instead of direct queries. Remove knex imports from route files." \
  --priority high

maestro task create "Step 4: Add unit tests for repository layer" \
  --desc "Write tests for every repository function. Mock the database connection." \
  --priority medium
```

## Step 2: Create a Task List

Bundle them into an ordered list:

```bash
maestro task-list create
```

This opens an interactive flow to name the list and add tasks in order. Or use the API:

```bash
# List available task lists
maestro task-list list
```

You can also add tasks to a list individually or reorder them:

```bash
maestro task-list reorder <list-id>
```

## Step 3: Spawn a Session with Multiple Tasks

Assign all tasks in the list to a single session:

```bash
maestro session spawn --tasks task_step1,task_step2,task_step3,task_step4
```

The session receives all four tasks in order. Claude works through them sequentially:

1. Completes Step 1 → reports done
2. Picks up Step 2 → reports done
3. Picks up Step 3 → reports done
4. Picks up Step 4 → reports done
5. Session completes

## Step 4: Monitor Progress

```bash
maestro session watch <session-id>
```

```
[session:watch] Watching 1 session(s)
[session:watch] Connected. Listening for events...
[09:00:01] sess_queue status: working
[09:05:30] sess_queue progress: Step 1 complete — repositories extracted
[09:10:15] sess_queue progress: Step 2 in progress — adding types
[09:14:00] sess_queue progress: Step 2 complete — all types added
[09:18:30] sess_queue progress: Step 3 in progress — updating route handlers
[09:25:00] sess_queue progress: Step 3 complete — routes updated
[09:28:00] sess_queue progress: Step 4 in progress — writing tests
[09:35:00] sess_queue COMPLETED
[session:watch] All watched sessions have finished.
```

Check individual task statuses:

```bash
maestro task list
```

```
ID            Title                                           Status
task_step1    Step 1: Extract database queries               ✅ completed
task_step2    Step 2: Add TypeScript types                   ✅ completed
task_step3    Step 3: Replace direct DB calls                ✅ completed
task_step4    Step 4: Add unit tests                         ✅ completed
```

---

## Reordering Tasks

Need to change the order? Reorder the list before spawning:

```bash
maestro task-list reorder <list-id>
```

---

## Queue Mode vs Parallel

| Queue Mode | Parallel |
|-----------|----------|
| One session, many tasks | Many sessions, one task each |
| Sequential execution | Simultaneous execution |
| Each task builds on previous | Tasks are independent |
| Consistent context | Isolated contexts |
| Good for pipelines | Good for throughput |

---

## Tips

- **Keep context between steps.** A single session maintains context across all tasks — Claude remembers what it did in Step 1 when working on Step 2.
- **Write clear ordering signals.** Prefix tasks with "Step 1:", "Step 2:" etc. so the sequence is obvious.
- **Handle blocked tasks.** If Claude gets stuck on one step, it reports blocked and you can intervene:

```bash
maestro session prompt <session-id> --message "Skip the failing test and move to the next step."
```

---

## What Next?

- **Want parallel execution instead?** See [Run Multiple Agents in Parallel](./parallel-agents.md).
- **Want automated coordination?** See [Use an Orchestrator](./orchestrator-coordination.md).
- **Want to track progress live?** See [Track Progress in Real Time](./real-time-tracking.md).
