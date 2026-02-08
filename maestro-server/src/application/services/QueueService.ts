import { QueueState, QueueItem } from '../../types';
import { IQueueRepository } from '../../domain/repositories/IQueueRepository';
import { ITaskRepository } from '../../domain/repositories/ITaskRepository';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IEventBus } from '../../domain/events/IEventBus';
import { ValidationError, NotFoundError } from '../../domain/common/Errors';

/**
 * Application service for queue operations.
 * Manages FIFO task processing for queue strategy sessions.
 */
export class QueueService {
  constructor(
    private queueRepo: IQueueRepository,
    private taskRepo: ITaskRepository,
    private sessionRepo: ISessionRepository,
    private eventBus: IEventBus
  ) {}

  /**
   * Initialize a queue for a session.
   */
  async initializeQueue(sessionId: string, taskIds: string[]): Promise<QueueState> {
    // Verify session exists
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    // Verify all tasks exist
    for (const taskId of taskIds) {
      const task = await this.taskRepo.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task', taskId);
      }
    }

    // Check if queue already exists
    const existingQueue = await this.queueRepo.findBySessionId(sessionId);
    if (existingQueue) {
      throw new ValidationError(`Queue already exists for session ${sessionId}`);
    }

    const queue = await this.queueRepo.create(sessionId, taskIds);

    await this.eventBus.emit('queue:created', { sessionId, queue });

