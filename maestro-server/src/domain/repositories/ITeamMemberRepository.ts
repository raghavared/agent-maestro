import { TeamMember, CreateTeamMemberPayload, UpdateTeamMemberPayload } from '../../types';

/**
 * Repository interface for TeamMember persistence operations.
 * Handles both default team members (Worker, Coordinator) and custom members.
 */
export interface ITeamMemberRepository {
  /**
   * Find a team member by ID within a project.
   * @param projectId - Project ID
   * @param id - Team member ID
   * @returns The team member if found, null otherwise
   */
  findById(projectId: string, id: string): Promise<TeamMember | null>;

  /**
   * Find all team members for a project.
   * Returns defaults (with overrides applied) + custom members.
   * @param projectId - Project ID
   * @returns Array of team members
   */
  findByProjectId(projectId: string): Promise<TeamMember[]>;

  /**
   * Create a new custom team member.
   * @param member - Team member data
   * @returns The created team member
   */
  create(member: TeamMember): Promise<TeamMember>;

  /**
   * Update a team member (default or custom).
   * For defaults: saves to .override.json
   * For custom: updates the main JSON file
   * @param id - Team member ID
   * @param updates - Partial team member updates
   * @returns The updated team member
   */
  update(id: string, updates: Partial<TeamMember>): Promise<TeamMember>;

  /**
   * Delete a team member.
   * Throws ForbiddenError if attempting to delete a default member.
   * @param id - Team member ID
   * @throws {ForbiddenError} if isDefault === true
   */
  delete(id: string): Promise<void>;

  /**
   * Save overrides for a default team member.
   * @param projectId - Project ID
   * @param defaultId - Default team member ID
   * @param overrides - Fields to override
   */
  saveDefaultOverride(projectId: string, defaultId: string, overrides: Partial<TeamMember>): Promise<void>;

  /**
   * Reset a default team member to code defaults.
   * Deletes the .override.json file.
   * @param projectId - Project ID
   * @param defaultId - Default team member ID
   */
  resetDefault(projectId: string, defaultId: string): Promise<void>;

  /**
   * Initialize the repository by loading existing data.
   */
  initialize(): Promise<void>;
}
