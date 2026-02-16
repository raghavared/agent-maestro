// Canonical types matching maestro-server/src/types.ts
// plus UI-specific optional fields

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'blocked' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high';
export type MaestroSessionStatus = 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped';
export type SpawnSource = 'ui' | 'session';
export type TaskSessionStatus = 'queued' | 'working' | 'blocked' | 'completed' | 'failed' | 'skipped';
export type WorkerStrategy = 'simple' | 'queue';
export type OrchestratorStrategy = 'default' | 'intelligent-batching' | 'dag';
// Three-axis model
export type AgentMode = 'execute' | 'coordinate';
// Claude models
export type ClaudeModel = 'haiku' | 'sonnet' | 'opus';
// Codex models
export type CodexModel = 'gpt-5.3-codex' | 'gpt-5.2-codex';
// Gemini models
export type GeminiModel = 'gemini-3-pro-preview' | 'gemini-3-flash-preview';
// Union of all supported models
export type ModelType = ClaudeModel | CodexModel | GeminiModel;
export type AgentTool = 'claude-code' | 'codex' | 'gemini';

// Team Member types
export type TeamMemberStatus = 'active' | 'archived';

export interface TeamMember {
  id: string;
  projectId: string;
  name: string;
  role: string;
  identity: string;
  avatar: string;
  model?: ModelType;
  agentTool?: AgentTool;
  mode?: AgentMode;
  strategy?: string;
  skillIds?: string[];
  isDefault: boolean;
  status: TeamMemberStatus;

  // Phase 2: Capability overrides
  capabilities?: {
    can_spawn_sessions?: boolean;
    can_edit_tasks?: boolean;
    can_use_queue?: boolean;
    can_report_task_level?: boolean;
    can_report_session_level?: boolean;
  };

  // Phase 2: Command permission overrides
  commandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };

  // Phase 3: Workflow customization
  workflowTemplateId?: string;
  customWorkflow?: string;

  createdAt: string;
  updatedAt: string;
}

// Workflow template types (Phase 3)
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

export interface TeamMemberSnapshot {
  name: string;
  avatar: string;
  role: string;
  model?: string;
  agentTool?: AgentTool;
}

export interface CreateTeamMemberPayload {
  projectId: string;
  name: string;
  role: string;
  identity: string;
  avatar: string;
  model?: ModelType;
  agentTool?: AgentTool;
  mode?: AgentMode;
  strategy?: string;
  skillIds?: string[];
  capabilities?: TeamMember['capabilities'];
  commandPermissions?: TeamMember['commandPermissions'];
  workflowTemplateId?: string;
  customWorkflow?: string;
}

export interface UpdateTeamMemberPayload {
  name?: string;
  role?: string;
  identity?: string;
  avatar?: string;
  model?: ModelType;
  agentTool?: AgentTool;
  mode?: AgentMode;
  strategy?: string;
  skillIds?: string[];
  status?: TeamMemberStatus;
  capabilities?: TeamMember['capabilities'];
  commandPermissions?: TeamMember['commandPermissions'];
  workflowTemplateId?: string;
  customWorkflow?: string;
}

// Session timeline event types
export type SessionTimelineEventType =
  | 'session_started'    // Session spawned
  | 'session_stopped'    // Session stopped
  | 'task_started'       // Started working on a task
  | 'task_completed'     // Finished a task
  | 'task_failed'        // Failed a task
  | 'task_skipped'       // Skipped a task
  | 'task_blocked'       // Blocked on a task
  | 'needs_input'        // Waiting for user input
  | 'progress'           // General progress update
  | 'error'              // Error occurred
  | 'milestone'          // Milestone reached
  | 'doc_added';         // Document added




// Sound configuration types
export type InstrumentType = 'piano' | 'guitar' | 'violin' | 'trumpet' | 'drums';

export type SoundCategoryType =
  | 'success' | 'error' | 'critical_error' | 'warning' | 'attention'
  | 'action' | 'creation' | 'deletion' | 'update' | 'progress'
  | 'achievement' | 'neutral' | 'link' | 'unlink' | 'loading'
  | 'notify_task_completed' | 'notify_task_failed' | 'notify_task_blocked'
  | 'notify_task_session_completed' | 'notify_task_session_failed'
  | 'notify_session_completed' | 'notify_session_failed'
  | 'notify_needs_input' | 'notify_progress';

export interface ProjectSoundConfig {
  instrument: InstrumentType;
  enabledCategories?: SoundCategoryType[];
  categoryOverrides?: Record<string, {
    instrument?: InstrumentType;
    enabled?: boolean;
  }>;
  templateId?: string;
}

export interface SoundTemplate {
  id: string;
  name: string;
  builtIn: boolean;
  instrument: InstrumentType;
  enabledCategories: SoundCategoryType[];
  categoryOverrides?: Record<string, { instrument?: InstrumentType; enabled?: boolean }>;
}

export interface DocEntry {
  id: string;
  title: string;
  filePath: string;
  content?: string;
  taskId?: string;
  addedAt: number;
  addedBy?: string;
  sessionId?: string;
  sessionName?: string;
}

