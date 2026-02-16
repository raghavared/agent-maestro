import * as fs from 'fs/promises';
import * as path from 'path';
import { Ordering } from '../../types';
import { IOrderingRepository } from '../../domain/repositories/IOrderingRepository';
import { ILogger } from '../../domain/common/ILogger';

/**
 * File system based implementation of IOrderingRepository.
 * Stores ordering as JSON files: {dataDir}/ordering/{entityType}/{projectId}.json
 */
export class FileSystemOrderingRepository implements IOrderingRepository {
  private orderingDir: string;
  private cache: Map<string, Ordering>;

  constructor(
    private dataDir: string,
    private logger: ILogger
  ) {
    this.orderingDir = path.join(dataDir, 'ordering');
    this.cache = new Map();
  }

  private cacheKey(projectId: string, entityType: 'task' | 'session'): string {
    return `${entityType}:${projectId}`;
  }

  private filePath(projectId: string, entityType: 'task' | 'session'): string {
    return path.join(this.orderingDir, entityType, `${projectId}.json`);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.orderingDir, 'task'), { recursive: true });
    await fs.mkdir(path.join(this.orderingDir, 'session'), { recursive: true });

    // Load all existing orderings into cache
    for (const entityType of ['task', 'session'] as const) {
      const dir = path.join(this.orderingDir, entityType);
      try {
        const files = await fs.readdir(dir);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          try {
            const content = await fs.readFile(path.join(dir, file), 'utf-8');
            const ordering: Ordering = JSON.parse(content);
            this.cache.set(this.cacheKey(ordering.projectId, entityType), ordering);
          } catch (err) {
            this.logger.warn(`Failed to load ordering file ${file}:`, err as any);
          }
        }
      } catch {
        // Directory may not exist yet
      }
    }

    this.logger.info(`Loaded ${this.cache.size} orderings`);
  }

  async findByProjectAndType(projectId: string, entityType: 'task' | 'session'): Promise<Ordering | null> {
    return this.cache.get(this.cacheKey(projectId, entityType)) ?? null;
  }

  async save(projectId: string, entityType: 'task' | 'session', orderedIds: string[]): Promise<Ordering> {
    const ordering: Ordering = {
      projectId,
      entityType,
      orderedIds,
      updatedAt: Date.now(),
    };

    const fp = this.filePath(projectId, entityType);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(ordering, null, 2), 'utf-8');

    this.cache.set(this.cacheKey(projectId, entityType), ordering);
    return ordering;
  }

  async deleteByProject(projectId: string): Promise<void> {
    for (const entityType of ['task', 'session'] as const) {
      const fp = this.filePath(projectId, entityType);
      try {
        await fs.unlink(fp);
      } catch {
        // File may not exist
      }
      this.cache.delete(this.cacheKey(projectId, entityType));
    }
  }
}
