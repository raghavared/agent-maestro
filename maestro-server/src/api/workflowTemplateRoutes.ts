import { Router, Request, Response } from 'express';
import type { AgentMode } from '../types';

/**
 * Workflow phase definition.
 */
interface WorkflowPhase {
  name: string;
  instruction: string;
}

/**
 * Workflow template definition.
 */
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  mode: AgentMode;
  phases: WorkflowPhase[];
  builtIn: boolean;
}

// ── Built-in templates (mirrors CLI workflow-templates.ts) ────

const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'execute-simple',
    name: 'Execute Simple',
    description: 'Single task execution: implement directly, report progress, complete.',
    mode: 'worker',
    builtIn: true,
    phases: [
      { name: 'execute', instruction: 'You have ONE task. Read it carefully, then implement it directly. Work through the requirements methodically — write code, run tests, fix issues. Do not decompose or delegate. You are the executor.' },
      { name: 'report', instruction: 'After each meaningful milestone (file created, test passing, feature working), report progress:\n  maestro session report progress "<what you just accomplished>"\nIf you hit a blocker you cannot resolve:\n  maestro session report blocked "<what is blocking and why>"' },
      { name: 'complete', instruction: 'When all acceptance criteria are met and the task is fully done:\n  maestro session report complete "<summary of what was delivered>"\nIf you produced important artifacts, add docs:\n  maestro session docs add "<title>" --file <path>' },
    ],
  },
  {
    id: 'execute-tree',
    name: 'Execute Tree',
    description: 'Tree-based execution: analyze task tree, plan order, execute leaf tasks.',
    mode: 'worker',
    builtIn: true,
    phases: [
      { name: 'analyze', instruction: 'Run `maestro task children <taskId> --recursive` to see the full task tree. Identify leaf tasks (no children) and check dependencies between them.' },
      { name: 'plan', instruction: 'Determine execution order: tasks with no unresolved dependencies go first. If a task depends on another, the dependency must complete before it starts. Group independent siblings that can be done in sequence.' },
      { name: 'execute', instruction: 'Work through tasks in the planned order. For each task:\n  1. Run `maestro task report progress <taskId> "Starting work"`\n  2. Implement it fully\n  3. Run `maestro task report complete <taskId> "<summary>"`\nThen move to the next task in order.' },
      { name: 'report', instruction: 'Report per-task progress as you go:\n  maestro task report progress <taskId> "<message>"\nReport session-level blockers:\n  maestro session report blocked "<reason>"' },
      { name: 'complete', instruction: 'Only when ALL subtasks in the tree are done:\n  maestro session report complete "<summary of all completed work>"' },
    ],
  },
  {
    id: 'coordinate-default',
    name: 'Coordinate Default',
    description: 'Standard orchestration: decompose, spawn workers, monitor, verify.',
    mode: 'coordinator',
    builtIn: true,
    phases: [
      { name: 'analyze', instruction: 'Your assigned task is in the <task> block above. Read the title, description, and acceptance criteria carefully. This is the task you must decompose and delegate — do NOT implement it yourself.' },
      { name: 'decompose', instruction: 'Break the task into small, testable subtasks. Each subtask should be independently completable by a single worker. For each subtask:\n  maestro task create "<title>" -d "<clear description with acceptance criteria>" --priority <high|medium|low> --parent <parentTaskId>\nSubtasks should be ordered so that dependencies are created first.' },
      { name: 'spawn', instruction: 'For each subtask, spawn a worker session:\n  maestro session spawn --task <subtaskId> [--team-member-id <tmId>] [--agent-tool <claude-code|codex|gemini>] [--model <model>]\nSpawn them ONE AT A TIME, sequentially. Wait for the spawn confirmation (session ID) before spawning the next. Collect all spawned session IDs.' },
      { name: 'monitor', instruction: 'Watch all spawned sessions until they complete:\n  maestro session watch <sessionId1>,<sessionId2>,...\nThis blocks and streams real-time status updates. It exits automatically when all watched sessions reach completed/failed/stopped.' },
      { name: 'verify', instruction: 'After all workers finish, verify results:\n  1. Run `maestro task children <parentTaskId>` to check all subtask statuses\n  2. If any failed, decide whether to retry (spawn again) or report blocked\n  3. If all succeeded, verify the parent task acceptance criteria are met' },
      { name: 'complete', instruction: 'When all subtasks are done and verified:\n  maestro task report complete <parentTaskId> "<summary>"\n  maestro session report complete "<overall summary>"' },
    ],
  },
  {
    id: 'coordinate-batching',
    name: 'Coordinate Intelligent Batching',
    description: 'Batch orchestration: group independent tasks, execute batches in parallel.',
    mode: 'coordinator',
    builtIn: true,
    phases: [
      { name: 'analyze', instruction: 'Your assigned task is in the <task> block above. Read it carefully. Identify the scope and figure out which pieces of work are independent vs dependent on each other.' },
      { name: 'decompose', instruction: 'Break the task into subtasks, then group them into BATCHES. A batch is a set of subtasks that have NO dependencies on each other and CAN run in parallel. Order batches so that later batches depend on earlier ones.\n\nExample: if task A and B are independent, but C depends on both → Batch 1: [A, B], Batch 2: [C].\n\nCreate all subtasks upfront:\n  maestro task create "<title>" -d "<description>" --parent <parentTaskId>' },
      { name: 'execute_batch', instruction: 'Process batches sequentially. For each batch:\n  1. Spawn ALL workers in the batch\n  2. Collect all session IDs from the batch\n  3. Watch the entire batch: maestro session watch <id1>,<id2>,<id3>\n  4. Wait for the watch to complete\n  5. Check results: `maestro task children <parentTaskId>`\n  6. Only proceed to the next batch when ALL tasks in this batch succeeded\n\nRepeat for each batch in order.' },
      { name: 'verify', instruction: 'After all batches complete, verify:\n  maestro task children <parentTaskId>\nEnsure every subtask is completed. Handle any failures.' },
      { name: 'complete', instruction: 'When all batches succeeded:\n  maestro task report complete <parentTaskId> "<summary>"\n  maestro session report complete "<summary with batch count and results>"' },
    ],
  },
  {
    id: 'coordinate-dag',
    name: 'Coordinate DAG',
    description: 'DAG orchestration: model dependencies as a graph, execute in topological waves.',
    mode: 'coordinator',
    builtIn: true,
    phases: [
      { name: 'analyze', instruction: 'Your assigned task is in the <task> block above. Read it carefully. Map out the work and identify dependency relationships between the pieces.' },
      { name: 'build_dag', instruction: 'Decompose the task into subtasks with explicit dependency edges, forming a directed acyclic graph (DAG).\n\nFor each subtask, create it and note which other subtasks it depends on:\n  maestro task create "<title>" -d "<description. DEPENDS ON: <taskId1>, <taskId2>>" --parent <parentTaskId>\n\nTrack the dependency graph yourself. A subtask is READY when all its dependencies are completed. Root nodes (no dependencies) are ready immediately.' },
      { name: 'execute_wave', instruction: 'Execute the DAG in waves (topological layers):\n\n  WAVE LOOP:\n  1. Identify all READY tasks (dependencies all completed, not yet spawned)\n  2. Spawn a worker for each ready task\n  3. Watch this wave: maestro session watch <id1>,<id2>,...\n  4. When the wave completes, check results\n  5. Mark completed tasks, unlock downstream tasks\n  6. Repeat — find newly ready tasks and spawn the next wave\n  8. Stop when no more tasks remain\n\nThis maximizes parallelism: independent branches of the DAG execute simultaneously.' },
      { name: 'verify', instruction: 'After all waves complete:\n  maestro task children <parentTaskId>\nEnsure every node in the DAG reached completed status.' },
      { name: 'complete', instruction: 'When the full DAG is resolved:\n  maestro task report complete <parentTaskId> "<summary>"\n  maestro session report complete "<summary with wave count and parallelism stats>"' },
    ],
  },
];

const TEMPLATE_MAP = new Map<string, WorkflowTemplate>(
  TEMPLATES.map(t => [t.id, t])
);

/**
 * Create workflow template routes.
 */
export function createWorkflowTemplateRoutes(): Router {
  const router = Router();

  // GET /api/workflow-templates - list all templates
  router.get('/', (req: Request, res: Response) => {
    const { mode } = req.query;

    let templates = TEMPLATES;
    if (mode && typeof mode === 'string') {
      // Support legacy mode names for filtering
      const normalizedMode = mode === 'execute' ? 'worker' : mode === 'coordinate' ? 'coordinator' : mode;
      templates = templates.filter(t => t.mode === normalizedMode);
    }

    res.json(templates);
  });

  // GET /api/workflow-templates/:id - get specific template
  router.get('/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const template = TEMPLATE_MAP.get(id);
    if (!template) {
      return res.status(404).json({ error: `Template '${id}' not found` });
    }
    res.json(template);
  });

  return router;
}
