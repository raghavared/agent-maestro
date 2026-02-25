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

  async getOrdering(projectId: string, entityType: string): Promise<Ordering | null> {
    return this.orderingRepo.findByProjectAndType(projectId, entityType);
  }

  async saveOrdering(projectId: string, entityType: string, orderedIds: string[]): Promise<Ordering> {
    return this.orderingRepo.save(projectId, entityType, orderedIds);
  }

  async deleteProjectOrderings(projectId: string): Promise<void> {
    return this.orderingRepo.deleteByProject(projectId);
  }
}
