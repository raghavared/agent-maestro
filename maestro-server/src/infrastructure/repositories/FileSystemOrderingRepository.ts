import * as fs from 'fs/promises';
import * as path from 'path';
import { Ordering } from '../../types';
import { IOrderingRepository } from '../../domain/repositories/IOrderingRepository';
import { ILogger } from '../../domain/common/ILogger';
import { atomicWriteFile } from './utils/atomicWrite';
import { loadFilesParallel } from './utils/parallelFileLoader';

/**
 * File system based implementation of IOrderingRepository.
 * Stores ordering as JSON files: {dataDir}/ordering/{entityType}/{projectId}.json
 */
export class FileSystemOrderingRepository implements IOrderingRepository {
  private orderingDir: string;
  private cache: Map<string, Ordering>;
  private createdDirs: Set<string> = new Set();

  constructor(
    private dataDir: string,
    private logger: ILogger
  ) {
    this.orderingDir = path.join(dataDir, 'ordering');
    this.cache = new Map();
  }

  private async ensureDir(dirPath: string): Promise<void> {
    if (this.createdDirs.has(dirPath)) return;
    await fs.mkdir(dirPath, { recursive: true });
    this.createdDirs.add(dirPath);
  }

  private readonly KNOWN_ENTITY_TYPES = ['task', 'session', 'task-list'];

  private cacheKey(projectId: string, entityType: string): string {
    return `${entityType}:${projectId}`;
  }

  private filePath(projectId: string, entityType: string): string {
    return path.join(this.orderingDir, entityType, `${projectId}.json`);
  }

  async initialize(): Promise<void> {
    for (const entityType of this.KNOWN_ENTITY_TYPES) {
      const dir = path.join(this.orderingDir, entityType);
      await this.ensureDir(dir);
    }

    // Collect all file paths across entity types
    const fileEntries: { filePath: string; entityType: string }[] = [];
    for (const entityType of this.KNOWN_ENTITY_TYPES) {
      const dir = path.join(this.orderingDir, entityType);
      try {
        const files = await fs.readdir(dir);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          fileEntries.push({ filePath: path.join(dir, file), entityType });
        }
      } catch {
        // Directory may not exist yet
      }
    }

    // Load all in parallel
    const { successes, failures } = await loadFilesParallel(
      fileEntries.map(e => e.filePath),
      async (filePath) => {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as Ordering;
      },
      { concurrency: 50 }
    );

    for (const failure of failures) {
      this.logger.warn(`Failed to load ordering file ${failure.path}:`, failure.error);
    }

    for (let i = 0; i < successes.length; i++) {
      const ordering = successes[i];
      this.cache.set(this.cacheKey(ordering.projectId, ordering.entityType), ordering);
    }

    this.logger.info(`Loaded ${this.cache.size} orderings`);
  }

  async findByProjectAndType(projectId: string, entityType: string): Promise<Ordering | null> {
    return this.cache.get(this.cacheKey(projectId, entityType)) ?? null;
  }

  async save(projectId: string, entityType: string, orderedIds: string[]): Promise<Ordering> {
    const ordering: Ordering = {
      projectId,
      entityType,
      orderedIds,
      updatedAt: Date.now(),
    };

    const fp = this.filePath(projectId, entityType);
    await this.ensureDir(path.dirname(fp));
    await atomicWriteFile(fp, JSON.stringify(ordering));

    this.cache.set(this.cacheKey(projectId, entityType), ordering);
    return ordering;
  }

  async deleteByProject(projectId: string): Promise<void> {
    for (const entityType of this.KNOWN_ENTITY_TYPES) {
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
