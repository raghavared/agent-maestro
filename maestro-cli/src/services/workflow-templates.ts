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
      name: 'execute',
      instruction:
        'Read your assigned tasks in the <tasks> block. Work through each task directly — do not decompose or delegate.\n' +
        'If a <reference_tasks> block is present, you MUST first fetch each reference task and its docs BEFORE starting work:\n' +
        '  1. maestro task get <refTaskId>  — read the reference task details\n' +
        '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
        'Reference task docs contain critical context, examples, or prior work. Read them thoroughly and apply their guidance to your tasks.\n' +
        'After completing each task (or major sub-step), check your mailbox for directives:\n' +
        '  maestro mail inbox\n' +
        'Mail types you may receive: "directive" (instructions to follow), "query" (questions to answer), "status" (informational).\n' +
        'If you receive a directive, prioritize it over current work. For queries, respond using:\n' +
        '  maestro mail reply <mailId> --message "<response>"\n' +
        'If no mail is present, continue with your tasks.',
    },
    {
      name: 'report',
      instruction:
        'After each meaningful milestone, report progress:\n' +
        '  maestro session report progress "<what you accomplished>"\n' +
        'If blocked: maestro session report blocked "<reason>"',
    },
    {
      name: 'complete',
      instruction:
        'When all tasks are done:\n' +
        '  maestro session report complete "<summary>"',
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
      instruction:
        'If a <reference_tasks> block is present, you MUST first fetch each reference task and its docs BEFORE starting work:\n' +
        '  1. maestro task get <refTaskId>  — read the reference task details\n' +
        '  2. maestro task docs list <refTaskId>  — list and read all attached docs\n' +
        'Reference task docs contain critical context, examples, or prior work. Read them thoroughly and apply their guidance to your tasks.\n' +
        'Run `maestro task children <taskId> --recursive` to see the full task tree. ' +
        'Identify leaf tasks and check dependencies.',
    },
    {
      name: 'plan',
      instruction:
        'Determine execution order: tasks with no unresolved dependencies go first. ' +
        'Group independent siblings for sequential execution.',
    },
    {
      name: 'execute',
      instruction:
        'Work through tasks in order. For each:\n' +
        '  1. maestro task report progress <taskId> "Starting"\n' +
        '  2. Complete it\n' +
        '  3. maestro task report complete <taskId> "<summary>"\n' +
        'After each task completion, check your mailbox for directives:\n' +
        '  maestro mail inbox\n' +
        'If you receive a directive, prioritize it. For queries, reply with:\n' +
        '  maestro mail reply <mailId> --message "<response>"',
    },
    {
      name: 'complete',
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
      instruction:
        'Read all assigned tasks in the <tasks> block. Understand the requirements and acceptance criteria. ' +
        'You must decompose and delegate — do NOT do them yourself.',
    },
    {
      name: 'decompose',
      instruction:
        'Break tasks into small subtasks, each completable by a single worker:\n' +
        '  maestro task create "<title>" -d "<description with acceptance criteria>" --priority <high|medium|low> --parent <parentTaskId>',
    },
    {
      name: 'spawn',
      instruction:
        'Spawn worker sessions for subtasks. IMPORTANT: Include an initial directive with each spawn using --subject and --message. ' +
        'This ensures workers receive instructions BEFORE they start working:\n' +
        '  maestro session spawn --task <subtaskId> --subject "<clear directive>" --message "<detailed instructions, context, and guidance>" [--team-member-id <tmId>] [--agent-tool <claude-code|codex|gemini>] [--model <model>]\n' +
        'You can spawn multiple workers in parallel — do NOT wait for each to finish before spawning the next.\n' +
        'Collect all session IDs for monitoring.',
    },
    {
      name: 'monitor',
      instruction:
        'Monitor workers by checking your mailbox and task statuses:\n' +
        '  maestro mail inbox\n' +
        '  maestro task children <parentTaskId>\n' +
        'If a worker is BLOCKED, investigate with `maestro task get <taskId>` and send directives:\n' +
        '  maestro mail send <sessionId> --type directive --subject "<subject>" --message "<instructions>"\n' +
        'Keep checking mail inbox periodically for status updates from workers.',
    },
    {
      name: 'recover',
      instruction:
        'If a worker fails or reports blocked:\n' +
        '  1. Check the error: maestro task get <taskId>\n' +
        '  2. Review session docs: maestro session docs list\n' +
        '  3. Either re-spawn the task with a different approach or reassign to another team member:\n' +
        '     maestro session spawn --task <taskId> --subject "<directive>" --message "<new instructions>" [--team-member-id <tmId>]\n' +
        '  4. If the issue is systemic, adjust remaining subtasks before proceeding.',
    },
    {
      name: 'verify',
      instruction:
        'After workers finish, check subtask statuses with `maestro task children <parentTaskId>`. ' +
        'Retry failures or report blocked.',
    },
    {
      name: 'complete',
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
      instruction:
        'Read all assigned tasks in the <tasks> block. ' +
        'Identify which pieces of work are independent vs dependent.',
    },
    {
      name: 'decompose',
      instruction:
        'Break tasks into subtasks grouped into BATCHES (independent subtasks that can run in parallel). ' +
        'Order batches so later ones depend on earlier ones.\n' +
        '  maestro task create "<title>" -d "<description>" --parent <parentTaskId>',
    },
    {
      name: 'execute_batch',
      instruction:
        'For each batch:\n' +
        '  1. Spawn all workers in the batch with initial directives (spawn them all, do not wait between spawns):\n' +
        '     maestro session spawn --task <subtaskId> --subject "<directive>" --message "<detailed instructions>" [--team-member-id <tmId>]\n' +
        '  2. Monitor via mail and task statuses:\n' +
        '     maestro mail inbox\n' +
        '     maestro task children <parentTaskId>\n' +
        '  3. If a worker fails, re-spawn or reassign before proceeding.\n' +
        '  4. Proceed to next batch only when current batch succeeds.',
    },
    {
      name: 'complete',
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
      instruction:
        'Read all assigned tasks in the <tasks> block. ' +
        'Map out dependency relationships between the pieces of work.',
    },
    {
      name: 'build_dag',
      instruction:
        'Decompose into subtasks with dependency edges (DAG):\n' +
        '  maestro task create "<title>" -d "<description. DEPENDS ON: <taskId1>, <taskId2>>" --parent <parentTaskId>\n' +
        'A subtask is READY when all dependencies are completed.',
    },
    {
      name: 'execute_wave',
      instruction:
        'Execute in waves:\n' +
        '  1. Find READY tasks → spawn all workers in parallel with initial directives (do not wait between spawns):\n' +
        '     maestro session spawn --task <subtaskId> --subject "<directive>" --message "<detailed instructions>"\n' +
        '  2. Monitor via mail and task statuses:\n' +
        '     maestro mail inbox\n' +
        '     maestro task children <parentTaskId>\n' +
        '  3. Send follow-up directives to workers as needed:\n' +
        '     maestro mail send <sessionId> --type directive --subject "<subject>" --message "<msg>"\n' +
        '  4. On completion, unlock downstream tasks\n' +
        '  5. If a worker fails, re-spawn or adjust the DAG before proceeding\n' +
        '  6. Repeat until no tasks remain.',
    },
    {
      name: 'complete',
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
      instruction:
        'Read your assigned tasks. Determine what team members are needed. ' +
        'Run `maestro team-member list` to check existing members.',
    },
    {
      name: 'recruit',
      instruction:
        'Create team members:\n' +
        '  maestro team-member create "<name>" --role "<role>" --avatar "<emoji>" --mode <execute|coordinate> [--model <model>] [--agent-tool <tool>] [--identity "<instructions>"]\n\n' +
        'Create one at a time. Verify each before creating the next.',
    },
    {
      name: 'complete',
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
