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
  'Read your assigned tasks. Determine what team members are needed.\n' +
  '  1. Run `maestro team-member list` to check existing members.\n' +
  '  2. Run `maestro skill list --json` to discover all locally installed skills (names, descriptions, tags, categories).\n' +
  '  3. Analyze task requirements and determine what roles/specialists are needed.';

export const EXECUTE_RECRUIT_SKILL_DISCOVERY_PHASE =
  'SKILL DISCOVERY — find the best skills for each planned team member.\n' +
  'For each team member role identified in the analyze phase:\n' +
  '  1. Check locally installed skills for matches based on description, tags, and category.\n' +
  '  2. Search the ecosystem for additional skills: run `npx skills find <query>` with role-relevant keywords.\n' +
  '     For example, for a frontend developer: `npx skills find react`, `npx skills find frontend`.\n' +
  '  3. Compile a list of recommended skills to install from the ecosystem.\n\n' +
  'Present the skill discovery results clearly, showing:\n' +
  '  - Already installed skills that match each role\n' +
  '  - New skills found in the ecosystem that should be installed (with install commands)\n\n' +
  'Report BLOCKED and wait for approval to install skills:\n' +
  '  maestro task report blocked <taskId> "Skill discovery complete — awaiting approval to install new skills from ecosystem. Review the skills above and send a directive to approve or provide feedback."\n' +
  'Do NOT install any skills until you receive an approval directive.\n' +
  'Once approved, install the approved skills: `npx skills add <owner/repo@skill> -g -y`\n' +
  'After installing, run `maestro skill list --json` again to confirm the new skills are available.';

export const EXECUTE_RECRUIT_PLAN_PHASE =
  'Build and present the final recruitment plan.\n' +
  'For each team member to recruit, show:\n' +
  '  1. Name, role, avatar, mode, model\n' +
  '  2. Identity (persona instructions)\n' +
  '  3. Assigned skills with descriptions (show skill name + what it does)\n\n' +
  'Present the plan in a clear, readable format. For example:\n' +
  '  ┌─────────────────────────────────────────────────────┐\n' +
  '  │ 🧑‍💻 Team Member: "Frontend Developer"                │\n' +
  '  │ Role: React/TypeScript frontend specialist          │\n' +
  '  │ Mode: execute | Model: sonnet                       │\n' +
  '  │ Identity: "You are a frontend developer..."         │\n' +
  '  │                                                     │\n' +
  '  │ Skills:                                             │\n' +
  '  │   • react-expert — React best practices & patterns  │\n' +
  '  │   • frontend-design — Expert UI creation            │\n' +
  '  │   • tailwind-css-patterns — Tailwind utilities      │\n' +
  '  └─────────────────────────────────────────────────────┘\n\n' +
  'After presenting the full plan, report BLOCKED and wait for approval:\n' +
  '  maestro task report blocked <taskId> "Recruitment plan ready — awaiting approval to create team members. Review the plan above and send a directive to approve or provide feedback."\n' +
  'Do NOT create any team members until you receive an approval directive.';

export const EXECUTE_RECRUIT_WORK_PHASE =
  'You have received approval. Create the team members as planned.\n' +
  'If the approval directive includes feedback or changes, adjust accordingly before creating.\n\n' +
  'Create team members with their assigned skills:\n' +
  '  maestro team-member create "<name>" --role "<role>" --avatar "<emoji>" --mode <execute|coordinate> [--model <model>] [--agent-tool <tool>] [--identity "<instructions>"] [--skills <skill1,skill2,...>]\n\n' +
  'Create one at a time. Verify each before creating the next.';

export const EXECUTE_RECRUIT_COMPLETE_PHASE =
  'When all team members are created:\n' +
  'Before closing, ensure you have added all important work artifacts as task docs:\n' +
  '  maestro task docs add <taskId> "<title>" --file <filePath>\n' +
  '  maestro session report complete "<summary with IDs, roles, configurations, and assigned skills for each member>"';

// ═══════════════════════════════════════════════════════════════
// COORDINATE MODE — Default Phases
// ═══════════════════════════════════════════════════════════════

export const COORDINATE_ANALYZE_PHASE =
  'Read all assigned tasks in the <tasks> block. Understand the requirements and acceptance criteria. ' +
  'IMPORTANT: Also inventory the <available_team_members> block in your system prompt if present — note each member\'s ID, name, role, and capabilities. You will use this information during spawn to assign work to the right specialist.\n' +
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
  'For each subtask, consider whether a team member from your inventory would be a good fit by expertise and role. If so, include --team-member-id to spawn that specialist:\n' +
  '  maestro session spawn --task <subtaskId> --subject "<clear directive>" --message "<detailed instructions, context, and guidance>" [--team-member-id <tmId>] [--agent-tool <claude-code|codex|gemini>] [--model <model>]\n' +
  'You can also spawn directly without a team member if no suitable member is available or if the task is better handled by Claude.\n' +
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
