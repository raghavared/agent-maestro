import { QueueState, QueueItem } from '../../types';

/**
 * Repository interface for Queue persistence operations.
 */
export interface IQueueRepository {
  /**
   * Create a new queue for a session.
   * @param sessionId - Session ID
   * @param taskIds - Initial task IDs to add to queue
   * @returns The created queue state
   */
  create(sessionId: string, taskIds: string[]): Promise<QueueState>;

  /**
   * Find a queue by session ID.
   * @param sessionId - Session ID
   * @returns The queue state if found, null otherwise
   */
  findBySessionId(sessionId: string): Promise<QueueState | null>;

  /**
   * Update a queue.
   * @param sessionId - Session ID
   * @param updates - Partial queue updates
   * @returns The updated queue state
   */
  update(sessionId: string, updates: Partial<QueueState>): Promise<QueueState>;

  /**
   * Delete a queue.
   * @param sessionId - Session ID
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Add items to a queue.
   * @param sessionId - Session ID
   * @param taskIds - Task IDs to add
   * @returns The updated queue state
   */
  addItems(sessionId: string, taskIds: string[]): Promise<QueueState>;

  /**
   * Update a specific item in the queue.
   * @param sessionId - Session ID
   * @param taskId - Task ID of the item to update
   * @param updates - Updates to apply to the item
   * @returns The updated queue state
   */
  updateItem(sessionId: string, taskId: string, updates: Partial<QueueItem>): Promise<QueueState>;

  /**
   * Check if a queue exists for a session.
   * @param sessionId - Session ID
   * @returns true if queue exists
   */
  exists(sessionId: string): Promise<boolean>;
}
