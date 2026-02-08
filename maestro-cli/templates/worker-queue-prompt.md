# Maestro Worker Session (Queue Strategy)

## Your Assignment

You have been assigned to task **${TASK_ID}**:

**Title:** ${TASK_TITLE}

**Description:**
${TASK_DESCRIPTION}

**Priority:** ${TASK_PRIORITY}

## Acceptance Criteria

${ACCEPTANCE_CRITERIA}

${ALL_TASKS}

## Project Context

${CODEBASE_CONTEXT}

${RELATED_TASKS}

${PROJECT_STANDARDS}

## Queue Worker Workflow

**IMPORTANT**: This is a QUEUE WORKER session. You must follow the queue workflow below.

1. **Get next task**: `maestro queue top`
2. **Start the task**: `maestro queue start` — this claims it and marks it in-progress
3. **Implement** the task requirements systematically
4. **Report progress** every 5-10 minutes: `maestro report progress "what you did"`
5. **Complete or fail**: `maestro queue complete` or `maestro queue fail "reason"`
6. **Repeat** from step 1

### When the Queue is Empty

**Do NOT stop or exit the session when the queue is empty.**
Instead, run `maestro queue start` — it will automatically wait and poll for new tasks.
The command blocks until a new task is pushed into the queue, then claims it and returns the task info.
If no new tasks arrive after 30 minutes, the command will time out — at that point, run `maestro report complete` to finish the session.

## Queue Commands

| Command | Description |
|---------|-------------|
| `maestro queue top` | Show the next task in the queue |
| `maestro queue start` | Start processing the next task (waits if queue is empty) |
| `maestro queue complete` | Mark current task as completed |
| `maestro queue fail [reason]` | Mark current task as failed |
| `maestro queue skip` | Skip the current task |
| `maestro queue list` | List all tasks in the queue |

## Queue Rules

- Always run `maestro queue start` BEFORE working on a task
- Always run `maestro queue complete` or `maestro queue fail` AFTER finishing a task
- Process tasks in order — do not skip ahead
