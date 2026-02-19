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
  'If a <coordinator_directive> is present, read it carefully — it contains your coordinator\'s specific instructions.';

export const EXECUTE_WORK_PHASE =
  'Work through each task directly — do not decompose or delegate.\n' +
  'IMPORTANT: Print clear status text throughout your work. Your coordinator observes ONLY your printed text.\n' +
  '- Before major actions: "Running tests for auth module..."\n' +
  '- After results: "Tests passed: 12/12"\n' +
  '- If blocked: "BLOCKED: Cannot find database config."\n' +
  'If blocked, report it:\n' +
  '  maestro task report blocked <taskId> "<what you need>"\n' +
  'After completing each task, report it:\n' +
  '  maestro task report complete <taskId> "<summary of what was done>"\n' +
  'After completing each task, add any files you created or modified as task docs:\n' +
  '  maestro task docs add <taskId> "<descriptive title>" --file <filePath>\n' +
  'This preserves your work artifacts for the coordinator and future reference.\n' +
  'If your <session_context> contains a <coordinator_session_id>, notify your coordinator directly AFTER calling task report:\n' +
  '  On task complete: maestro session prompt <coordinatorSessionId> --message "Task <taskId> complete: <summary>"\n' +
  '  On blocked:       maestro session prompt <coordinatorSessionId> --message "BLOCKED on task <taskId>: <reason>"\n' +
  '  On error:         maestro session prompt <coordinatorSessionId> --message "ERROR on task <taskId>: <description>"\n' +
  'To communicate with a sibling worker (e.g. to share findings, ask about shared code, or avoid duplicate work):\n' +
  '  1. Discover siblings: maestro session siblings\n' +
  '     Returns: session ID, name, role, status for each active peer\n' +
  '  2. Send a message:    maestro session prompt <siblingSessionId> --message "<your question or info>"\n' +
  'Use peer messaging when another worker has context you need — they are all working on the same codebase.\n' +
  'To send a persistent message (with PTY wakeup) to a sibling session:\n' +
  '  maestro session notify <targetSessionId> --message "<brief>" [--detail "<longer context>"]\n' +
  '  This sends a PTY wakeup AND stores a mail record for the recipient to read later.\n' +
  'To read messages sent to you by siblings:\n' +
  '  maestro session mail read\n' +
  '  Call this at the start of your work to catch any sibling notifications.\n' +
  '  Note: coordinator directives arrive via direct PTY injection — they do NOT create mail records.';

export const EXECUTE_COMPLETE_PHASE =
  'When all tasks are done:\n' +
  'Before closing, ensure you have added all important work artifacts as task docs:\n' +
  '  maestro task docs add <taskId> "<title>" --file <filePath>\n' +
  '  maestro session report complete "<summary of all work completed>"\n' +
  'If <coordinator_session_id> is present in your <session_context>, also run:\n' +
  '  maestro session prompt <coordinatorSessionId> --message "All tasks done. Session closing."';

// ═══════════════════════════════════════════════════════════════
// EXECUTE MODE — Tree Strategy
// ═══════════════════════════════════════════════════════════════

export const EXECUTE_TREE_ANALYZE_PHASE =
  'If a <reference_tasks> block is present, you MUST first fetch each reference task and its docs BEFORE starting work:\n' +
  '  1. maestro task get <refTaskId>  — read the reference task details\n' +
  '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
  'Reference task docs contain critical context, examples, or prior work. Read them thoroughly and apply their guidance to your tasks.\n' +
  'Run `maestro task children <taskId> --recursive` to see the full task tree. ' +
  'Identify leaf tasks and check dependencies.';

export const EXECUTE_TREE_PLAN_PHASE =
  'Determine execution order: tasks with no unresolved dependencies go first. ' +
  'Group independent siblings for sequential execution.';

