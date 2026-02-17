/**
 * Workflow Templates Registry
 *
 * Built-in workflow templates extracted from prompt-builder.ts.
 * Each template defines the phases an agent follows for a given mode+strategy.
 */

import type { AgentMode } from '../types/manifest.js';

export interface WorkflowPhase {
  name: string;
  instruction: string;
  order?: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  mode: AgentMode;
  strategy?: string;
  phases: WorkflowPhase[];
  builtIn: boolean;
}

// ── Built-in templates ────────────────────────────────────────

const EXECUTE_SIMPLE: WorkflowTemplate = {
  id: 'execute-simple',
  name: 'Execute Simple',
  description: 'Direct task execution: complete tasks, report progress, done.',
  mode: 'execute',
  strategy: 'simple',
  builtIn: true,
  phases: [
    {
      name: 'init',
      order: 1,
      instruction:
        'Read your assigned tasks in the <tasks> block.\n' +
        'If a <reference_tasks> block is present, you MUST first fetch each reference task and its docs BEFORE starting work:\n' +
        '  1. maestro task get <refTaskId>  — read the reference task details\n' +
        '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
        'Reference task docs contain critical context, examples, or prior work. Read them thoroughly.\n' +
        'If a <coordinator_directive> is present, read it carefully — it contains your coordinator\'s specific instructions.\n' +
        'Check `maestro mail inbox` for any initial messages from your coordinator.',
    },
    {
      name: 'execute',
      order: 2,
      instruction:
        'Work through each task directly — do not decompose or delegate.\n' +
        'IMPORTANT: Before starting each task, check for new directives from your coordinator:\n' +
        '  maestro mail inbox\n' +
        'If you receive a directive that changes your priorities or approach, adjust accordingly.\n' +
        'If blocked, notify your coordinator:\n' +
        '  maestro mail send --to-coordinator --type query --subject "<what you need>" --message "<details>"\n' +
        'Then wait for a response: maestro mail wait --timeout 30000\n' +
        'After completing each task, report it:\n' +
        '  maestro task report complete <taskId> "<summary of what was done>"',
    },
    {
      name: 'complete',
      order: 3,
      instruction:
        'When all tasks are done:\n' +
        '  maestro session report complete "<summary of all work completed>"',
    },
  ],
};

const EXECUTE_TREE: WorkflowTemplate = {
  id: 'execute-tree',
  name: 'Execute Tree',
  description: 'Tree-based execution: analyze task tree, plan order, execute leaf tasks.',
  mode: 'execute',
  strategy: 'tree',
  builtIn: true,
  phases: [
    {
      name: 'analyze',
      order: 1,
      instruction:
        'If a <reference_tasks> block is present, you MUST first fetch each reference task and its docs BEFORE starting work:\n' +
        '  1. maestro task get <refTaskId>  — read the reference task details\n' +
        '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
        'Reference task docs contain critical context, examples, or prior work. Read them thoroughly and apply their guidance to your tasks.\n' +
        'Run `maestro task children <taskId> --recursive` to see the full task tree. ' +
        'Identify leaf tasks and check dependencies.\n' +
        'Check `maestro mail inbox` for any initial messages or directives from your coordinator.',
    },
    {
      name: 'plan',
      order: 2,
      instruction:
        'Determine execution order: tasks with no unresolved dependencies go first. ' +
        'Group independent siblings for sequential execution.',
    },
    {
      name: 'execute',
      order: 3,
      instruction:
        'Work through tasks in order. IMPORTANT: Before starting each task, check for new directives:\n' +
        '  maestro mail inbox\n' +
        'If you receive a directive that changes your priorities, adjust accordingly.\n' +
        'For each task:\n' +
        '  1. maestro task report progress <taskId> "Starting"\n' +
        '  2. Complete it\n' +
        '  3. maestro task report complete <taskId> "<summary>"\n' +
        'If blocked, notify your coordinator:\n' +
        '  maestro mail send --to-coordinator --type query --subject "<what you need>" --message "<details>"',
    },
    {
      name: 'complete',
      order: 4,
      instruction:
        'When ALL tasks in the tree are done:\n' +
        '  maestro session report complete "<summary>"',
    },
  ],
};

