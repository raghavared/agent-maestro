import { Ordering } from '../../types';

/**
 * Repository interface for entity ordering persistence.
 * Maintains ordering of tasks and sessions separately from their models.
 */
export interface IOrderingRepository {
  /**
   * Get the ordering for a project and entity type.
   * @returns The ordering if found, null if no custom order set
   */
  findByProjectAndType(projectId: string, entityType: string): Promise<Ordering | null>;

  /**
   * Save or update the ordering for a project and entity type.
   */
  save(projectId: string, entityType: string, orderedIds: string[]): Promise<Ordering>;

  /**
   * Delete ordering for a project (e.g., when project is deleted).
   */
  deleteByProject(projectId: string): Promise<void>;

  /**
   * Initialize the repository.
   */
  initialize(): Promise<void>;
}