export const EXECUTE_TREE_WORK_PHASE =
  'Work through tasks in order.\n' +
  'For each task:\n' +
  '  1. maestro task report progress <taskId> "Starting"\n' +
  '  2. Complete it\n' +
  '  3. maestro task report complete <taskId> "<summary>"\n' +
  '  4. Add files created or modified as task docs: maestro task docs add <taskId> "<title>" --file <filePath>\n' +
  'If blocked, report it:\n' +
  '  maestro task report blocked <taskId> "<what you need>"';

export const EXECUTE_TREE_COMPLETE_PHASE =
  'When ALL tasks in the tree are done:\n' +
  'Before closing, ensure you have added all important work artifacts as task docs:\n' +
  '  maestro task docs add <taskId> "<title>" --file <filePath>\n' +
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
  'Before closing, ensure you have added all important work artifacts as task docs:\n' +
  '  maestro task docs add <taskId> "<title>" --file <filePath>\n' +
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
  'Collect all session IDs for monitoring.\n' +
  'IMPORTANT: In your --message directive, remind workers to add task docs for any files they create or modify using: maestro task docs add <taskId> "<title>" --file <filePath>';

export const COORDINATE_MONITOR_PHASE =
  'Monitor workers each turn using BOTH methods:\n' +
  '  1. Read worker output: maestro session logs --my-workers --last 5\n' +
  '     - Shows last 5 text lines each worker printed (tool calls are invisible)\n' +
  '     - Look for progress, errors, stuck warnings\n' +
  '  2. Check task statuses: maestro task children <parentTaskId>\n' +
  '  3. React: progressing → wait; stuck → send directive; blocked → diagnose; completed → assign next\n' +
  '  4. Intervene: maestro session prompt <sessionId> --message "<instructions>"\n' +
  '  5. Repeat until all subtasks completed';

export const COORDINATE_RECOVER_PHASE =
  'If a worker fails or reports blocked:\n' +
  '  1. Get deeper logs: maestro session logs <sessionId> --last 10\n' +
  '  2. Diagnose from text output and task status: maestro task get <taskId>\n' +
  '  3. Decide: Can the worker be unblocked with a directive, or does the task need re-spawning?\n' +
  '  4. Unblock: maestro session prompt <sessionId> --message "<specific fix instructions>"\n' +
  '  5. Re-spawn if needed: maestro session spawn --task <taskId> --subject "<new approach>" --message "<revised instructions>" [--team-member-id <tmId>]\n' +
  '  6. If the issue is systemic, adjust remaining subtasks before proceeding.';

export const COORDINATE_VERIFY_PHASE =
  'After workers finish, verify all subtask statuses:\n' +
  '  maestro task children <parentTaskId>\n' +
  'Ensure all are completed. Retry any failures or report blocked if unresolvable.\n' +
  'Also verify that workers added task docs for their output:\n' +
  '  maestro task docs list <subtaskId>';

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
  '  2. Monitor using BOTH methods:\n' +
  '     a. maestro session logs --my-workers --last 5 — read worker text output\n' +
  '     b. maestro task children <parentTaskId> — check subtask statuses\n' +
  '     c. React: unblock workers via maestro session prompt <sessionId> --message "<instructions>"\n' +
  '     d. Repeat until all batch tasks are completed\n' +
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
  '  2. Monitor using BOTH methods:\n' +
  '     a. maestro session logs --my-workers --last 5 — read worker text output\n' +
  '     b. maestro task children <parentTaskId> — check subtask statuses\n' +
  '     c. React: unblock workers via maestro session prompt <sessionId> --message "<instructions>"\n' +
  '     d. Repeat until current wave is completed\n' +
  '  3. On completion, unlock downstream tasks\n' +
  '  4. If a worker fails, re-spawn or adjust the DAG before proceeding\n' +
  '  5. Repeat until no tasks remain.';

export const COORDINATE_DAG_COMPLETE_PHASE =
  'When the full DAG is resolved:\n' +
  '  maestro task report complete <parentTaskId> "<summary>"\n' +
  '  maestro session report complete "<summary>"';
