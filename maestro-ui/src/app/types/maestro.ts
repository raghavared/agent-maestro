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

// Task type discriminator
export type TaskType = 'task' | 'team-member';

// Team member metadata (only present when taskType === 'team-member')
export interface TeamMemberMetadata {
  role: string;        // e.g. "frontend developer", "tester"
  identity: string;    // persona/instruction prompt
  avatar: string;      // emoji or icon identifier
  mailId: string;      // random generated mail ID for shared mailbox
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

  // Task type: 'task' (default) or 'team-member'
  taskType?: TaskType;

  // Team member metadata (only when taskType === 'team-member')
  teamMemberMetadata?: TeamMemberMetadata;

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
  taskType?: TaskType;
  teamMemberMetadata?: TeamMemberMetadata;
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
  taskType?: TaskType;
  teamMemberMetadata?: TeamMemberMetadata;
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

