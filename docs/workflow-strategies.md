# Maestro Workflow Strategies

How the agent prompt is constructed per mode + strategy, and what algorithm each strategy instructs the agent to follow.

---

## Prompt Architecture

Two layers are sent to the agent tool (Claude Code, Codex, Gemini):

1. **System Prompt** (`--append-system-prompt`) — static, role-level instructions:
   - `<identity>` — who you are (worker vs coordinator)
   - `<capabilities>` — what you can/can't do (spawn, queue, etc.)
   - `<workflow>` — the strategy-specific algorithm (phases)
   - `<commands>` — available CLI commands with syntax

2. **Initial User Message** (first CLI argument) — task-specific context:
   - `<task>` — id, title, description, acceptance criteria, priority
   - `<skills>` — loaded plugins
   - `<session_context>` — session ID
   - `<reference_task_context>` — docs from reference tasks (if any)

The task context is already in the prompt. Agents do NOT need to fetch it again with `maestro task get` or `maestro status`.

---

## Execute Mode Strategies

### `simple` — Single Task Execution

The default for workers. One task, one agent, no delegation.

**Phases:**

| Phase | Algorithm |
|-------|-----------|
| **execute** | Read the task from the `<task>` block. Implement it directly — write code, run tests, fix issues. Do not decompose or delegate. |
| **report** | After each milestone: `maestro session report progress "<message>"`. On blocker: `maestro session report blocked "<reason>"` |
| **complete** | When acceptance criteria are met: `maestro session report complete "<summary>"`. Optionally add docs: `maestro session docs add "<title>" --file <path>` |

### `queue` — FIFO Task Queue

Agent processes tasks from a queue one at a time in a loop.

**Phases:**

| Phase | Algorithm |
|-------|-----------|
| **pull** | `maestro queue top` — peek at next task. If empty, wait and poll with `maestro queue status`. Do NOT exit. |
| **claim** | `maestro queue start` — claim the task, marks it "processing". |
| **execute** | Implement the claimed task fully — code, test, verify. |
| **report** | `maestro session report progress "<message>"` on milestones. |
| **finish** | `maestro queue complete` (or `maestro queue fail "<reason>"`). Loop back to **pull**. Repeat until queue stays empty. |

### `tree` — Subtask Tree Execution

Agent works through a pre-existing tree of subtasks with dependency ordering.

**Phases:**

| Phase | Algorithm |
|-------|-----------|
| **analyze** | `maestro task children <taskId> --recursive` — discover full tree. Identify leaf tasks and dependencies. |
| **plan** | Determine execution order: no-dependency tasks first. Group independent siblings. |
| **execute** | For each task in order: (1) `maestro task report progress <taskId> "Starting"`, (2) implement fully, (3) `maestro task report complete <taskId> "<summary>"`. |
| **report** | Per-task: `maestro task report progress <taskId> "<msg>"`. Session-level blockers: `maestro session report blocked "<reason>"`. |
| **complete** | Only when ALL subtasks done: `maestro session report complete "<summary>"`. |

---

## Coordinate Mode Strategies

Coordinators NEVER write code. They decompose, spawn workers, monitor, and report.

### `default` — Sequential Decompose + Spawn

Simplest coordination: break task apart, spawn one worker per subtask sequentially, monitor all.

**Phases:**

| Phase | Algorithm |
|-------|-----------|
| **analyze** | Read the `<task>` block. Understand title, description, acceptance criteria. This is what you decompose — do NOT implement. |
| **decompose** | Create subtasks: `maestro task create "<title>" -d "<description>" --parent <parentTaskId>`. Each should be independently completable by one worker. Order so dependencies come first. |
| **spawn** | For each subtask: `maestro session spawn --task <subtaskId>`. Spawn ONE AT A TIME. Collect all session IDs. |
| **monitor** | `maestro session watch <id1>,<id2>,...` — blocks until all sessions complete/fail/stop. Investigate BLOCKED workers with `maestro task get`. |
| **verify** | `maestro task children <parentTaskId>` — check all statuses. Retry failed tasks or report blocked. Verify parent acceptance criteria. |
| **complete** | `maestro task report complete <parentTaskId> "<summary>"` then `maestro session report complete "<overall summary>"`. |

### `intelligent-batching` — Parallel Batch Execution

Groups independent subtasks into batches. Batches run in parallel, batch sequence is sequential.

**Phases:**

| Phase | Algorithm |
|-------|-----------|
| **analyze** | Read the `<task>` block. Identify which pieces of work are independent vs dependent. |
| **decompose** | Create subtasks, group into **batches**. A batch = set of tasks with NO mutual dependencies (can run in parallel). Order batches so later ones depend on earlier. Example: A,B independent, C depends on both → Batch 1: [A,B], Batch 2: [C]. Create all subtasks upfront. |
| **execute_batch** | For each batch sequentially: (1) Spawn ALL workers in batch, (2) collect session IDs, (3) `maestro session watch <ids>`, (4) wait for completion, (5) `maestro task children <parentId>` to check, (6) retry or abort on failure, (7) proceed to next batch only when ALL tasks in current batch succeeded. |
| **verify** | `maestro task children <parentTaskId>` — ensure every subtask completed. |
| **complete** | `maestro task report complete <parentTaskId>` then `maestro session report complete "<summary with batch count>"`. |

### `dag` — Dependency Graph with Wave Execution

Maximizes parallelism by building a DAG and executing in topological waves.

**Phases:**

| Phase | Algorithm |
|-------|-----------|
| **analyze** | Read the `<task>` block. Map out work and dependency relationships. |
| **build_dag** | Create subtasks with explicit dependency edges: `maestro task create "<title>" -d "<desc. DEPENDS ON: taskId1, taskId2>" --parent <parentId>`. Track the graph. A task is READY when all dependencies are completed. Root nodes are ready immediately. |
| **execute_wave** | **WAVE LOOP:** (1) Find all READY tasks (deps completed, not spawned), (2) spawn a worker per ready task, (3) `maestro session watch <ids>`, (4) on completion check results, (5) mark completed → unlock downstream, (6) retry/skip/abort on failure, (7) repeat with newly ready tasks, (8) stop when no tasks remain. Independent DAG branches execute simultaneously. |
| **verify** | `maestro task children <parentTaskId>` — every DAG node must be completed. |
| **complete** | `maestro task report complete <parentTaskId>` then `maestro session report complete "<summary with wave count>"`. |

---

## Key Commands Reference

### Reporting (all modes)
```
maestro session report progress "<message>"
maestro session report blocked "<reason>"
maestro session report complete "<summary>"
maestro session report error "<description>"
```

### Task Management (coordinate mode)
```
maestro task create "<title>" -d "<desc>" --parent <parentId> --priority <high|medium|low>
maestro task children <taskId> [--recursive]
maestro task report complete <taskId> "<summary>"
```

### Session Management (coordinate mode)
```
maestro session spawn --task <subtaskId>
maestro session watch <id1>,<id2>,...
maestro session list
```

### Queue Operations (queue strategy only)
```
maestro queue top
maestro queue start
maestro queue complete
maestro queue fail "<reason>"
maestro queue status
```

### Documentation
```
maestro session docs add "<title>" --file <path>
maestro task docs add <taskId> "<title>" --file <filePath>
```
