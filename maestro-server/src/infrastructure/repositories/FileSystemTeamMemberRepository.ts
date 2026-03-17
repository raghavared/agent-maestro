import * as fs from 'fs/promises';
import * as path from 'path';
import { TeamMember, AgentMode, TeamMemberScope } from '../../types';
import { ITeamMemberRepository } from '../../domain/repositories/ITeamMemberRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError, ForbiddenError } from '../../domain/common/Errors';
import { atomicWriteFile } from './utils/atomicWrite';

/**
 * Special project ID used to store global team members.
 * Global members are shared across all projects.
 */
export const GLOBAL_PROJECT_ID = '__global__';

/**
 * Default team member type identifiers.
 */
type DefaultTeamMemberType = 'simple_worker' | 'coordinator' | 'batch_coordinator' | 'dag_coordinator' | 'recruiter';

/**
 * Default Simple Worker team member configuration.
 */
const DEFAULT_SIMPLE_WORKER = {
  name: 'Simple Worker',
  role: 'Default executor',
  identity: 'You are a worker agent. You implement tasks directly — write code, run tests, fix bugs.',
  avatar: '⚡',
  model: 'sonnet',
  agentTool: 'claude-code' as const,
  mode: 'worker' as const,
  skillIds: [],
  isDefault: true,
  status: 'active' as const,
  capabilities: {
    can_spawn_sessions: false,
    can_edit_tasks: true,
    can_report_task_level: true,
    can_report_session_level: true,
  },
  workflowTemplateId: 'execute-simple',
};

/**
 * Default Coordinator team member configuration.
 */
const DEFAULT_COORDINATOR = {
  name: 'Coordinator',
  role: 'Task orchestrator',
  identity: 'You are a coordinator agent. You break down complex tasks, assign work to team members, and track progress.',
  avatar: '🎯',
  model: 'sonnet',
  agentTool: 'claude-code' as const,
  mode: 'coordinator' as const,
  skillIds: [],
  isDefault: true,
  status: 'active' as const,
  capabilities: {
    can_spawn_sessions: true,
    can_edit_tasks: true,
    can_report_task_level: true,
    can_report_session_level: true,
  },
  workflowTemplateId: 'coordinate-default',
};

/**
 * Default Batch Coordinator team member configuration.
 */
const DEFAULT_BATCH_COORDINATOR = {
  name: 'Batch Coordinator',
  role: 'Intelligent batch orchestrator',
  identity: 'You are a batch coordinator agent. You group related tasks into intelligent batches and coordinate their parallel execution.',
  avatar: '📦',
  model: 'sonnet',
  agentTool: 'claude-code' as const,
  mode: 'coordinator' as const,
  skillIds: [],
  isDefault: true,
  status: 'active' as const,
  capabilities: {
    can_spawn_sessions: true,
    can_edit_tasks: true,
    can_report_task_level: true,
    can_report_session_level: true,
  },
  workflowTemplateId: 'coordinate-batching',
};

/**
 * Default DAG Coordinator team member configuration.
 */
const DEFAULT_DAG_COORDINATOR = {
  name: 'DAG Coordinator',
  role: 'DAG-based orchestrator',
  identity: 'You are a DAG coordinator agent. You model task dependencies as a directed acyclic graph and execute them in optimal order.',
  avatar: '🔀',
  model: 'sonnet',
  agentTool: 'claude-code' as const,
  mode: 'coordinator' as const,
  skillIds: [],
  isDefault: true,
  status: 'active' as const,
  capabilities: {
    can_spawn_sessions: true,
    can_edit_tasks: true,
    can_report_task_level: true,
    can_report_session_level: true,
  },
  workflowTemplateId: 'coordinate-dag',
};

/**
 * Default Recruiter team member configuration.
 */
const DEFAULT_RECRUITER = {
  name: 'Recruiter',
  role: 'Team member recruiter with skill discovery',
  identity: 'You are a recruiter agent. You analyze task requirements, discover and install relevant skills from the ecosystem using the find-skills skill (npx skills find/add), and create team members using the `maestro team-member create` command. When creating a team member, choose the right --mode (worker for implementers, coordinator for orchestrators), write a clear --identity that describes the agent\'s purpose and expertise, assign relevant --skills, and pick an appropriate --avatar. Use `maestro team-member list` to see existing members and `maestro team-member get <id>` to inspect them before creating duplicates. You present a detailed recruitment plan for approval before creating any team members. You do NOT implement tasks or write code — your job is to build the right team with the right skills.',
  avatar: '🔍',
  model: 'sonnet',
  agentTool: 'claude-code' as const,
  mode: 'worker' as const,
  skillIds: ['find-skills'],
  isDefault: true,
  status: 'active' as const,
  capabilities: {
    can_spawn_sessions: false,
    can_edit_tasks: true,
    can_report_task_level: true,
    can_report_session_level: true,
  },
  commandPermissions: {
    commands: {
      'team-member:create': true,
      'team-member:list': true,
      'team-member:get': true,
      'team-member:edit': true,
    },
  },
  workflowTemplateId: 'execute-recruit',
};

