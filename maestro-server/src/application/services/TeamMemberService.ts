import { TeamMember, TeamMemberSnapshot, CreateTeamMemberPayload, UpdateTeamMemberPayload } from '../../types';
import { ITeamMemberRepository } from '../../domain/repositories/ITeamMemberRepository';
import { IEventBus } from '../../domain/events/IEventBus';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ValidationError, NotFoundError, ForbiddenError, BusinessRuleError } from '../../domain/common/Errors';

/**
 * Application service for team member operations.
 * Manages team member lifecycle, validation, and events.
 */
export class TeamMemberService {
  constructor(
    private teamMemberRepo: ITeamMemberRepository,
    private eventBus: IEventBus,
    private idGenerator: IIdGenerator
  ) {}

  /**
   * Create a new custom team member.
   * Business rules:
   * - Generates ID with 'tm' prefix
   * - Sets isDefault: false
   * - Sets status: 'active'
   */
  async createTeamMember(data: CreateTeamMemberPayload): Promise<TeamMember> {
    // Validation
    if (!data.projectId) {
      throw new ValidationError('Project ID is required');
    }
    if (!data.name || data.name.trim() === '') {
      throw new ValidationError('Team member name is required');
    }
    if (!data.role || data.role.trim() === '') {
      throw new ValidationError('Team member role is required');
    }
    if (!data.avatar || data.avatar.trim() === '') {
      throw new ValidationError('Team member avatar is required');
    }

    const now = new Date().toISOString();
    const member: TeamMember = {
      id: this.idGenerator.generate('tm'),
      projectId: data.projectId,
      name: data.name.trim(),
      role: data.role.trim(),
      identity: data.identity ? data.identity.trim() : '',
      avatar: data.avatar.trim(),
      model: data.model,
      agentTool: data.agentTool,
      mode: data.mode,
      skillIds: data.skillIds || [],
      isDefault: false,
      status: 'active',
      ...(data.capabilities && { capabilities: data.capabilities }),
      ...(data.commandPermissions && { commandPermissions: data.commandPermissions }),
      ...(data.workflowTemplateId && { workflowTemplateId: data.workflowTemplateId }),
      ...(data.customWorkflow && { customWorkflow: data.customWorkflow }),
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.teamMemberRepo.create(member);
    await this.eventBus.emit('team_member:created', created);

    return created;
  }

  /**
   * Get a team member by ID.
   */
  async getTeamMember(projectId: string, id: string): Promise<TeamMember> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const member = await this.teamMemberRepo.findById(projectId, id);
    if (!member) {
      throw new NotFoundError('Team member', id);
    }
    return member;
  }

