import * as fs from 'fs/promises';
import * as path from 'path';
import { QueueState, QueueItem } from '../../types';
import { IQueueRepository } from '../../domain/repositories/IQueueRepository';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

/**
 * File system based implementation of IQueueRepository.
 * Stores queues as individual JSON files.
 */
export class FileSystemQueueRepository implements IQueueRepository {
  private queuesDir: string;
  private queues: Map<string, QueueState>;
  private initialized: boolean = false;

  constructor(
    private dataDir: string,
    private logger: ILogger
  ) {
    this.queuesDir = path.join(dataDir, 'queues');
    this.queues = new Map();
  }

  /**
   * Initialize the repository by loading existing data.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.queuesDir, { recursive: true });

      const files = await fs.readdir(this.queuesDir);
      const queueFiles = files.filter(f => f.endsWith('.json'));

      for (const file of queueFiles) {
        try {
          const data = await fs.readFile(path.join(this.queuesDir, file), 'utf-8');
          const queue = JSON.parse(data) as QueueState;
          this.queues.set(queue.sessionId, queue);
        } catch (err) {
          this.logger.warn(`Failed to load queue file: ${file}`, { error: (err as Error).message });
        }
      }

      this.logger.info(`Loaded ${this.queues.size} queues`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize queue repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveQueue(queue: QueueState): Promise<void> {
    const filePath = path.join(this.queuesDir, `${queue.sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(queue, null, 2));
  }

  private async deleteQueueFile(sessionId: string): Promise<void> {
    const filePath = path.join(this.queuesDir, `${sessionId}.json`);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  }

  async create(sessionId: string, taskIds: string[]): Promise<QueueState> {
    await this.ensureInitialized();

    const now = Date.now();
    const items: QueueItem[] = taskIds.map(taskId => ({
      taskId,
      status: 'queued',
      addedAt: now,
    }));

    const queue: QueueState = {
      sessionId,
      strategy: 'queue',
      items,
      currentIndex: -1,
      createdAt: now,
      updatedAt: now,
    };

    this.queues.set(sessionId, queue);
    await this.saveQueue(queue);

    this.logger.debug(`Created queue for session: ${sessionId} with ${taskIds.length} items`);
    return queue;
  }

  async findBySessionId(sessionId: string): Promise<QueueState | null> {
    await this.ensureInitialized();
    return this.queues.get(sessionId) || null;
  }

  async update(sessionId: string, updates: Partial<QueueState>): Promise<QueueState> {
    await this.ensureInitialized();

    const queue = this.queues.get(sessionId);
    if (!queue) {
      throw new NotFoundError('Queue', sessionId);
    }

    // Apply updates
    if (updates.items !== undefined) queue.items = updates.items;
    if (updates.currentIndex !== undefined) queue.currentIndex = updates.currentIndex;

    queue.updatedAt = Date.now();

    this.queues.set(sessionId, queue);
    await this.saveQueue(queue);

    this.logger.debug(`Updated queue for session: ${sessionId}`);
    return queue;
  }

  async delete(sessionId: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.queues.has(sessionId)) {
      throw new NotFoundError('Queue', sessionId);
    }

    this.queues.delete(sessionId);
    await this.deleteQueueFile(sessionId);

    this.logger.debug(`Deleted queue for session: ${sessionId}`);
  }

  async addItems(sessionId: string, taskIds: string[]): Promise<QueueState> {
    await this.ensureInitialized();

    const queue = this.queues.get(sessionId);
    if (!queue) {
      throw new NotFoundError('Queue', sessionId);
    }

    const now = Date.now();
    const newItems: QueueItem[] = taskIds.map(taskId => ({
      taskId,
      status: 'queued',
      addedAt: now,
    }));

    queue.items.push(...newItems);
    queue.updatedAt = now;

    this.queues.set(sessionId, queue);
    await this.saveQueue(queue);

    this.logger.debug(`Added ${taskIds.length} items to queue: ${sessionId}`);
    return queue;
  }

  async updateItem(sessionId: string, taskId: string, updates: Partial<QueueItem>): Promise<QueueState> {
    await this.ensureInitialized();

    const queue = this.queues.get(sessionId);
    if (!queue) {
      throw new NotFoundError('Queue', sessionId);
    }

    const itemIndex = queue.items.findIndex(item => item.taskId === taskId);
    if (itemIndex === -1) {
      throw new NotFoundError('QueueItem', taskId);
    }

    // Apply updates to the item
    queue.items[itemIndex] = { ...queue.items[itemIndex], ...updates };
    queue.updatedAt = Date.now();

    this.queues.set(sessionId, queue);
    await this.saveQueue(queue);

    this.logger.debug(`Updated item ${taskId} in queue: ${sessionId}`);
    return queue;
  }

  async exists(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.queues.has(sessionId);
  }
}