interface DefaultTeamMemberConfig {
  name: string;
  role: string;
  identity: string;
  avatar: string;
  model: string;
  agentTool: 'claude-code';
  mode: AgentMode;
  skillIds: string[];
  isDefault: boolean;
  status: 'active';
  capabilities: {
    can_spawn_sessions: boolean;
    can_edit_tasks: boolean;
    can_report_task_level: boolean;
    can_report_session_level: boolean;
  };
  commandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };
  workflowTemplateId: string;
}

const DEFAULT_CONFIGS: Record<DefaultTeamMemberType, DefaultTeamMemberConfig> = {
  simple_worker: DEFAULT_SIMPLE_WORKER,
  coordinator: DEFAULT_COORDINATOR,
  batch_coordinator: DEFAULT_BATCH_COORDINATOR,
  dag_coordinator: DEFAULT_DAG_COORDINATOR,
  recruiter: DEFAULT_RECRUITER,
};

const ALL_DEFAULT_TYPES: DefaultTeamMemberType[] = [
  'simple_worker', 'coordinator', 'batch_coordinator', 'dag_coordinator', 'recruiter'
];

const DEFAULT_TYPE_SET: Set<string> = new Set(ALL_DEFAULT_TYPES.map(t => t));

/**
 * File system based implementation of ITeamMemberRepository.
 * Stores team members as individual JSON files.
 *
 * Storage layout:
 * {dataDir}/team-members/{projectId}/
 *   tm_{projectId}_worker.override.json      # Optional: user overrides for Worker default
 *   tm_{projectId}_coordinator.override.json # Optional: user overrides for Coordinator default
 *   tm_{timestamp}_{random}.json             # Custom team members
 */
export class FileSystemTeamMemberRepository implements ITeamMemberRepository {
  private teamMembersDir: string;
  private initialized: boolean = false;

