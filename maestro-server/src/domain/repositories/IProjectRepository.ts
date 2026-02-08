import { Project } from '../../types';

/**
 * Input for creating a project (without generated fields).
 */
export type CreateProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Input for updating a project (partial, without immutable fields).
 */
export type UpdateProjectInput = Partial<Omit<Project, 'id' | 'createdAt'>>;

/**
 * Repository interface for Project persistence operations.
 * Implementations can be filesystem-based, database-backed, etc.
 */
export interface IProjectRepository {
  /**
   * Create a new project.
   * @param project - Project data without id and timestamps
   * @returns The created project with generated id and timestamps
   */
  create(project: CreateProjectInput): Promise<Project>;

  /**
   * Find a project by ID.
   * @param id - Project ID
   * @returns The project if found, null otherwise
   */
  findById(id: string): Promise<Project | null>;

  /**
   * Find all projects.
   * @returns Array of projects, empty if none found
   */
  findAll(): Promise<Project[]>;

  /**
   * Update an existing project.
   * @param id - Project ID
   * @param updates - Partial project updates
   * @returns The updated project
   * @throws {NotFoundError} if project not found
   */
  update(id: string, updates: UpdateProjectInput): Promise<Project>;

  /**
   * Delete a project.
   * @param id - Project ID
   * @throws {NotFoundError} if project not found
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a project has any related tasks.
   * Used to enforce cascading delete rules.
   * @param projectId - Project ID
   * @returns true if project has tasks
   */
  hasRelatedTasks(projectId: string): Promise<boolean>;

  /**
   * Check if a project has any related sessions.
   * Used to enforce cascading delete rules.
   * @param projectId - Project ID
   * @returns true if project has sessions
   */
  hasRelatedSessions(projectId: string): Promise<boolean>;

  /**
   * Count total projects.
   * @returns Number of projects
   */
  count(): Promise<number>;
}
