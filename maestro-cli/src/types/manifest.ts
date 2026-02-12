/**
 * Complete manifest specification for Maestro sessions
 * Based on docs/final-maestro-cli-docs/01-MANIFEST-SCHEMA.md
 *
 * This file defines the TypeScript types for the Maestro manifest format.
 * The manifest is used to configure agent sessions with task context and settings.
 */

/** Worker strategy type */
export type WorkerStrategy = 'simple' | 'queue';

/** Orchestrator strategy type */
export type OrchestratorStrategy = 'default' | 'intelligent-batching' | 'dag';

/** Supported agent tools */
export type AgentTool = 'claude-code' | 'codex' | 'gemini';

/**
 * Main manifest interface - contains all configuration for a Maestro session
 */
export interface MaestroManifest {
  /** Manifest format version (currently "1.0") */
  manifestVersion: string;

  /** Role of the agent: worker (executes tasks) or orchestrator (manages workers) */
  role: 'worker' | 'orchestrator';

  /** Worker strategy: 'simple' (default) or 'queue' (FIFO task processing) */
  strategy?: WorkerStrategy;

  /** Orchestrator strategy: 'default', 'intelligent-batching', or 'dag' */
  orchestratorStrategy?: OrchestratorStrategy;

  /** Tasks information and context (array to support multi-task sessions) */
  tasks: TaskData[];

  /** Session configuration (model, permissions, etc.) */
  session: SessionConfig;

  /** Optional additional context for the agent */
  context?: AdditionalContext;

  /** Optional standard skills to load from ~/.skills/ */
  skills?: string[];

  /** Optional template ID to use for prompt generation (fetched from server) */
  templateId?: string;

  /** Agent tool to use for this session (defaults to 'claude-code') */
  agentTool?: AgentTool;

  /** Reference task IDs for context (docs from these tasks are provided to the agent) */
  referenceTaskIds?: string[];
}

/**
 * Unified task status (single source of truth)
 */
export type TaskStatus =
  | 'todo'          // Not yet started
  | 'in_progress'   // Actively being worked on
  | 'in_review'     // Awaiting review
  | 'completed'     // Work finished
  | 'cancelled'     // Cancelled
  | 'blocked';      // Blocked by dependency or issue

/**
 * Who triggered the status change
 */
export type UpdateSource = 'user' | 'session';

/**
 * Status update payload
 */
export interface StatusUpdate {
  status: TaskStatus;
  updateSource: UpdateSource;
  sessionId?: string;
  reason?: string;
}

/**
 * Task data (unified status model)
 */
export interface TaskData {
  // Core fields
  /** Unique task identifier */
  id: string;

  /** Human-readable task title */
  title: string;

  /** Detailed task description */
  description: string;

  /** Parent task ID (null for root tasks) */
  parentId?: string | null;

  /** List of acceptance criteria - clear success conditions */
  acceptanceCriteria: string[];

  /** List of task IDs this task depends on */
  dependencies?: string[];

  /** Task priority level */
  priority?: 'low' | 'medium' | 'high' | 'critical';

  /** Project this task belongs to */
  projectId: string;

  /** ISO 8601 timestamp when task was created */
  createdAt: string;

  /** Custom metadata (agent assignments, tags, etc.) */
  metadata?: Record<string, any>;

  /** Unified status (single source of truth). Optional in manifests. */
  status?: TaskStatus;

  // SESSION TRACKING
  /** Associated session IDs */
  sessionIds?: string[];

  /** Current active session ID */
  activeSessionId?: string;
}

/**
 * Session configuration for Claude Code
 */
export interface SessionConfig {
  /** Model to use (e.g. sonnet, opus, haiku, gpt-5.3-codex, gemini-3-pro-preview) */
  model: string;

  /** Permission mode for the session */
  permissionMode: 'acceptEdits' | 'interactive' | 'readOnly';

  /** Thinking mode configuration */
  thinkingMode?: 'auto' | 'interleaved' | 'disabled';

  /** Maximum number of agent turns before stopping */
  maxTurns?: number;

  /** Session timeout in milliseconds */
  timeout?: number;

  /** Working directory for the session (defaults to project root) */
  workingDirectory?: string;

  /**
   * Explicit list of allowed commands for this session.
   * If not specified, defaults are determined by role and strategy.
   * Format: 'command' or 'parent:subcommand' (e.g., 'task:list', 'queue:start')
   */
  allowedCommands?: string[];
}

/**
 * Additional context provided to the agent
 */
export interface AdditionalContext {
  /** Codebase-specific context */
  codebaseContext?: CodebaseContext;

  /** Related tasks and their relationships */
  relatedTasks?: RelatedTask[];

  /** Project standards and guidelines */
  projectStandards?: ProjectStandards;

  /** Custom context fields */
  custom?: Record<string, any>;
}

/**
 * Context about the codebase
 */
export interface CodebaseContext {
  /** Recent changes relevant to this task */
  recentChanges?: string[];

  /** Files relevant to this task */
  relevantFiles?: string[];

  /** Architecture pattern (e.g., "microservices", "monolithic") */
  architecture?: string;

  /** Technology stack */
  techStack?: string[];

  /** Key dependencies */
  dependencies?: Record<string, string>;
}

/**
 * Information about a related task
 */
export interface RelatedTask {
  /** Task ID */
  id: string;

  /** Task title */
  title: string;

  /** Relationship type */
  relationship: 'blocks' | 'blocked_by' | 'depends_on' | 'related_to';

  /** Current task status */
  status: string;

  /** Optional task description */
  description?: string;
}

/**
 * Project coding standards and guidelines
 */
export interface ProjectStandards {
  /** Coding style guide (e.g., "airbnb", "google") */
  codingStyle?: string;

  /** Testing approach (e.g., "TDD", "BDD") */
  testingApproach?: string;

  /** Documentation format (e.g., "JSDoc", "TypeDoc") */
  documentation?: string;

  /** Git branching strategy (e.g., "Git Flow", "Trunk Based") */
  branchingStrategy?: string;

  /** CI/CD pipeline description */
  cicdPipeline?: string;

  /** Custom project-specific guidelines */
  customGuidelines?: string[];
}

/**
 * Type guard to check if a manifest is for a worker
 */
export function isWorkerManifest(manifest: MaestroManifest): boolean {
  return manifest.role === 'worker';
}

/**
 * Type guard to check if a manifest is for an orchestrator
 */
export function isOrchestratorManifest(manifest: MaestroManifest): boolean {
  return manifest.role === 'orchestrator';
}