  // Phase 1: In-memory caches
  private memberCache: Map<string, TeamMember> = new Map();
  private projectMemberIndex: Map<string, Set<string>> = new Map();
  private overrideCache: Map<string, Record<string, any>> = new Map();
  private projectsLoaded: Set<string> = new Set();
  private createdDirs: Set<string> = new Set();

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.teamMembersDir = path.join(dataDir, 'team-members');
  }

  /**
   * Initialize the repository by creating necessary directories.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.teamMembersDir, { recursive: true });
      this.createdDirs.add(this.teamMembersDir);
      this.logger.info('Team member repository initialized');
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize team member repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async ensureDir(dirPath: string): Promise<void> {
    if (this.createdDirs.has(dirPath)) return;
    await fs.mkdir(dirPath, { recursive: true });
    this.createdDirs.add(dirPath);
  }

  /**
   * Get the deterministic ID for a default team member.
   */
  private getDefaultId(projectId: string, type: DefaultTeamMemberType): string {
    return `tm_${projectId}_${type}`;
  }

  /**
   * Check if ID matches a default team member pattern and extract the type.
   */
  private getDefaultTypeFromId(projectId: string, id: string): DefaultTeamMemberType | null {
    for (const type of ALL_DEFAULT_TYPES) {
      if (id === this.getDefaultId(projectId, type)) return type;
    }
    return null;
  }

  /**
   * Get the project directory path.
   */
  private getProjectDir(projectId: string): string {
    return path.join(this.teamMembersDir, projectId);
  }

  /**
   * Get the override file path for a default team member.
   */
  private getOverridePath(projectId: string, defaultId: string): string {
    return path.join(this.getProjectDir(projectId), `${defaultId}.override.json`);
  }

  /**
   * Create a default team member with optional overrides applied.
   * Uses overrideCache to avoid repeated disk reads.
   */
  private async createDefaultTeamMember(
    projectId: string,
    type: DefaultTeamMemberType
  ): Promise<TeamMember> {
    const defaults = DEFAULT_CONFIGS[type];
    const id = this.getDefaultId(projectId, type);
    const now = new Date().toISOString();

    let teamMember: TeamMember = {
      id,
      projectId,
      ...defaults,
      createdAt: now,
      updatedAt: now,
    };

    // Check overrideCache first, then disk
    const cacheKey = `${projectId}:${id}`;
    if (this.overrideCache.has(cacheKey)) {
      const overrides = this.overrideCache.get(cacheKey)!;
      if (overrides !== null) {
        teamMember = {
          ...teamMember,
          ...overrides,
          id,
          projectId,
          isDefault: true,
        };
      }
    } else {
      try {
        const overridePath = this.getOverridePath(projectId, id);
        const overrideData = await fs.readFile(overridePath, 'utf-8');
        const overrides = JSON.parse(overrideData);
        this.overrideCache.set(cacheKey, overrides);

        teamMember = {
          ...teamMember,
          ...overrides,
          id,
          projectId,
          isDefault: true,
        };
      } catch (err) {
        // No overrides file — cache as null to avoid future disk reads
        this.overrideCache.set(cacheKey, null as any);
      }
    }

    return teamMember;
  }

  /**
   * Load all custom team members for a project.
   */
  private async loadCustomMembers(projectId: string): Promise<TeamMember[]> {
    const projectDir = this.getProjectDir(projectId);

    try {
      await this.ensureDir(projectDir);
      const files = await fs.readdir(projectDir);

      const memberFiles = files.filter(f =>
        f.endsWith('.json') && !f.includes('.override.')
      );

      const members: TeamMember[] = [];
      for (const file of memberFiles) {
        try {
          const data = await fs.readFile(path.join(projectDir, file), 'utf-8');
          const member = JSON.parse(data) as TeamMember;
          members.push(member);
        } catch (err) {
          this.logger.warn(`Failed to load team member file: ${file}`, {
            error: (err as Error).message
          });
        }
      }

      return members;
    } catch (err) {
      return [];
    }
  }

  /**
   * Load all members for a project into the cache (defaults + custom).
   */
  private async loadProjectMembers(projectId: string): Promise<void> {
    if (this.projectsLoaded.has(projectId)) return;

    const index = new Set<string>();

    // Load defaults
    for (const type of ALL_DEFAULT_TYPES) {
      const member = await this.createDefaultTeamMember(projectId, type);
      this.memberCache.set(member.id, member);
      index.add(member.id);
    }

    // Load custom members
    const customMembers = await this.loadCustomMembers(projectId);
    for (const member of customMembers) {
      this.memberCache.set(member.id, member);
      index.add(member.id);
    }

    this.projectMemberIndex.set(projectId, index);
    this.projectsLoaded.add(projectId);
  }

  /**
   * Load all global team members into the cache.
   * Global members are stored under the __global__ project directory.
   */
  private async loadGlobalMembers(): Promise<void> {
    if (this.projectsLoaded.has(GLOBAL_PROJECT_ID)) return;

    const globalDir = this.getProjectDir(GLOBAL_PROJECT_ID);
    const index = new Set<string>();

    try {
      await this.ensureDir(globalDir);
      const files = await fs.readdir(globalDir);
      const memberFiles = files.filter(f => f.endsWith('.json') && !f.includes('.override.'));

      for (const file of memberFiles) {
        try {
          const data = await fs.readFile(path.join(globalDir, file), 'utf-8');
          const member = JSON.parse(data) as TeamMember;
          this.memberCache.set(member.id, member);
          index.add(member.id);
        } catch (err) {
          this.logger.warn(`Failed to load global team member file: ${file}`, {
            error: (err as Error).message
          });
        }
      }
    } catch (err) {
      // No global directory yet - that's fine
    }

    this.projectMemberIndex.set(GLOBAL_PROJECT_ID, index);
    this.projectsLoaded.add(GLOBAL_PROJECT_ID);
  }

  async findById(projectId: string, id: string): Promise<TeamMember | null> {
    await this.ensureInitialized();

    // Check cache first
    const cached = this.memberCache.get(id);
    if (cached) return cached;

    // Check if it's a default member
    const defaultType = this.getDefaultTypeFromId(projectId, id);
    if (defaultType) {
      const member = await this.createDefaultTeamMember(projectId, defaultType);
      this.memberCache.set(member.id, member);
      // Add to project index
      if (!this.projectMemberIndex.has(projectId)) {
        this.projectMemberIndex.set(projectId, new Set());
      }
      this.projectMemberIndex.get(projectId)!.add(member.id);
      return member;
    }

    // Try to load custom member from disk (project dir first)
    try {
      const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const member = JSON.parse(data) as TeamMember;
      this.memberCache.set(member.id, member);
      if (!this.projectMemberIndex.has(projectId)) {
        this.projectMemberIndex.set(projectId, new Set());
      }
      this.projectMemberIndex.get(projectId)!.add(member.id);
      return member;
    } catch (err) {
      // Not found in project dir
    }

    // Try global directory if not already searching there
    if (projectId !== GLOBAL_PROJECT_ID) {
      try {
        const globalFilePath = path.join(this.getProjectDir(GLOBAL_PROJECT_ID), `${id}.json`);
        const data = await fs.readFile(globalFilePath, 'utf-8');
        const member = JSON.parse(data) as TeamMember;
        this.memberCache.set(member.id, member);
        if (!this.projectMemberIndex.has(GLOBAL_PROJECT_ID)) {
          this.projectMemberIndex.set(GLOBAL_PROJECT_ID, new Set());
        }
        this.projectMemberIndex.get(GLOBAL_PROJECT_ID)!.add(member.id);
        return member;
      } catch (err) {
        // Not found in global dir either
      }
    }

    return null;
  }

  async findByProjectId(projectId: string): Promise<TeamMember[]> {
    await this.ensureInitialized();

    // Load all members for this project if not already loaded
    await this.loadProjectMembers(projectId);

    const memberIds = this.projectMemberIndex.get(projectId);
    if (!memberIds) return [];

    const members: TeamMember[] = [];
    for (const id of memberIds) {
      const member = this.memberCache.get(id);
      if (member) members.push(member);
    }

    // Also load global members if this isn't already the global project
    if (projectId !== GLOBAL_PROJECT_ID) {
      await this.loadGlobalMembers();
      const globalIds = this.projectMemberIndex.get(GLOBAL_PROJECT_ID);
      if (globalIds) {
        for (const id of globalIds) {
          const member = this.memberCache.get(id);
          if (member) members.push(member);
        }
      }
    }

    return members;
  }

  async create(member: TeamMember): Promise<TeamMember> {
    await this.ensureInitialized();

    if (member.isDefault) {
      throw new ForbiddenError('Cannot create a default team member directly');
    }

    // Determine storage directory based on scope
    const storageProjectId = member.scope === 'global' ? GLOBAL_PROJECT_ID : member.projectId;
    const projectDir = this.getProjectDir(storageProjectId);
    await this.ensureDir(projectDir);

    const filePath = path.join(projectDir, `${member.id}.json`);
    await atomicWriteFile(filePath, JSON.stringify(member));

    // Update cache
    this.memberCache.set(member.id, member);
    if (!this.projectMemberIndex.has(storageProjectId)) {
      this.projectMemberIndex.set(storageProjectId, new Set());
    }
    this.projectMemberIndex.get(storageProjectId)!.add(member.id);

    this.logger.debug(`Created team member: ${member.id} (scope: ${member.scope || 'project'})`);
    return member;
  }

  async update(id: string, updates: Partial<TeamMember>): Promise<TeamMember> {
    await this.ensureInitialized();

    const projectId = updates.projectId;
    if (!projectId) {
      throw new Error('projectId is required for update');
    }

    const member = await this.findById(projectId, id);
    if (!member) {
      throw new NotFoundError('TeamMember', id);
    }

    if (member.isDefault) {
      await this.saveDefaultOverride(projectId, id, updates);
      // Rebuild the default member from config + updated overrides
      const defaultType = this.getDefaultTypeFromId(projectId, id);
      if (defaultType) {
        const updated = await this.createDefaultTeamMember(projectId, defaultType);
        this.memberCache.set(updated.id, updated);
        return updated;
      }
      return this.findById(projectId, id) as Promise<TeamMember>;
    }

    const updatedMember: TeamMember = {
      ...member,
      ...updates,
      id: member.id,
      projectId: member.projectId,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };

    // Determine storage directory based on scope
    const storageProjectId = updatedMember.scope === 'global' ? GLOBAL_PROJECT_ID : projectId;
    const filePath = path.join(this.getProjectDir(storageProjectId), `${id}.json`);

    // If scope changed, we may need to move the file
    const oldStorageProjectId = member.scope === 'global' ? GLOBAL_PROJECT_ID : member.projectId;
    if (oldStorageProjectId !== storageProjectId) {
      // Remove from old location
      try {
        const oldFilePath = path.join(this.getProjectDir(oldStorageProjectId), `${id}.json`);
        await fs.unlink(oldFilePath);
      } catch (err) {
        // Old file may not exist
      }
      // Remove from old index
      this.projectMemberIndex.get(oldStorageProjectId)?.delete(id);
      // Ensure new directory
      await this.ensureDir(this.getProjectDir(storageProjectId));
    }

    await atomicWriteFile(filePath, JSON.stringify(updatedMember));

    // Update cache and index
    this.memberCache.set(updatedMember.id, updatedMember);
    if (!this.projectMemberIndex.has(storageProjectId)) {
      this.projectMemberIndex.set(storageProjectId, new Set());
    }
    this.projectMemberIndex.get(storageProjectId)!.add(id);

    this.logger.debug(`Updated team member: ${id}`);
    return updatedMember;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    // Try cache first to find projectId without scanning all projects
    const cachedMember = this.memberCache.get(id);
    if (cachedMember) {
      if (cachedMember.isDefault) {
        throw new ForbiddenError('Cannot delete default team members');
      }

      // Determine storage directory based on scope
      const storageProjectId = cachedMember.scope === 'global' ? GLOBAL_PROJECT_ID : cachedMember.projectId;
      const filePath = path.join(this.getProjectDir(storageProjectId), `${id}.json`);
      await fs.unlink(filePath);

      // Remove from cache and index
      this.memberCache.delete(id);
      this.projectMemberIndex.get(storageProjectId)?.delete(id);

      this.logger.debug(`Deleted team member: ${id}`);
      return;
    }

    // Fallback: scan project directories including __global__ (rare — only if member was never accessed)
    const projects = await fs.readdir(this.teamMembersDir);

    let found = false;
    for (const projectId of projects) {
      const member = await this.findById(projectId, id);
      if (member) {
        if (member.isDefault) {
          throw new ForbiddenError('Cannot delete default team members');
        }

        const storageProjectId = member.scope === 'global' ? GLOBAL_PROJECT_ID : projectId;
        const filePath = path.join(this.getProjectDir(storageProjectId), `${id}.json`);
        await fs.unlink(filePath);

        // Remove from cache and index
        this.memberCache.delete(id);
        this.projectMemberIndex.get(storageProjectId)?.delete(id);

        this.logger.debug(`Deleted team member: ${id}`);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new NotFoundError('TeamMember', id);
    }
  }

  async saveDefaultOverride(
    projectId: string,
    defaultId: string,
    overrides: Partial<TeamMember>
  ): Promise<void> {
    await this.ensureInitialized();

    const projectDir = this.getProjectDir(projectId);
    await this.ensureDir(projectDir);

    const overridePath = this.getOverridePath(projectId, defaultId);
    const cacheKey = `${projectId}:${defaultId}`;

    // Load existing overrides from cache or disk
    let existingOverrides: Partial<TeamMember> = {};
    const cachedOverride = this.overrideCache.get(cacheKey);
    if (cachedOverride && cachedOverride !== null) {
      existingOverrides = cachedOverride;
    } else if (!this.overrideCache.has(cacheKey)) {
      try {
        const data = await fs.readFile(overridePath, 'utf-8');
        existingOverrides = JSON.parse(data);
      } catch (err) {
        // No existing overrides
      }
    }

    const mergedOverrides = {
      ...existingOverrides,
      ...overrides,
      updatedAt: new Date().toISOString(),
    };

    await atomicWriteFile(overridePath, JSON.stringify(mergedOverrides));

    // Update override cache
    this.overrideCache.set(cacheKey, mergedOverrides);
    this.logger.debug(`Saved override for default team member: ${defaultId}`);
  }

  async resetDefault(projectId: string, defaultId: string): Promise<void> {
    await this.ensureInitialized();

    const overridePath = this.getOverridePath(projectId, defaultId);
    const cacheKey = `${projectId}:${defaultId}`;

    try {
      await fs.unlink(overridePath);
      this.logger.debug(`Reset default team member: ${defaultId}`);
    } catch (err) {
      // File doesn't exist - already at defaults
    }

    // Clear override cache and regenerate default in member cache
    this.overrideCache.delete(cacheKey);
    const defaultType = this.getDefaultTypeFromId(projectId, defaultId);
    if (defaultType) {
      const member = await this.createDefaultTeamMember(projectId, defaultType);
      this.memberCache.set(member.id, member);
    }
  }
}
