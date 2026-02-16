import { Ordering } from '../../types';
import { IOrderingRepository } from '../../domain/repositories/IOrderingRepository';

/**
 * Service for managing entity ordering.
 * Keeps ordering separate from task/session models.
 */
export class OrderingService {
  constructor(
    private orderingRepo: IOrderingRepository
  ) {}

  async getOrdering(projectId: string, entityType: 'task' | 'session'): Promise<Ordering | null> {
    return this.orderingRepo.findByProjectAndType(projectId, entityType);
  }

  async saveOrdering(projectId: string, entityType: 'task' | 'session', orderedIds: string[]): Promise<Ordering> {
    return this.orderingRepo.save(projectId, entityType, orderedIds);
  }

  async deleteProjectOrderings(projectId: string): Promise<void> {
    return this.orderingRepo.deleteByProject(projectId);
  }
}
