/**
 * API response types for server data.
 * These represent the shape of data returned by the maestro-server API.
 */

export interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  parentId?: string | null;
  projectId?: string;
  teamMemberId?: string;
  teamMemberIds?: string[];
  taskSessionStatuses?: Record<string, string>;
  dependencies?: string[];
  acceptanceCriteria?: string[];
  technicalNotes?: string;
  estimatedComplexity?: string;
  createdAt?: string;
  children?: TaskResponse[];
  metadata?: Record<string, unknown>;
}

export interface SessionResponse {
  id: string;
  name: string;
  status: string;
  projectId?: string;
  taskIds?: string[];
  teamMemberId?: string;
  teamMemberSnapshot?: { name?: string };
  parentSessionId?: string;
  needsInput?: { active: boolean; message?: string; since?: number };
  timeline?: TimelineEntry[];
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface TimelineEntry {
  id?: string;
  type: string;
  timestamp: number;
  message?: string;
  taskId?: string;
}

export interface TeamResponse {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  leaderId?: string;
  memberIds?: string[];
  subTeamIds?: string[];
  status: string;
  projectId?: string;
}

export interface TeamMemberResponse {
  id: string;
  name: string;
  role: string;
  avatar: string;
  mode?: string;
  model?: string;
  agentTool?: string;
  permissionMode?: string;
  identity?: string;
  skillIds?: string[];
  capabilities?: Record<string, boolean>;
  commandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };
  memory?: string[];
  status: string;
  isDefault?: boolean;
  projectId?: string;
}

export interface DocResponse {
  id: string;
  title: string;
  filePath: string;
  content?: string;
  addedAt: string;
}

export interface SpawnResponse {
  sessionId: string;
  status?: string;
}

export interface LogDigestResponse {
  sessionId: string;
  state: string;
  workerName?: string;
  taskIds?: string[];
  lastActivityTimestamp?: number;
  stuck?: { warning: string; silentDurationMs: number };
  entries?: { timestamp: number; source: string; text: string }[];
}

