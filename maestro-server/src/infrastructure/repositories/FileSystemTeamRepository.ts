import * as fs from 'fs/promises';
import * as path from 'path';
import { Team } from '../../types';
import { ITeamRepository } from '../../domain/repositories/ITeamRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';
import { atomicWriteFile } from './utils/atomicWrite';

/**
 * File system based implementation of ITeamRepository.
 * Stores teams as individual JSON files.
 *
 * Storage layout:
 * {dataDir}/teams/{projectId}/
 *   team_{timestamp}_{random}.json   # Individual team files
 */
export class FileSystemTeamRepository implements ITeamRepository {
  private teamsDir: string;
  private initialized: boolean = false;

  // Phase 1: In-memory caches
  private teamCache: Map<string, Team> = new Map();
  private projectTeamIndex: Map<string, Set<string>> = new Map();
  private projectsLoaded: Set<string> = new Set();
  private createdDirs: Set<string> = new Set();

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.teamsDir = path.join(dataDir, 'teams');
  }

  /**
   * Initialize the repository by creating necessary directories.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.teamsDir, { recursive: true });
      this.createdDirs.add(this.teamsDir);
      this.logger.info('Team repository initialized');
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize team repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async ensureDir(dirPath: string): Promise<void> {
    if (this.createdDirs.has(dirPath)) return;
    await fs.mkdir(dirPath, { recursive: true });
    this.createdDirs.add(dirPath);
  }

  /**
   * Get the project directory path.
   */
  private getProjectDir(projectId: string): string {
    return path.join(this.teamsDir, projectId);
  }

  /**
   * Load all teams for a project into cache.
   */
  private async loadTeams(projectId: string): Promise<Team[]> {
    const projectDir = this.getProjectDir(projectId);

    try {
      await this.ensureDir(projectDir);
      const files = await fs.readdir(projectDir);

      const teamFiles = files.filter(f => f.endsWith('.json'));

      const teams: Team[] = [];
      const index = this.projectTeamIndex.get(projectId) ?? new Set<string>();

      for (const file of teamFiles) {
        try {
          const data = await fs.readFile(path.join(projectDir, file), 'utf-8');
          const team = JSON.parse(data) as Team;
          teams.push(team);
          // Populate cache
          this.teamCache.set(team.id, team);
          index.add(team.id);
        } catch (err) {
          this.logger.warn(`Failed to load team file: ${file}`, {
            error: (err as Error).message
          });
        }
      }

      this.projectTeamIndex.set(projectId, index);
      this.projectsLoaded.add(projectId);

      return teams;
    } catch (err) {
      return [];
    }
  }

  async findById(projectId: string, id: string): Promise<Team | null> {
    await this.ensureInitialized();

    // Check cache first
    const cached = this.teamCache.get(id);
    if (cached) return cached;

    // Cache miss — load from disk
    try {
      const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const team = JSON.parse(data) as Team;

      // Populate cache
      this.teamCache.set(team.id, team);
      if (!this.projectTeamIndex.has(projectId)) {
        this.projectTeamIndex.set(projectId, new Set());
      }
      this.projectTeamIndex.get(projectId)!.add(team.id);

      return team;
    } catch (err) {
      return null;
    }
  }

  async findByProjectId(projectId: string): Promise<Team[]> {
    await this.ensureInitialized();

    // If project already loaded, serve from cache
    if (this.projectsLoaded.has(projectId)) {
      const teamIds = this.projectTeamIndex.get(projectId);
      if (!teamIds) return [];
      const teams: Team[] = [];
      for (const id of teamIds) {
        const team = this.teamCache.get(id);
        if (team) teams.push(team);
      }
      return teams;
    }

    return this.loadTeams(projectId);
  }

  async create(team: Team): Promise<Team> {
    await this.ensureInitialized();

    const projectDir = this.getProjectDir(team.projectId);
    await this.ensureDir(projectDir);

    const filePath = path.join(projectDir, `${team.id}.json`);
    await atomicWriteFile(filePath, JSON.stringify(team));

    // Update cache
    this.teamCache.set(team.id, team);
    if (!this.projectTeamIndex.has(team.projectId)) {
      this.projectTeamIndex.set(team.projectId, new Set());
    }
    this.projectTeamIndex.get(team.projectId)!.add(team.id);

    this.logger.debug(`Created team: ${team.id}`);
    return team;
  }

  async update(id: string, updates: Partial<Team>): Promise<Team> {
    await this.ensureInitialized();

    const projectId = updates.projectId;
    if (!projectId) {
      throw new Error('projectId is required for update');
    }

    const team = await this.findById(projectId, id);
    if (!team) {
      throw new NotFoundError('Team', id);
    }

    const updatedTeam: Team = {
      ...team,
      ...updates,
      id: team.id,
      projectId: team.projectId,
      updatedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
    await atomicWriteFile(filePath, JSON.stringify(updatedTeam));

    // Update cache
    this.teamCache.set(updatedTeam.id, updatedTeam);

    this.logger.debug(`Updated team: ${id}`);
    return updatedTeam;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    // Try cache first to find projectId without scanning all projects
    const cachedTeam = this.teamCache.get(id);
    if (cachedTeam) {
      const filePath = path.join(this.getProjectDir(cachedTeam.projectId), `${id}.json`);
      await fs.unlink(filePath);

      // Remove from cache and index
      this.teamCache.delete(id);
      this.projectTeamIndex.get(cachedTeam.projectId)?.delete(id);

      this.logger.debug(`Deleted team: ${id}`);
      return;
    }

    // Fallback: scan project directories
    const projects = await fs.readdir(this.teamsDir);

    let found = false;
    for (const projectId of projects) {
      const team = await this.findById(projectId, id);
      if (team) {
        const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
        await fs.unlink(filePath);

        this.teamCache.delete(id);
        this.projectTeamIndex.get(projectId)?.delete(id);

        this.logger.debug(`Deleted team: ${id}`);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new NotFoundError('Team', id);
    }
  }
}