  /**
   * Get all team members for a project.
   * Returns defaults (with overrides applied) + custom members.
   */
  async getProjectTeamMembers(projectId: string): Promise<TeamMember[]> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    return this.teamMemberRepo.findByProjectId(projectId);
  }

  /**
   * Update a team member.
   * Business rules:
   * - For default members: delegates to saveDefaultOverride()
   * - For custom members: updates the main JSON file
   * - Emits team_member:updated event
   */
  async updateTeamMember(projectId: string, id: string, updates: UpdateTeamMemberPayload): Promise<TeamMember> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    // Validation
    if (updates.name !== undefined && updates.name.trim() === '') {
      throw new ValidationError('Team member name cannot be empty');
    }
    if (updates.role !== undefined && updates.role.trim() === '') {
      throw new ValidationError('Team member role cannot be empty');
    }
    if (updates.avatar !== undefined && updates.avatar.trim() === '') {
      throw new ValidationError('Team member avatar cannot be empty');
    }

    // Fetch current member to check if it's a default
    const current = await this.getTeamMember(projectId, id);

    // Prepare clean updates
    const cleanUpdates: Partial<TeamMember> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
    if (updates.role !== undefined) cleanUpdates.role = updates.role.trim();
    if (updates.identity !== undefined) cleanUpdates.identity = updates.identity.trim();
    if (updates.avatar !== undefined) cleanUpdates.avatar = updates.avatar.trim();
    if (updates.model !== undefined) cleanUpdates.model = updates.model;
    if (updates.agentTool !== undefined) cleanUpdates.agentTool = updates.agentTool;
    if (updates.mode !== undefined) cleanUpdates.mode = updates.mode;
    if (updates.skillIds !== undefined) cleanUpdates.skillIds = updates.skillIds;
    if (updates.status !== undefined) cleanUpdates.status = updates.status;
    if (updates.capabilities !== undefined) cleanUpdates.capabilities = updates.capabilities;
    if (updates.commandPermissions !== undefined) cleanUpdates.commandPermissions = updates.commandPermissions;
    if (updates.workflowTemplateId !== undefined) cleanUpdates.workflowTemplateId = updates.workflowTemplateId;
    if (updates.customWorkflow !== undefined) cleanUpdates.customWorkflow = updates.customWorkflow;

    // Update through repository (handles both defaults via override and custom via file)
    const updated = await this.teamMemberRepo.update(id, { ...cleanUpdates, projectId });
    await this.eventBus.emit('team_member:updated', updated);

    return updated;
  }

  /**
   * Delete a team member.
   * Business rules:
   * - Must check isDefault === false
   * - Must check status === 'archived'
   * - Throws ForbiddenError for default members
   * - Throws BusinessRuleError if not archived
   */
  async deleteTeamMember(projectId: string, id: string): Promise<void> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const member = await this.getTeamMember(projectId, id);

    // Check if it's a default member
    if (member.isDefault) {
      throw new ForbiddenError('Cannot delete default team members. You can customize them using the update endpoint.');
    }

    // Check if it's archived
    if (member.status !== 'archived') {
      throw new BusinessRuleError('Team member must be archived before deletion. Use the archive endpoint first.');
    }

    await this.teamMemberRepo.delete(id);
    await this.eventBus.emit('team_member:deleted', { id });
  }

  /**
   * Archive a team member.
   * Sets status to 'archived' and emits team_member:archived event.
   */
  async archiveTeamMember(projectId: string, id: string): Promise<TeamMember> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const member = await this.getTeamMember(projectId, id);

    // Check if it's a default member
    if (member.isDefault) {
      throw new ForbiddenError('Cannot archive default team members.');
    }

    if (member.status === 'archived') {
      // Already archived, just return it
      return member;
    }

    const updated = await this.teamMemberRepo.update(id, {
      status: 'archived',
      updatedAt: new Date().toISOString(),
    });

    await this.eventBus.emit('team_member:archived', updated);

    return updated;
  }

  /**
   * Unarchive a team member.
   * Sets status to 'active'.
   */
  async unarchiveTeamMember(projectId: string, id: string): Promise<TeamMember> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const member = await this.getTeamMember(projectId, id);

    // Check if it's a default member
    if (member.isDefault) {
      throw new ForbiddenError('Cannot unarchive default team members.');
    }

    if (member.status === 'active') {
      // Already active, just return it
      return member;
    }

    const updated = await this.teamMemberRepo.update(id, {
      status: 'active',
      updatedAt: new Date().toISOString(),
    });

    await this.eventBus.emit('team_member:updated', updated);

    return updated;
  }

  /**
   * Reset a default team member to code defaults.
   * Deletes the .override.json file.
   * Throws NotFoundError if not a default member.
   */
  async resetDefault(projectId: string, id: string): Promise<TeamMember> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const member = await this.getTeamMember(projectId, id);

    if (!member.isDefault) {
      throw new NotFoundError('Default team member', id);
    }

    await this.teamMemberRepo.resetDefault(projectId, id);

    // Fetch the reset member
    const reset = await this.getTeamMember(projectId, id);
    await this.eventBus.emit('team_member:updated', reset);

    return reset;
  }

  /**
   * Get a lightweight snapshot of a team member for session metadata.
   */
  async getTeamMemberSnapshot(projectId: string, id: string): Promise<TeamMemberSnapshot> {
    const member = await this.getTeamMember(projectId, id);

    return {
      name: member.name,
      avatar: member.avatar,
      role: member.role,
      model: member.model,
      agentTool: member.agentTool,
    };
  }
}