    return queue;
  }

  /**
   * Get queue state for a session.
   */
  async getQueue(sessionId: string): Promise<QueueState> {
    const queue = await this.queueRepo.findBySessionId(sessionId);
    if (!queue) {
      throw new NotFoundError('Queue', sessionId);
    }
    return queue;
  }

  /**
   * Get the next item in the queue (peek without removing).
   */
  async getTopItem(sessionId: string): Promise<QueueItem | null> {
    const queue = await this.getQueue(sessionId);

    // Find next queued item
    const nextItem = queue.items.find(item => item.status === 'queued');
    return nextItem || null;
  }

  /**
   * Get the currently processing item.
   */
  async getCurrentItem(sessionId: string): Promise<QueueItem | null> {
    const queue = await this.getQueue(sessionId);

    if (queue.currentIndex < 0 || queue.currentIndex >= queue.items.length) {
      return null;
    }

    const item = queue.items[queue.currentIndex];
    return item.status === 'processing' ? item : null;
  }

  /**
   * Start processing the next item in the queue.
   */
  async startItem(sessionId: string): Promise<QueueItem> {
    const queue = await this.getQueue(sessionId);

    // Check if already processing
    const currentItem = await this.getCurrentItem(sessionId);
    if (currentItem) {
      throw new ValidationError(`Already processing task ${currentItem.taskId}. Complete or fail it first.`);
    }

    // Find next queued item
    const nextIndex = queue.items.findIndex(item => item.status === 'queued');
    if (nextIndex === -1) {
      throw new ValidationError('No items left in queue to process');
    }

    const now = Date.now();
    const item = queue.items[nextIndex];

    // Update item status
    await this.queueRepo.updateItem(sessionId, item.taskId, {
      status: 'processing',
      startedAt: now,
    });

    // Update current index
    await this.queueRepo.update(sessionId, { currentIndex: nextIndex });

    // Update task session status
    await this.taskRepo.update(item.taskId, {
      sessionStatus: 'working',
    });

    await this.eventBus.emit('queue:item_started', { sessionId, taskId: item.taskId });

    const updatedQueue = await this.getQueue(sessionId);
    return updatedQueue.items[nextIndex];
  }

  /**
   * Mark the current item as completed and advance.
   */
  async completeItem(sessionId: string): Promise<QueueItem> {
    const queue = await this.getQueue(sessionId);

    const currentItem = await this.getCurrentItem(sessionId);
    if (!currentItem) {
      throw new ValidationError('No item currently being processed. Run "start" first.');
    }

    const now = Date.now();

    // Update item status
    await this.queueRepo.updateItem(sessionId, currentItem.taskId, {
      status: 'completed',
      completedAt: now,
    });

    // Reset current index
    await this.queueRepo.update(sessionId, { currentIndex: -1 });

    // Update task session status
    await this.taskRepo.update(currentItem.taskId, {
      sessionStatus: 'completed',
    });

    await this.eventBus.emit('queue:item_completed', { sessionId, taskId: currentItem.taskId });

    const updatedQueue = await this.getQueue(sessionId);
    return updatedQueue.items.find(i => i.taskId === currentItem.taskId)!;
  }

  /**
   * Mark the current item as failed and advance.
   */
  async failItem(sessionId: string, reason?: string): Promise<QueueItem> {
    const queue = await this.getQueue(sessionId);

    const currentItem = await this.getCurrentItem(sessionId);
    if (!currentItem) {
      throw new ValidationError('No item currently being processed. Run "start" first.');
    }

    const now = Date.now();

    // Update item status
    await this.queueRepo.updateItem(sessionId, currentItem.taskId, {
      status: 'failed',
      completedAt: now,
      failReason: reason,
    });

    // Reset current index
    await this.queueRepo.update(sessionId, { currentIndex: -1 });

    // Update task session status
    await this.taskRepo.update(currentItem.taskId, {
      sessionStatus: 'failed',
    });

    await this.eventBus.emit('queue:item_failed', { sessionId, taskId: currentItem.taskId, reason });

    const updatedQueue = await this.getQueue(sessionId);
    return updatedQueue.items.find(i => i.taskId === currentItem.taskId)!;
  }

  /**
   * Skip the current/next item and advance.
   */
  async skipItem(sessionId: string): Promise<QueueItem> {
    const queue = await this.getQueue(sessionId);

    // If processing, skip current item
    const currentItem = await this.getCurrentItem(sessionId);
    if (currentItem) {
      const now = Date.now();

      await this.queueRepo.updateItem(sessionId, currentItem.taskId, {
        status: 'skipped',
        completedAt: now,
      });

      await this.queueRepo.update(sessionId, { currentIndex: -1 });

      await this.eventBus.emit('queue:item_skipped', { sessionId, taskId: currentItem.taskId });

      const updatedQueue = await this.getQueue(sessionId);
      return updatedQueue.items.find(i => i.taskId === currentItem.taskId)!;
    }

    // Otherwise, skip next queued item
    const nextItem = await this.getTopItem(sessionId);
    if (!nextItem) {
      throw new ValidationError('No items left in queue to skip');
    }

    const now = Date.now();

    await this.queueRepo.updateItem(sessionId, nextItem.taskId, {
      status: 'skipped',
      completedAt: now,
    });

    await this.eventBus.emit('queue:item_skipped', { sessionId, taskId: nextItem.taskId });

    const updatedQueue = await this.getQueue(sessionId);
    return updatedQueue.items.find(i => i.taskId === nextItem.taskId)!;
  }

  /**
   * Push a new task into an existing queue.
   */
  async pushItem(sessionId: string, taskId: string): Promise<QueueItem> {
    const queue = await this.getQueue(sessionId);

    // Verify task exists
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    // Check for duplicates
    if (queue.items.some(i => i.taskId === taskId)) {
      throw new ValidationError(`Task ${taskId} already in queue`);
    }

    // Use the repository's addItems method
    const updatedQueue = await this.queueRepo.addItems(sessionId, [taskId]);

    await this.eventBus.emit('queue:item_pushed', { sessionId, taskId });

    return updatedQueue.items.find(i => i.taskId === taskId)!;
  }

  /**
   * List all items in the queue.
   */
  async listItems(sessionId: string): Promise<QueueItem[]> {
    const queue = await this.getQueue(sessionId);
    return queue.items;
  }

  /**
   * Get queue statistics.
   */
  async getStats(sessionId: string): Promise<{
    total: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
  }> {
    const queue = await this.getQueue(sessionId);

    return {
      total: queue.items.length,
      queued: queue.items.filter(i => i.status === 'queued').length,
      processing: queue.items.filter(i => i.status === 'processing').length,
      completed: queue.items.filter(i => i.status === 'completed').length,
      failed: queue.items.filter(i => i.status === 'failed').length,
      skipped: queue.items.filter(i => i.status === 'skipped').length,
    };
  }

  /**
   * Check if a session has a queue.
   */
  async hasQueue(sessionId: string): Promise<boolean> {
    return this.queueRepo.exists(sessionId);
  }

  /**
   * Delete a queue.
   */
  async deleteQueue(sessionId: string): Promise<void> {
    await this.queueRepo.delete(sessionId);
    await this.eventBus.emit('queue:deleted', { sessionId });
  }
}