export interface MaestroProject {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // UI specific fields that might come from API or be computed
  basePath?: string | null;
  environmentId: string | null;
  assetsEnabled?: boolean;
  // Sound settings (legacy fields kept for backward compat migration)
  soundInstrument?: string;
  soundSettings?: {
    enabledCategories?: string[];
  };
  // New project-level sound config
  soundConfig?: ProjectSoundConfig;
}



export interface SessionTimelineEvent {
  id: string;
  type: SessionTimelineEventType;
  timestamp: number;
  message?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface MaestroSessionEvent {
  id: string;
  timestamp: number;
  type: string;
  data?: any;
}

export interface MaestroTask {
  // Core Identity
  id: string;
  projectId: string;
  parentId: string | null;

  // Content
  title: string;
  description: string;
  initialPrompt: string; // Standardized from 'prompt'

  // Status & Priority
  status: TaskStatus;
  priority: TaskPriority;
  taskSessionStatuses?: Record<string, TaskSessionStatus>;  // Per-session status map: { [sessionId]: status }

  // Timestamps
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;

  // Relationships
  sessionIds: string[];
  skillIds: string[];
  agentIds: string[];
  dependencies: string[];
  // NOTE: timeline moved to Session

  // Reference task IDs for context (docs from these tasks are provided to the agent)
  referenceTaskIds?: string[];

  // Model configuration
  model?: ModelType;

  // Agent tool configuration
  agentTool?: AgentTool;

  // Pinned tasks appear in the dedicated "Pinned" tab for quick re-execution
  pinned?: boolean;

  // Assigned team member for this task
  teamMemberId?: string;

  // UI/Populated Fields (Optional)
  subtasks?: MaestroTask[];
  sessionCount?: number; // UI computed field
  lastUpdate?: string | null; // UI computed field
}

// Subtask alias - in the new model, subtasks are just Tasks
export type MaestroSubtask = MaestroTask;

export interface MaestroSession {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  agentId?: string;
  env: Record<string, string>;
  strategy?: WorkerStrategy;
  orchestratorStrategy?: OrchestratorStrategy;
  status: MaestroSessionStatus;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  hostname: string;
  platform: string;
  events: MaestroSessionEvent[];
  timeline: SessionTimelineEvent[];  // Session's activity timeline
  needsInput?: {
    active: boolean;
    message?: string;
    since?: number;
  };
  mode?: AgentMode;
  spawnSource?: SpawnSource;
  spawnedBy?: string;
  manifestPath?: string;
  model?: ModelType;
  docs?: DocEntry[];
  teamMemberId?: string;
  teamMemberSnapshot?: TeamMemberSnapshot;
}

// Payloads
export interface CreateTaskPayload {
  projectId: string;
  parentId?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  initialPrompt?: string; // Standardized
  skillIds?: string[];
  referenceTaskIds?: string[];
  model?: ModelType;
  agentTool?: AgentTool;
  teamMemberId?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  sessionStatus?: TaskSessionStatus;  // Backward compat for session-source updates
  taskSessionStatuses?: Record<string, TaskSessionStatus>;  // Direct map update
  priority?: TaskPriority;
  initialPrompt?: string;
  sessionIds?: string[];
  skillIds?: string[];
  agentIds?: string[];
  referenceTaskIds?: string[];
  model?: ModelType;
  agentTool?: AgentTool;
  pinned?: boolean;
  teamMemberId?: string;
  // NOTE: timeline moved to Session - use addTimelineEvent on session
  completedAt?: number | null;
}

export interface CreateSessionPayload {
  id?: string;
  projectId: string;
  taskIds: string[];
  name?: string;
  agentId?: string;
}

export interface UpdateSessionPayload {
  taskIds?: string[];
  status?: MaestroSessionStatus;
  agentId?: string;
  events?: MaestroSessionEvent[];
  timeline?: SessionTimelineEvent[];
  completedAt?: number;
  needsInput?: {
    active: boolean;
    message?: string;
    since?: number;
  };
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'mode';
  version: string;
}

export interface ClaudeCodeSkill {
  id: string;
  name: string;
  description: string;
  triggers?: string[];
  role?: string;
  scope?: string;
  outputFormat?: string;
  version?: string;
  language?: string;
  framework?: string;
  tags?: string[];
  category?: string;
  license?: string;
  content: string;
  hasReferences: boolean;
  referenceCount: number;
}

export interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  mode?: AgentMode;                    // Three-axis model: 'execute' or 'coordinate'
  strategy?: string;                  // Unified strategy field
  spawnSource?: SpawnSource;          // 'ui' or 'session'
  sessionId?: string;                  // Required when spawnSource === 'session' (parent session ID)
  sessionName?: string;
  skills?: string[];
  context?: Record<string, any>;
  model?: ModelType;
  agentTool?: AgentTool;
  teamMemberId?: string;              // Team member running this session
  teamMemberIds?: string[];           // Team member task IDs to include in coordinate mode
}

export interface SpawnSessionResponse {
  success: boolean;
  sessionId: string;
  manifestPath: string;
  session: MaestroSession;
}

export type TaskTreeNode = MaestroTask & { children: TaskTreeNode[] };

// Ordering (separate from task/session models - UI ordering only)
export interface Ordering {
  projectId: string;
  entityType: 'task' | 'session';
  orderedIds: string[];
  updatedAt: number;
}

