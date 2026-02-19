/**
 * Complete manifest specification for Maestro sessions
 * Based on docs/final-maestro-cli-docs/01-MANIFEST-SCHEMA.md
 *
 * This file defines the TypeScript types for the Maestro manifest format.
 * The manifest is used to configure agent sessions with task context and settings.
 */

/** Worker strategy type */
export type WorkerStrategy = 'simple';

/** Orchestrator strategy type */
export type OrchestratorStrategy = 'default' | 'intelligent-batching' | 'dag';

/** Agent mode (three-axis model) — replaces role as the primary axis */
export type AgentMode = 'execute' | 'coordinate';

/** Capability flags derived from mode */
export type CapabilityName =
  | 'can_spawn_sessions'
  | 'can_edit_tasks'
  | 'can_report_task_level'
  | 'can_report_session_level';

/** Capability entry for prompt rendering */
export interface Capability {
  name: CapabilityName;
  enabled: boolean;
}

/** Supported agent tools */
export type AgentTool = 'claude-code' | 'codex' | 'gemini';

/**
 * Main manifest interface - contains all configuration for a Maestro session
 */
export interface MaestroManifest {
  /** Manifest format version (currently "1.0") */
  manifestVersion: string;

  /** Agent mode: execute (runs tasks) or coordinate (manages agents) */
  mode: AgentMode;

  /** Strategy for this session — execute modes use WorkerStrategy, coordinate modes use OrchestratorStrategy */
  strategy?: WorkerStrategy | OrchestratorStrategy;

  /** Tasks information and context (array to support multi-task sessions) */
  tasks: TaskData[];

  /** Session configuration (model, permissions, etc.) */
  session: SessionConfig;

  /** Optional additional context for the agent */
  context?: AdditionalContext;

  /** Optional standard skills to load from ~/.skills/ */
  skills?: string[];

  /** Agent tool to use for this session (defaults to 'claude-code') */
  agentTool?: AgentTool;

  /** Reference task IDs for context (docs from these tasks are provided to the agent) */
  referenceTaskIds?: string[];

  /** Team members available for coordination (only in coordinate mode) */
  teamMembers?: TeamMemberData[];

  /** Team member ID for this session (single team member running this session) */
  teamMemberId?: string;

  /** Team member name */
  teamMemberName?: string;

  /** Team member avatar */
  teamMemberAvatar?: string;

  /** Team member identity/instructions */
  teamMemberIdentity?: string;

  /** Team member persistent memory entries */
  teamMemberMemory?: string[];

  /** Team member capability overrides (Phase 2) */
  teamMemberCapabilities?: Record<string, boolean>;

  /** Team member command permission overrides (Phase 2) */
  teamMemberCommandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };

  /** Team member workflow template ID (Phase 3) */
  teamMemberWorkflowTemplateId?: string;

  /** Team member custom workflow text (Phase 3, when templateId === 'custom') */
  teamMemberCustomWorkflow?: string;

  /** Coordinator session ID (the session that spawned this worker) */
  coordinatorSessionId?: string;

  /** Initial directive from the coordinator (embedded in manifest for guaranteed delivery) */
  initialDirective?: {
    subject: string;
    message: string;
    fromSessionId: string;
  };

  /** Multiple team member profiles for multi-identity sessions */
  teamMemberProfiles?: TeamMemberProfile[];
}

/**
 * Team member profile for multi-identity sessions
 * Contains full member data for prompt rendering
 */
export interface TeamMemberProfile {
  id: string;
  name: string;
  avatar: string;
  identity: string;
  capabilities?: Record<string, boolean>;
  commandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };
  workflowTemplateId?: string;
  customWorkflow?: string;
  model?: string;
  agentTool?: AgentTool;
  memory?: string[];
}

/**
 * Team member data for manifest (used in coordinate mode prompts)
 */
export interface TeamMemberData {
  /** Team member task ID */
  id: string;
  /** Display name */
  name: string;
  /** Role description (e.g. "frontend developer", "tester") */
  role: string;
  /** Persona/instruction prompt */
  identity: string;
  /** Emoji or icon identifier */
  avatar: string;
  /** Skill IDs assigned to this member */
  skillIds?: string[];
  /** Preferred model */
  model?: string;
  /** Agent tool to use */
  agentTool?: AgentTool;
  /** Capability overrides from team member */
  capabilities?: Record<string, boolean>;
  /** Command permission overrides from team member */
  commandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };
  /** Persistent memory entries */
  memory?: string[];
}

/**
 * Capability overrides type (used when team member has custom capabilities)
 */
export type CapabilityOverrides = Partial<Record<CapabilityName, boolean>>;

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
  permissionMode: 'acceptEdits' | 'interactive' | 'readOnly' | 'bypassPermissions';

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
   * If not specified, defaults are determined by mode.
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
 * Type guard to check if a manifest is for an execute-mode agent
 */
export function isExecuteManifest(manifest: MaestroManifest): boolean {
  return manifest.mode === 'execute';
}

/**
 * Type guard to check if a manifest is for a coordinate-mode agent
 */
export function isCoordinateManifest(manifest: MaestroManifest): boolean {
  return manifest.mode === 'coordinate';
}

/**
 * Compute capabilities from mode, with optional overrides from team member.
 * If overrides are provided, they take precedence over the computed defaults.
 */
export function computeCapabilities(
  mode: AgentMode,
  overrides?: CapabilityOverrides
): Capability[] {
  const caps: Record<CapabilityName, boolean> = {
    can_spawn_sessions: mode === 'coordinate',
    can_edit_tasks: true,
    can_report_task_level: true,
    can_report_session_level: true,
  };

  // Apply overrides if provided
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (key in caps && typeof value === 'boolean') {
        caps[key as CapabilityName] = value;
      }
    }
  }

  return Object.entries(caps).map(([name, enabled]) => ({
    name: name as CapabilityName,
    enabled,
  }));
}