const COORDINATE_DEFAULT: WorkflowTemplate = {
  id: 'coordinate-default',
  name: 'Coordinate Default',
  description: 'Standard orchestration: decompose, spawn workers with directives, monitor via mail.',
  mode: 'coordinate',
  strategy: 'default',
  builtIn: true,
  phases: [
    {
      name: 'analyze',
      order: 1,
      instruction:
        'Read all assigned tasks in the <tasks> block. Understand the requirements and acceptance criteria. ' +
        'You must decompose and delegate — do NOT do them yourself.',
    },
    {
      name: 'decompose',
      order: 2,
      instruction:
        'Break tasks into small subtasks, each completable by a single worker:\n' +
        '  maestro task create "<title>" -d "<description with acceptance criteria>" --priority <high|medium|low> --parent <parentTaskId>',
    },
    {
      name: 'spawn',
      order: 3,
      instruction:
        'Spawn worker sessions for subtasks. IMPORTANT: Include an initial directive with each spawn using --subject and --message. ' +
        'This ensures workers receive instructions BEFORE they start working:\n' +
        '  maestro session spawn --task <subtaskId> --subject "<clear directive>" --message "<detailed instructions, context, and guidance>" [--team-member-id <tmId>] [--agent-tool <claude-code|codex|gemini>] [--model <model>]\n' +
        'You can spawn multiple workers in parallel — do NOT wait for each to finish before spawning the next.\n' +
        'Collect all session IDs for monitoring.',
    },
    {
      name: 'monitor',
      order: 4,
      instruction:
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
        '  maestro mail send <sessionId> --type query --subject "Status check" --message "Please report your current progress."',
    },
    {
      name: 'recover',
      order: 5,
      instruction:
        'If a worker fails or reports blocked:\n' +
        '  1. Diagnose: maestro task get <taskId> — read error details\n' +
        '  2. Decide: Can the worker be unblocked with a directive, or does the task need re-spawning?\n' +
        '  3. Unblock: maestro mail send <sessionId> --type directive --subject "<guidance>" --message "<specific fix instructions>"\n' +
        '  4. Re-spawn if needed: maestro session spawn --task <taskId> --subject "<new approach>" --message "<revised instructions>" [--team-member-id <tmId>]\n' +
        '  5. If the issue is systemic, adjust remaining subtasks before proceeding.',
    },
    {
      name: 'verify',
      order: 6,
      instruction:
        'After workers finish, verify all subtask statuses:\n' +
        '  maestro task children <parentTaskId>\n' +
        'Ensure all are completed. Retry any failures or report blocked if unresolvable.',
    },
    {
      name: 'complete',
      order: 7,
      instruction:
        'When all subtasks are done:\n' +
        '  maestro task report complete <parentTaskId> "<summary>"\n' +
        '  maestro session report complete "<overall summary>"',
    },
  ],
};

const COORDINATE_BATCHING: WorkflowTemplate = {
  id: 'coordinate-batching',
  name: 'Coordinate Intelligent Batching',
  description: 'Batch orchestration: group independent tasks, execute batches in parallel.',
  mode: 'coordinate',
  strategy: 'intelligent-batching',
  builtIn: true,
  phases: [
    {
      name: 'analyze',
      order: 1,
      instruction:
        'Read all assigned tasks in the <tasks> block. ' +
        'Identify which pieces of work are independent vs dependent.',
    },
    {
      name: 'decompose',
      order: 2,
      instruction:
        'Break tasks into subtasks grouped into BATCHES (independent subtasks that can run in parallel). ' +
        'Order batches so later ones depend on earlier ones.\n' +
        '  maestro task create "<title>" -d "<description>" --parent <parentTaskId>',
    },
    {
      name: 'execute_batch',
      order: 3,
      instruction:
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
        '  4. Proceed to next batch only when current batch succeeds.',
    },
    {
      name: 'complete',
      order: 4,
      instruction:
        'When all batches succeeded:\n' +
        '  maestro task report complete <parentTaskId> "<summary>"\n' +
        '  maestro session report complete "<summary>"',
    },
  ],
};

