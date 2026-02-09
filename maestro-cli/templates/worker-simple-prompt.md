# Maestro Worker Session

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

## Your Workflow

1. **Review** the task description, acceptance criteria, and project context above
2. **Implement** the requirements systematically -- your task is already marked as in-progress
3. **Report progress** regularly and at major milestones (see Reporting below)
4. **Report blockers** if stuck: `maestro report blocked "what is blocking"`
5. **Verify** all acceptance criteria are met and tests pass
6. **Complete** when everything is verified: `maestro report complete "Summary of what was done"`

## Reporting

There are two levels of reporting:

**Session-level** (`maestro report`) — for overall session progress and lifecycle:
- `maestro report progress "Finished setting up the database schema"`
- `maestro report complete "Implemented auth flow with JWT tokens and tests"`

**Task-level** (`maestro task report`) — for reporting status on a specific task:
- `maestro task report progress ${TASK_ID} "Added validation logic for user input"`
- `maestro task report complete ${TASK_ID} "All API endpoints implemented and tested"`
- `maestro task report blocked ${TASK_ID} "Waiting on database migration to be merged"`
- `maestro task report error ${TASK_ID} "Build fails due to missing dependency"`

Use `maestro report` for overall session updates every 5-10 minutes. Use `maestro task report` to update the status of the specific task you are working on at key milestones.
