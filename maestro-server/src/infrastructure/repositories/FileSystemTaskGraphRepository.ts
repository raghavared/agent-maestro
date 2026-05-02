import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskGraph, CreateTaskGraphPayload, UpdateTaskGraphPayload } from '../../types';
import { ITaskGraphRepository, TaskGraphFilter } from '../../domain/repositories/ITaskGraphRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';
import { atomicWriteFile } from './utils/atomicWrite';
import { loadFilesParallel } from './utils/parallelFileLoader';

/**
 * File system based implementation of ITaskGraphRepository.
 * Stores task graphs as JSON files organized by project.
 */
export class FileSystemTaskGraphRepository implements ITaskGraphRepository {
  private graphsDir: string;
  private graphs: Map<string, TaskGraph>;
  private initialized: boolean = false;

  // Secondary indexes
  private projectIndex: Map<string, Set<string>> = new Map();
  private statusIndex: Map<string, Set<string>> = new Map();

  // ensureDir cache
  private createdDirs: Set<string> = new Set();

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.graphsDir = path.join(dataDir, 'task-graphs');
    this.graphs = new Map();
  }

  private async ensureDir(dirPath: string): Promise<void> {
    if (this.createdDirs.has(dirPath)) return;
    await fs.mkdir(dirPath, { recursive: true });
    this.createdDirs.add(dirPath);
  }

  // --- Secondary index helpers ---

  private indexGraph(graph: TaskGraph): void {
    if (!this.projectIndex.has(graph.projectId)) {
      this.projectIndex.set(graph.projectId, new Set());
    }
    this.projectIndex.get(graph.projectId)!.add(graph.id);

    if (!this.statusIndex.has(graph.status)) {
      this.statusIndex.set(graph.status, new Set());
    }
    this.statusIndex.get(graph.status)!.add(graph.id);
  }

  private unindexGraph(graph: TaskGraph): void {
    this.projectIndex.get(graph.projectId)?.delete(graph.id);
    if (this.projectIndex.get(graph.projectId)?.size === 0) {
      this.projectIndex.delete(graph.projectId);
    }
    this.statusIndex.get(graph.status)?.delete(graph.id);
    if (this.statusIndex.get(graph.status)?.size === 0) {
      this.statusIndex.delete(graph.status);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.ensureDir(this.graphsDir);

      const entries = await fs.readdir(this.graphsDir, { withFileTypes: true });

      const filePaths: string[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const projectDir = path.join(this.graphsDir, entry.name);
        this.createdDirs.add(projectDir);
        const graphFiles = await fs.readdir(projectDir);
        for (const file of graphFiles.filter(f => f.endsWith('.json'))) {
          filePaths.push(path.join(projectDir, file));
        }
      }

      const { successes, failures } = await loadFilesParallel(
        filePaths,
        async (filePath) => {
          const data = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(data) as TaskGraph;
        },
        { concurrency: 50 }
      );

      for (const failure of failures) {
        this.logger.warn(`Failed to load task graph file: ${failure.path}`, { error: failure.error.message });
      }

      for (const graph of successes) {
        if (!graph.nodes) graph.nodes = [];
        if (!graph.edges) graph.edges = [];
        this.graphs.set(graph.id, graph);
        this.indexGraph(graph);
      }

      this.logger.info(`Loaded ${this.graphs.size} task graphs`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize task graph repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveGraph(graph: TaskGraph): Promise<void> {
    const projectDir = path.join(this.graphsDir, graph.projectId);
    await this.ensureDir(projectDir);
    const filePath = path.join(projectDir, `${graph.id}.json`);
    await atomicWriteFile(filePath, JSON.stringify(graph));
  }

  private async deleteGraphFile(graph: TaskGraph): Promise<void> {
    const filePath = path.join(this.graphsDir, graph.projectId, `${graph.id}.json`);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async create(input: CreateTaskGraphPayload): Promise<TaskGraph> {
    await this.ensureInitialized();

    const graph: TaskGraph = {
      id: this.idGenerator.generate('task_graph'),
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      nodes: input.nodes ?? [],
      edges: input.edges ?? [],
      coordinatorTeamMemberId: input.coordinatorTeamMemberId,
      coordinatorModel: input.coordinatorModel,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.graphs.set(graph.id, graph);
    this.indexGraph(graph);
    await this.saveGraph(graph);

    this.logger.debug(`Created task graph: ${graph.id}`);
    return graph;
  }

  async findById(id: string): Promise<TaskGraph | null> {
    await this.ensureInitialized();
    return this.graphs.get(id) || null;
  }

  async findByProjectId(projectId: string): Promise<TaskGraph[]> {
    await this.ensureInitialized();
    const graphIds = this.projectIndex.get(projectId);
    if (!graphIds) return [];
    const results: TaskGraph[] = [];
    for (const id of graphIds) {
      const g = this.graphs.get(id);
      if (g) results.push(g);
    }
    return results;
  }

  async findAll(filter?: TaskGraphFilter): Promise<TaskGraph[]> {
    await this.ensureInitialized();

    if (filter?.projectId && filter?.status) {
      const projectIds = this.projectIndex.get(filter.projectId);
      const statusIds = this.statusIndex.get(filter.status);
      if (!projectIds || !statusIds) return [];
      const results: TaskGraph[] = [];
      for (const id of projectIds) {
        if (statusIds.has(id)) {
          const g = this.graphs.get(id);
          if (g) results.push(g);
        }
      }
      return results;
    }

    if (filter?.projectId) {
      return this.findByProjectId(filter.projectId);
    }

    if (filter?.status) {
      const statusIds = this.statusIndex.get(filter.status);
      if (!statusIds) return [];
      const results: TaskGraph[] = [];
      for (const id of statusIds) {
        const g = this.graphs.get(id);
        if (g) results.push(g);
      }
      return results;
    }

    return Array.from(this.graphs.values());
  }

  async update(id: string, updates: UpdateTaskGraphPayload): Promise<TaskGraph> {
    await this.ensureInitialized();

    const graph = this.graphs.get(id);
    if (!graph) {
      throw new NotFoundError('Task graph', id);
    }

    // Unindex old state
    this.unindexGraph(graph);

    if (updates.name !== undefined) graph.name = updates.name;
    if (updates.description !== undefined) graph.description = updates.description;
    if (updates.nodes !== undefined) graph.nodes = updates.nodes;
    if (updates.edges !== undefined) graph.edges = updates.edges;
    if (updates.coordinatorTeamMemberId !== undefined) graph.coordinatorTeamMemberId = updates.coordinatorTeamMemberId;
    if (updates.coordinatorModel !== undefined) graph.coordinatorModel = updates.coordinatorModel;
    if (updates.status !== undefined) graph.status = updates.status;
    if (updates.executionSessionId !== undefined) graph.executionSessionId = updates.executionSessionId;
    if (updates.lastRunAt !== undefined) graph.lastRunAt = updates.lastRunAt;

    graph.updatedAt = Date.now();

    this.graphs.set(id, graph);
    this.indexGraph(graph);
    await this.saveGraph(graph);

    this.logger.debug(`Updated task graph: ${id}`);
    return graph;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const graph = this.graphs.get(id);
    if (!graph) {
      throw new NotFoundError('Task graph', id);
    }

    this.unindexGraph(graph);
    this.graphs.delete(id);
    await this.deleteGraphFile(graph);

    this.logger.debug(`Deleted task graph: ${id}`);
  }

  async existsByProjectId(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    return (this.projectIndex.get(projectId)?.size ?? 0) > 0;
  }

  async count(): Promise<number> {
    await this.ensureInitialized();
    return this.graphs.size;
  }
}