const COORDINATE_DAG: WorkflowTemplate = {
  id: 'coordinate-dag',
  name: 'Coordinate DAG',
  description: 'DAG orchestration: model dependencies as a graph, execute in topological waves.',
  mode: 'coordinate',
  strategy: 'dag',
  builtIn: true,
  phases: [
    {
      name: 'analyze',
      order: 1,
      instruction:
        'Read all assigned tasks in the <tasks> block. ' +
        'Map out dependency relationships between the pieces of work.',
    },
    {
      name: 'build_dag',
      order: 2,
      instruction:
        'Decompose into subtasks with dependency edges (DAG):\n' +
        '  maestro task create "<title>" -d "<description. DEPENDS ON: <taskId1>, <taskId2>>" --parent <parentTaskId>\n' +
        'A subtask is READY when all dependencies are completed.',
    },
    {
      name: 'execute_wave',
      order: 3,
      instruction:
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
        '  5. Repeat until no tasks remain.',
    },
    {
      name: 'complete',
      order: 4,
      instruction:
        'When the full DAG is resolved:\n' +
        '  maestro task report complete <parentTaskId> "<summary>"\n' +
        '  maestro session report complete "<summary>"',
    },
  ],
};

const EXECUTE_RECRUIT: WorkflowTemplate = {
  id: 'execute-recruit',
  name: 'Execute Recruit',
  description: 'Recruiter workflow: analyze requirements, create team members.',
  mode: 'execute',
  strategy: 'recruit',
  builtIn: true,
  phases: [
    {
      name: 'analyze',
      order: 1,
      instruction:
        'Read your assigned tasks. Determine what team members are needed. ' +
        'Run `maestro team-member list` to check existing members.',
    },
    {
      name: 'recruit',
      order: 2,
      instruction:
        'Create team members:\n' +
        '  maestro team-member create "<name>" --role "<role>" --avatar "<emoji>" --mode <execute|coordinate> [--model <model>] [--agent-tool <tool>] [--identity "<instructions>"]\n\n' +
        'Create one at a time. Verify each before creating the next.',
    },
    {
      name: 'complete',
      order: 3,
      instruction:
        'When all team members are created:\n' +
        '  maestro session report complete "<summary with IDs, roles, and configurations>"',
    },
  ],
};

// ── Registry ────────────────────────────────────────────────────

const TEMPLATE_REGISTRY: WorkflowTemplate[] = [
  EXECUTE_SIMPLE,
  EXECUTE_TREE,
  EXECUTE_RECRUIT,
  COORDINATE_DEFAULT,
  COORDINATE_BATCHING,
  COORDINATE_DAG,
];

const TEMPLATE_MAP = new Map<string, WorkflowTemplate>(
  TEMPLATE_REGISTRY.map(t => [t.id, t])
);

/**
 * Get a workflow template by ID.
 */
export function getWorkflowTemplate(id: string): WorkflowTemplate | null {
  return TEMPLATE_MAP.get(id) ?? null;
}

/**
 * Get all workflow templates.
 */
export function getAllWorkflowTemplates(): WorkflowTemplate[] {
  return [...TEMPLATE_REGISTRY];
}

/**
 * Get workflow templates filtered by mode.
 */
export function getTemplatesForMode(mode: AgentMode): WorkflowTemplate[] {
  return TEMPLATE_REGISTRY.filter(t => t.mode === mode);
}

/**
 * Get the default template ID for a given mode+strategy combination.
 */
export function getDefaultTemplateId(mode: AgentMode, strategy: string): string {
  const template = TEMPLATE_REGISTRY.find(
    t => t.mode === mode && t.strategy === strategy
  );
  return template?.id ?? (mode === 'execute' ? 'execute-simple' : 'coordinate-default');
}
