import { Team, CreateTeamPayload, UpdateTeamPayload } from '../../types';

/**
 * Repository interface for Team persistence operations.
 */
export interface ITeamRepository {
  /**
   * Find a team by ID within a project.
   * @param projectId - Project ID
   * @param id - Team ID
   * @returns The team if found, null otherwise
   */
  findById(projectId: string, id: string): Promise<Team | null>;

  /**
   * Find all teams for a project.
   * @param projectId - Project ID
   * @returns Array of teams
   */
  findByProjectId(projectId: string): Promise<Team[]>;

  /**
   * Create a new team.
   * @param team - Team data
   * @returns The created team
   */
  create(team: Team): Promise<Team>;

  /**
   * Update a team.
   * @param id - Team ID
   * @param updates - Partial team updates
   * @returns The updated team
   */
  update(id: string, updates: Partial<Team>): Promise<Team>;

  /**
   * Delete a team.
   * @param id - Team ID
   */
  delete(id: string): Promise<void>;

  /**
   * Initialize the repository by creating necessary directories.
   */
  initialize(): Promise<void>;
}
