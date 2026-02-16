import * as fs from 'fs/promises';
import * as path from 'path';
import { TeamMember, AgentMode } from '../../types';
import { ITeamMemberRepository } from '../../domain/repositories/ITeamMemberRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError, ForbiddenError } from '../../domain/common/Errors';

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
  mode: 'execute' as const,
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
  mode: 'coordinate' as const,
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
  mode: 'coordinate' as const,
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
  mode: 'coordinate' as const,
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
  role: 'Team member recruiter',
  identity: 'You are a recruiter agent. You analyze task requirements and create appropriately configured team members using maestro team-member commands. You do NOT implement tasks or write code — your job is to build the right team.',
  avatar: '🔍',
  model: 'sonnet',
  agentTool: 'claude-code' as const,
  mode: 'execute' as const,
  skillIds: [],
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

  /**
   * Get the deterministic ID for a default team member.
   */
  private getDefaultId(projectId: string, type: DefaultTeamMemberType): string {
    return `tm_${projectId}_${type}`;
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
   */
  private async createDefaultTeamMember(
    projectId: string,
    type: DefaultTeamMemberType
  ): Promise<TeamMember> {
    const defaults = DEFAULT_CONFIGS[type];
    const id = this.getDefaultId(projectId, type);
    const now = new Date().toISOString();

    // Start with code defaults
    let teamMember: TeamMember = {
      id,
      projectId,
      ...defaults,
      createdAt: now,
      updatedAt: now,
    };

    // Try to load overrides
    try {
      const overridePath = this.getOverridePath(projectId, id);
      const overrideData = await fs.readFile(overridePath, 'utf-8');
      const overrides = JSON.parse(overrideData);

      // Merge overrides while preserving isDefault
      teamMember = {
        ...teamMember,
        ...overrides,
        id,
        projectId,
        isDefault: true,
      };
    } catch (err) {
      // No overrides file or read error - use defaults
    }

    return teamMember;
  }

  /**
   * Load all custom team members for a project.
   */
  private async loadCustomMembers(projectId: string): Promise<TeamMember[]> {
    const projectDir = this.getProjectDir(projectId);

    try {
      await fs.mkdir(projectDir, { recursive: true });
      const files = await fs.readdir(projectDir);

      // Filter for custom member files (not .override.json)
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
      // Directory doesn't exist - return empty array
      return [];
    }
  }

  async findById(projectId: string, id: string): Promise<TeamMember | null> {
    await this.ensureInitialized();

    // Check if it's a default member
    for (const type of ALL_DEFAULT_TYPES) {
      if (id === this.getDefaultId(projectId, type)) {
        return this.createDefaultTeamMember(projectId, type);
      }
    }

    // Try to load custom member
    try {
      const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as TeamMember;
    } catch (err) {
      return null;
    }
  }

  async findByProjectId(projectId: string): Promise<TeamMember[]> {
    await this.ensureInitialized();

    // Start with all defaults
    const defaults: TeamMember[] = [];
    for (const type of ALL_DEFAULT_TYPES) {
      defaults.push(await this.createDefaultTeamMember(projectId, type));
    }

    // Load custom members
    const customMembers = await this.loadCustomMembers(projectId);

    return [...defaults, ...customMembers];
  }

  async create(member: TeamMember): Promise<TeamMember> {
    await this.ensureInitialized();

    if (member.isDefault) {
      throw new ForbiddenError('Cannot create a default team member directly');
    }

    const projectDir = this.getProjectDir(member.projectId);
    await fs.mkdir(projectDir, { recursive: true });

    const filePath = path.join(projectDir, `${member.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(member, null, 2));

    this.logger.debug(`Created team member: ${member.id}`);
    return member;
  }

  async update(id: string, updates: Partial<TeamMember>): Promise<TeamMember> {
    await this.ensureInitialized();

    // Determine project ID from updates or try to find the member
    const projectId = updates.projectId;
    if (!projectId) {
      throw new Error('projectId is required for update');
    }

    const member = await this.findById(projectId, id);
    if (!member) {
      throw new NotFoundError('TeamMember', id);
    }

    if (member.isDefault) {
      // For defaults, save to override file
      await this.saveDefaultOverride(projectId, id, updates);
      return this.findById(projectId, id) as Promise<TeamMember>;
    }

    // For custom members, update the main file
    const updatedMember: TeamMember = {
      ...member,
      ...updates,
      id: member.id,
      projectId: member.projectId,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(updatedMember, null, 2));

    this.logger.debug(`Updated team member: ${id}`);
    return updatedMember;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    // Need to find the member to check if it's default
    // Since we don't have projectId, we need to search all projects
    // For now, throw an error if we can't determine
    const projects = await fs.readdir(this.teamMembersDir);

    let found = false;
    for (const projectId of projects) {
      const member = await this.findById(projectId, id);
      if (member) {
        if (member.isDefault) {
          throw new ForbiddenError('Cannot delete default team members');
        }

        const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
        await fs.unlink(filePath);

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
    await fs.mkdir(projectDir, { recursive: true });

    const overridePath = this.getOverridePath(projectId, defaultId);

    // Load existing overrides if any
    let existingOverrides: Partial<TeamMember> = {};
    try {
      const data = await fs.readFile(overridePath, 'utf-8');
      existingOverrides = JSON.parse(data);
    } catch (err) {
      // No existing overrides
    }

    // Merge new overrides
    const mergedOverrides = {
      ...existingOverrides,
      ...overrides,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(overridePath, JSON.stringify(mergedOverrides, null, 2));
    this.logger.debug(`Saved override for default team member: ${defaultId}`);
  }

  async resetDefault(projectId: string, defaultId: string): Promise<void> {
    await this.ensureInitialized();

    const overridePath = this.getOverridePath(projectId, defaultId);

    try {
      await fs.unlink(overridePath);
      this.logger.debug(`Reset default team member: ${defaultId}`);
    } catch (err) {
      // File doesn't exist - already at defaults
    }
  }
}
