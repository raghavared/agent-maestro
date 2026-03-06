# Execution Strategies

**How tasks get assigned and processed matters. Maestro supports two approaches: simple (all tasks at once) and queue (one at a time, in order).**

---

## Why Execution Strategy Matters

When you assign multiple tasks to a session, Claude needs to know: should it see everything at once and choose what to tackle first? Or should it process tasks one by one in a specific order?

The answer depends on the work:
- **Exploratory work** benefits from seeing the full picture
- **Predictable workflows** benefit from ordered execution

Maestro supports both through its task assignment model and task lists.

## Simple Strategy: All Tasks at Once

In simple mode, Claude receives all its assigned tasks simultaneously in the manifest. It reads them all, understands the full scope, and decides how to approach them.

```bash
# Assign multiple tasks to one session
maestro session spawn --tasks <task-1>,<task-2>,<task-3>
```

The manifest's `tasks` array contains all three tasks. Claude sees:

```
Task 1: Build the login page (high priority)
Task 2: Add input validation (medium priority)
Task 3: Write unit tests (medium priority)
```

Claude might decide to build the login page first (highest priority), then add validation (since it touches the same code), then write tests last. Or it might interleave them. The point is: **Claude has autonomy to choose the order**.

### When to use simple

- Tasks are related and benefit from shared context
- The order doesn't matter much
- You trust Claude to prioritize correctly
- The work is exploratory — Claude might discover dependencies as it goes

### Built-in workflow templates for simple

| Template | Mode | Description |
|----------|------|-------------|
| `execute-simple` | Worker | Single task, direct execution |
| `execute-tree` | Worker | Tree-based with dependency ordering |

## Queue Strategy: One at a Time

Queue mode uses **task lists** — ordered collections of tasks that are processed sequentially. Claude completes one task before moving to the next.

### What is a Task List?

A task list is an ordered sequence of task IDs. It defines a specific execution order:

```typescript
interface TaskList {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  orderedTaskIds: string[];    // Tasks in execution order
}
```

Task lists are stored at `~/.maestro/data/task-lists/<task-list-id>.json`.

### Creating a task list

```bash
# Create a task list
maestro task-list create
```

You'll be prompted for a name and description. Then add tasks in order:

### Managing tasks in a list

```bash
# View a task list
maestro task-list get <list-id>

# Reorder tasks in the list
maestro task-list reorder <list-id>

# List all task lists
maestro task-list list
```

### When to use queue

- Tasks have a strict order (migration before seeding, schema before queries)
- Each task builds on the previous one's output
- You want predictable, reproducible execution
- You're running a pipeline (build → test → deploy)

## Coordinator Strategies

When a coordinator decomposes a large task, it chooses an execution strategy for its workers. Maestro provides built-in workflow templates:

| Template | Description | Best For |
|----------|-------------|----------|
| `coordinate-default` | Decompose → spawn workers → monitor → verify | General-purpose coordination |
| `coordinate-batching` | Group independent tasks into parallel batches | Maximizing parallelism |
| `coordinate-dag` | DAG-based execution in topological waves | Complex dependency graphs |

### Default coordination

The coordinator creates subtasks and spawns workers. It monitors progress and handles blockers:

```
Coordinator receives: "Build authentication system"
    ↓
Decomposes into subtasks:
  1. Database schema (no deps)
  2. Auth middleware (depends on 1)
  3. Login UI (depends on 1)
  4. Integration tests (depends on 2, 3)
    ↓
Spawns workers:
  Worker A → subtask 1 (database schema)
    ↓ (waits for completion)
  Worker B → subtask 2 (auth middleware)
  Worker C → subtask 3 (login UI)
    ↓ (waits for both)
  Worker D → subtask 4 (integration tests)
    ↓
Verifies result
    ↓
Reports completion
```

### Batching coordination

Groups independent tasks and runs them in parallel batches:

```
Batch 1 (parallel): [schema, config, types]
    ↓ all complete
Batch 2 (parallel): [middleware, routes, UI]
    ↓ all complete
Batch 3 (sequential): [integration tests]
```

### DAG coordination

Analyzes task dependencies as a directed acyclic graph and executes in topological waves — tasks with no unmet dependencies run in parallel:

```
Wave 1: [A, B]     ← no dependencies
Wave 2: [C, D]     ← depend on A or B
Wave 3: [E]        ← depends on C and D
```

## Task Dependencies and Ordering

Regardless of strategy, task dependencies influence execution order. A task won't start until its dependencies are complete:

```bash
# Task B depends on Task A
maestro task edit <task-b-id>
# Set dependencies: [<task-a-id>]
```

Dependencies work alongside the execution strategy:
- In **simple mode**, Claude checks dependencies and works on unblocked tasks first
- In **queue mode**, the task list order should respect dependencies (you arrange this)
- In **coordinator mode**, the coordinator respects dependencies when spawning workers

## Choosing the Right Strategy

| Scenario | Strategy | Why |
|----------|----------|-----|
| One task, one session | Simple | Nothing to choose |
| A few related tasks | Simple (multi-task) | Claude benefits from seeing the full picture |
| Strict sequential pipeline | Queue (task list) | Order matters, each step depends on the previous |
| Big feature with many parts | Coordinator (default) | Let the coordinator decompose and parallelize |
| Lots of independent tasks | Coordinator (batching) | Maximize parallel throughput |
| Complex dependency web | Coordinator (DAG) | Topological ordering handles the complexity |

## Example: Setting Up a Queue Pipeline

```bash
# Create the tasks
maestro task create "Run database migrations" --priority high
maestro task create "Seed test data" --priority high
maestro task create "Run integration tests" --priority high
maestro task create "Generate API documentation" --priority medium

# Create a task list with specific order
maestro task-list create
# Name: "Deploy Pipeline"
# Add tasks in order: migrations → seed → tests → docs

# View the ordered list
maestro task-list get <list-id>
```

## Example: Coordinator with DAG

```bash
# Create a complex task
maestro task create "Build the e-commerce checkout" --priority high

# Spawn a coordinator — it handles decomposition automatically
maestro session spawn --task <task-id> --mode coordinator --model opus

# The coordinator will:
# 1. Analyze the task
# 2. Create subtasks with dependencies
# 3. Build a DAG
# 4. Execute in topological waves
# 5. Report completion
```

You don't need to manually set up the DAG — the coordinator figures out the dependency graph from the subtasks it creates.

> **Back to:** [Core Concepts Overview](../README.md)
