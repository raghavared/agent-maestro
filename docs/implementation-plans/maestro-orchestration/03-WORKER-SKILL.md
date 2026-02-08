# Maestro Worker Skill (Tier 2)

**Role:** The execution engine running in terminal sessions.

## Responsibilities

1.  **Execute** a specific group of subtasks.
2.  **Report** granular status (started, completed, blocked).
3.  **Update** the central timeline.

---

## Worker Skill Commands

The Worker Skill provides CLI commands for the agent to communicate status:

| Command | Usage | Description |
|---------|-------|-------------|
| `maestro task-start <id>` | Start work | Marks task as IN_PROGRESS |
| `maestro task-complete <id>` | Finish work | Marks task as COMPLETED |
| `maestro task-blocked <id> <reason>` | Report issue | Marks task as BLOCKED |
| `maestro update "<msg>"` | Log progress | Adds an entry to the task timeline |

---

## Session Generation

Once the Orchestrator generates the plan, the system spawns Worker Sessions.

### The Worker Prompt

Each session receives a highly specific prompt:

```markdown
# Maestro Worker: {{group.name}}

You are assigned to execute the following subtasks for task "{{task.title}}".

## Context
Files: {{group.context}}

## Your Subtasks (Execute in Order)
1. **{{subtask.title}}** (ID: {{subtask.id}})
   - Description: {{subtask.description}}

## Instructions
1. Run `maestro task-start {{subtask.id}}`
2. Implement the changes.
3. Run `maestro task-complete {{subtask.id}}`
4. Use `maestro update` to log progress.

START NOW.
```

---

## Status Tracking & UI

The UI listens for WebSocket events triggered by the skill commands:

- **task:updated** (status=in_progress) → UI shows spinner on specific task.
- **task:updated** (status=completed) → UI checks off task.
- **task:updated** (status=blocked) → UI shows alert/red status.

This gives the user a "Mission Control" view of heavily parallelized execution.
