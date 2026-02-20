import * as fs from 'fs/promises';
import * as path from 'path';
import { Team } from '../../types';
import { ITeamRepository } from '../../domain/repositories/ITeamRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

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

  /**
   * Get the project directory path.
   */
  private getProjectDir(projectId: string): string {
    return path.join(this.teamsDir, projectId);
  }

  /**
   * Load all teams for a project.
   */
  private async loadTeams(projectId: string): Promise<Team[]> {
    const projectDir = this.getProjectDir(projectId);

    try {
      await fs.mkdir(projectDir, { recursive: true });
      const files = await fs.readdir(projectDir);

      const teamFiles = files.filter(f => f.endsWith('.json'));

      const teams: Team[] = [];
      for (const file of teamFiles) {
        try {
          const data = await fs.readFile(path.join(projectDir, file), 'utf-8');
          const team = JSON.parse(data) as Team;
          teams.push(team);
        } catch (err) {
          this.logger.warn(`Failed to load team file: ${file}`, {
            error: (err as Error).message
          });
        }
      }

      return teams;
    } catch (err) {
      // Directory doesn't exist - return empty array
      return [];
    }
  }

  async findById(projectId: string, id: string): Promise<Team | null> {
    await this.ensureInitialized();

    try {
      const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as Team;
    } catch (err) {
      return null;
    }
  }

  async findByProjectId(projectId: string): Promise<Team[]> {
    await this.ensureInitialized();
    return this.loadTeams(projectId);
  }

  async create(team: Team): Promise<Team> {
    await this.ensureInitialized();

    const projectDir = this.getProjectDir(team.projectId);
    await fs.mkdir(projectDir, { recursive: true });

    const filePath = path.join(projectDir, `${team.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(team, null, 2));

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
    await fs.writeFile(filePath, JSON.stringify(updatedTeam, null, 2));

    this.logger.debug(`Updated team: ${id}`);
    return updatedTeam;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    // Search across all projects to find the team
    const projects = await fs.readdir(this.teamsDir);

    let found = false;
    for (const projectId of projects) {
      const team = await this.findById(projectId, id);
      if (team) {
        const filePath = path.join(this.getProjectDir(projectId), `${id}.json`);
        await fs.unlink(filePath);

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
