/**
 * Workflow Phase Instructions
 *
 * All workflow phase instruction strings sent to AI agents.
 * These define what agents do at each step of their workflow.
 *
 * Organized by mode (execute/coordinate) and strategy (simple/tree/recruit/default/batching/dag).
 */

// ═══════════════════════════════════════════════════════════════
// EXECUTE MODE — Default Phases
// ═══════════════════════════════════════════════════════════════

export const EXECUTE_INIT_PHASE =
  'Read your assigned tasks in the <tasks> block.\n' +
  'If a <reference_tasks> block is present, you MUST first fetch each reference task and its docs BEFORE starting work:\n' +
  '  1. maestro task get <refTaskId>  — read the reference task details\n' +
  '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
  'Reference task docs contain critical context, examples, or prior work. Read them thoroughly.\n' +
  'If a <coordinator_directive> is present, read it carefully — it contains your coordinator\'s specific instructions.\n' +
  'Check `maestro mail inbox` for any initial messages from your coordinator.';

export const EXECUTE_WORK_PHASE =
  'Work through each task directly — do not decompose or delegate.\n' +
  'IMPORTANT: Before starting each task, check for new directives from your coordinator:\n' +
  '  maestro mail inbox\n' +
  'If you receive a directive that changes your priorities or approach, adjust accordingly.\n' +
  'If blocked, notify your coordinator:\n' +
  '  maestro mail send --to-coordinator --type query --subject "<what you need>" --message "<details>"\n' +
  'Then wait for a response: maestro mail wait --timeout 30000\n' +
  'After completing each task, report it:\n' +
  '  maestro task report complete <taskId> "<summary of what was done>"';

export const EXECUTE_COMPLETE_PHASE =
  'When all tasks are done:\n' +
  '  maestro session report complete "<summary of all work completed>"';

// ═══════════════════════════════════════════════════════════════
// EXECUTE MODE — Tree Strategy
// ═══════════════════════════════════════════════════════════════

export const EXECUTE_TREE_ANALYZE_PHASE =
  'If a <reference_tasks> block is present, you MUST first fetch each reference task and its docs BEFORE starting work:\n' +
  '  1. maestro task get <refTaskId>  — read the reference task details\n' +
  '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
  'Reference task docs contain critical context, examples, or prior work. Read them thoroughly and apply their guidance to your tasks.\n' +
  'Run `maestro task children <taskId> --recursive` to see the full task tree. ' +
  'Identify leaf tasks and check dependencies.\n' +
  'Check `maestro mail inbox` for any initial messages or directives from your coordinator.';

export const EXECUTE_TREE_PLAN_PHASE =
  'Determine execution order: tasks with no unresolved dependencies go first. ' +
  'Group independent siblings for sequential execution.';

export const EXECUTE_TREE_WORK_PHASE =
  'Work through tasks in order. IMPORTANT: Before starting each task, check for new directives:\n' +
  '  maestro mail inbox\n' +
  'If you receive a directive that changes your priorities, adjust accordingly.\n' +
  'For each task:\n' +
  '  1. maestro task report progress <taskId> "Starting"\n' +
  '  2. Complete it\n' +
  '  3. maestro task report complete <taskId> "<summary>"\n' +
  'If blocked, notify your coordinator:\n' +
  '  maestro mail send --to-coordinator --type query --subject "<what you need>" --message "<details>"';

export const EXECUTE_TREE_COMPLETE_PHASE =
  'When ALL tasks in the tree are done:\n' +
  '  maestro session report complete "<summary>"';

// ═══════════════════════════════════════════════════════════════
// EXECUTE MODE — Recruit Strategy
// ═══════════════════════════════════════════════════════════════

export const EXECUTE_RECRUIT_ANALYZE_PHASE =
  'Read your assigned tasks. Determine what team members are needed. ' +
  'Run `maestro team-member list` to check existing members.';

export const EXECUTE_RECRUIT_WORK_PHASE =
  'Create team members:\n' +
  '  maestro team-member create "<name>" --role "<role>" --avatar "<emoji>" --mode <execute|coordinate> [--model <model>] [--agent-tool <tool>] [--identity "<instructions>"]\n\n' +
  'Create one at a time. Verify each before creating the next.';

export const EXECUTE_RECRUIT_COMPLETE_PHASE =
  'When all team members are created:\n' +
  '  maestro session report complete "<summary with IDs, roles, and configurations>"';

// ═══════════════════════════════════════════════════════════════
// COORDINATE MODE — Default Phases
// ═══════════════════════════════════════════════════════════════

export const COORDINATE_ANALYZE_PHASE =
  'Read all assigned tasks in the <tasks> block. Understand the requirements and acceptance criteria. ' +
  'If a <reference_tasks> block is present, first fetch each reference task and its docs:\n' +
  '  1. maestro task get <refTaskId>  — read the reference task details\n' +
  '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
  'Reference task docs provide critical context for planning. ' +
  'You must decompose and delegate — do NOT do them yourself.';

export const COORDINATE_DECOMPOSE_PHASE =
  'Break tasks into small subtasks, each completable by a single worker:\n' +
  '  maestro task create "<title>" -d "<description with acceptance criteria>" --priority <high|medium|low> --parent <parentTaskId>';

export const COORDINATE_SPAWN_PHASE =
  'Spawn worker sessions for subtasks. IMPORTANT: Include an initial directive with each spawn using --subject and --message. ' +
  'This ensures workers receive instructions BEFORE they start working:\n' +
  '  maestro session spawn --task <subtaskId> --subject "<clear directive>" --message "<detailed instructions, context, and guidance>" [--team-member-id <tmId>] [--agent-tool <claude-code|codex|gemini>] [--model <model>]\n' +
  'You can spawn multiple workers in parallel — do NOT wait for each to finish before spawning the next.\n' +
  'Collect all session IDs for monitoring.';

