/**
 * Workflow Templates Registry
 *
 * Built-in workflow templates extracted from prompt-builder.ts.
 * Each template defines the phases an agent follows for a given mode+strategy.
 */

import type { AgentMode } from '../types/manifest.js';
import {
  EXECUTE_INIT_PHASE,
  EXECUTE_WORK_PHASE,
  EXECUTE_COMPLETE_PHASE,
  EXECUTE_TREE_ANALYZE_PHASE,
  EXECUTE_TREE_PLAN_PHASE,
  EXECUTE_TREE_WORK_PHASE,
  EXECUTE_TREE_COMPLETE_PHASE,
  EXECUTE_RECRUIT_ANALYZE_PHASE,
  EXECUTE_RECRUIT_WORK_PHASE,
  EXECUTE_RECRUIT_COMPLETE_PHASE,
  COORDINATE_ANALYZE_PHASE,
  COORDINATE_DECOMPOSE_PHASE,
  COORDINATE_SPAWN_PHASE,
  COORDINATE_MONITOR_PHASE,
  COORDINATE_RECOVER_PHASE,
  COORDINATE_VERIFY_PHASE,
  COORDINATE_COMPLETE_PHASE,
  COORDINATE_BATCH_ANALYZE_PHASE,
  COORDINATE_BATCH_DECOMPOSE_PHASE,
  COORDINATE_BATCH_EXECUTE_PHASE,
  COORDINATE_BATCH_COMPLETE_PHASE,
  COORDINATE_DAG_ANALYZE_PHASE,
  COORDINATE_DAG_BUILD_PHASE,
  COORDINATE_DAG_EXECUTE_PHASE,
  COORDINATE_DAG_COMPLETE_PHASE,
} from '../prompts/index.js';

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
    { name: 'init', order: 1, instruction: EXECUTE_INIT_PHASE },
    { name: 'execute', order: 2, instruction: EXECUTE_WORK_PHASE },
    { name: 'complete', order: 3, instruction: EXECUTE_COMPLETE_PHASE },
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
    { name: 'analyze', order: 1, instruction: EXECUTE_TREE_ANALYZE_PHASE },
    { name: 'plan', order: 2, instruction: EXECUTE_TREE_PLAN_PHASE },
    { name: 'execute', order: 3, instruction: EXECUTE_TREE_WORK_PHASE },
    { name: 'complete', order: 4, instruction: EXECUTE_TREE_COMPLETE_PHASE },
  ],
};

const COORDINATE_DEFAULT: WorkflowTemplate = {
  id: 'coordinate-default',
  name: 'Coordinate Default',
  description: 'Standard orchestration: decompose, spawn workers with directives, monitor progress.',
  mode: 'coordinate',
  strategy: 'default',
  builtIn: true,
  phases: [
    { name: 'analyze', order: 1, instruction: COORDINATE_ANALYZE_PHASE },
    { name: 'decompose', order: 2, instruction: COORDINATE_DECOMPOSE_PHASE },
    { name: 'spawn', order: 3, instruction: COORDINATE_SPAWN_PHASE },
    { name: 'monitor', order: 4, instruction: COORDINATE_MONITOR_PHASE },
    { name: 'recover', order: 5, instruction: COORDINATE_RECOVER_PHASE },
    { name: 'verify', order: 6, instruction: COORDINATE_VERIFY_PHASE },
    { name: 'complete', order: 7, instruction: COORDINATE_COMPLETE_PHASE },
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
    { name: 'analyze', order: 1, instruction: COORDINATE_BATCH_ANALYZE_PHASE },
    { name: 'decompose', order: 2, instruction: COORDINATE_BATCH_DECOMPOSE_PHASE },
    { name: 'execute_batch', order: 3, instruction: COORDINATE_BATCH_EXECUTE_PHASE },
    { name: 'complete', order: 4, instruction: COORDINATE_BATCH_COMPLETE_PHASE },
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
    { name: 'analyze', order: 1, instruction: COORDINATE_DAG_ANALYZE_PHASE },
    { name: 'build_dag', order: 2, instruction: COORDINATE_DAG_BUILD_PHASE },
    { name: 'execute_wave', order: 3, instruction: COORDINATE_DAG_EXECUTE_PHASE },
    { name: 'complete', order: 4, instruction: COORDINATE_DAG_COMPLETE_PHASE },
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
    { name: 'analyze', order: 1, instruction: EXECUTE_RECRUIT_ANALYZE_PHASE },
    { name: 'recruit', order: 2, instruction: EXECUTE_RECRUIT_WORK_PHASE },
    { name: 'complete', order: 3, instruction: EXECUTE_RECRUIT_COMPLETE_PHASE },
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