export const COORDINATE_MONITOR_PHASE =
  'Monitor workers using an event-driven loop (do NOT poll on a timer):\n' +
  '  1. maestro mail wait --timeout 60000     — block until a worker message arrives\n' +
  '  2. maestro mail inbox                    — read ALL pending messages\n' +
  '  3. maestro task children <parentTaskId>  — check subtask statuses\n' +
  '  4. React to each message:\n' +
  '     - status_update → acknowledge, adjust plan if needed\n' +
  '     - query → answer via maestro mail reply <mailId> --message "<answer>"\n' +
  '     - blocked → investigate and send a directive to unblock\n' +
  '  5. Repeat until all subtasks are completed\n' +
  'If a worker goes silent for too long, send a status query:\n' +
  '  maestro mail send <sessionId> --type query --subject "Status check" --message "Please report your current progress."';

export const COORDINATE_RECOVER_PHASE =
  'If a worker fails or reports blocked:\n' +
  '  1. Diagnose: maestro task get <taskId> — read error details\n' +
  '  2. Decide: Can the worker be unblocked with a directive, or does the task need re-spawning?\n' +
  '  3. Unblock: maestro mail send <sessionId> --type directive --subject "<guidance>" --message "<specific fix instructions>"\n' +
  '  4. Re-spawn if needed: maestro session spawn --task <taskId> --subject "<new approach>" --message "<revised instructions>" [--team-member-id <tmId>]\n' +
  '  5. If the issue is systemic, adjust remaining subtasks before proceeding.';

export const COORDINATE_VERIFY_PHASE =
  'After workers finish, verify all subtask statuses:\n' +
  '  maestro task children <parentTaskId>\n' +
  'Ensure all are completed. Retry any failures or report blocked if unresolvable.';

export const COORDINATE_COMPLETE_PHASE =
  'When all subtasks are done:\n' +
  '  maestro task report complete <parentTaskId> "<summary>"\n' +
  '  maestro session report complete "<overall summary>"';

// ═══════════════════════════════════════════════════════════════
// COORDINATE MODE — Batching Strategy
// ═══════════════════════════════════════════════════════════════

export const COORDINATE_BATCH_ANALYZE_PHASE =
  'Read all assigned tasks in the <tasks> block. ' +
  'Identify which pieces of work are independent vs dependent.';

export const COORDINATE_BATCH_DECOMPOSE_PHASE =
  'Break tasks into subtasks grouped into BATCHES (independent subtasks that can run in parallel). ' +
  'Order batches so later ones depend on earlier ones.\n' +
  '  maestro task create "<title>" -d "<description>" --parent <parentTaskId>';

export const COORDINATE_BATCH_EXECUTE_PHASE =
  'For each batch:\n' +
  '  1. Spawn all workers in the batch with initial directives (spawn them all, do not wait between spawns):\n' +
  '     maestro session spawn --task <subtaskId> --subject "<directive>" --message "<detailed instructions>" [--team-member-id <tmId>]\n' +
  '  2. Monitor via event-driven loop:\n' +
  '     a. maestro mail wait --timeout 60000  — block until worker message arrives\n' +
  '     b. maestro mail inbox                 — read all pending messages\n' +
  '     c. maestro task children <parentTaskId> — check subtask statuses\n' +
  '     d. React: reply to queries, unblock workers, send directives as needed\n' +
  '     e. Repeat until all batch tasks are completed\n' +
  '  3. If a worker fails, re-spawn or reassign before proceeding.\n' +
  '  4. Proceed to next batch only when current batch succeeds.';

export const COORDINATE_BATCH_COMPLETE_PHASE =
  'When all batches succeeded:\n' +
  '  maestro task report complete <parentTaskId> "<summary>"\n' +
  '  maestro session report complete "<summary>"';

// ═══════════════════════════════════════════════════════════════
// COORDINATE MODE — DAG Strategy
// ═══════════════════════════════════════════════════════════════

export const COORDINATE_DAG_ANALYZE_PHASE =
  'Read all assigned tasks in the <tasks> block. ' +
  'Map out dependency relationships between the pieces of work.';

export const COORDINATE_DAG_BUILD_PHASE =
  'Decompose into subtasks with dependency edges (DAG):\n' +
  '  maestro task create "<title>" -d "<description. DEPENDS ON: <taskId1>, <taskId2>>" --parent <parentTaskId>\n' +
  'A subtask is READY when all dependencies are completed.';

export const COORDINATE_DAG_EXECUTE_PHASE =
  'Execute in waves:\n' +
  '  1. Find READY tasks → spawn all workers in parallel with initial directives (do not wait between spawns):\n' +
  '     maestro session spawn --task <subtaskId> --subject "<directive>" --message "<detailed instructions>"\n' +
  '  2. Monitor via event-driven loop:\n' +
  '     a. maestro mail wait --timeout 60000  — block until worker message arrives\n' +
  '     b. maestro mail inbox                 — read all pending messages\n' +
  '     c. maestro task children <parentTaskId> — check subtask statuses\n' +
  '     d. React: reply to queries, unblock workers, send directives as needed\n' +
  '     e. Repeat until current wave is completed\n' +
  '  3. On completion, unlock downstream tasks\n' +
  '  4. If a worker fails, re-spawn or adjust the DAG before proceeding\n' +
  '  5. Repeat until no tasks remain.';

export const COORDINATE_DAG_COMPLETE_PHASE =
  'When the full DAG is resolved:\n' +
  '  maestro task report complete <parentTaskId> "<summary>"\n' +
  '  maestro session report complete "<summary>"';
