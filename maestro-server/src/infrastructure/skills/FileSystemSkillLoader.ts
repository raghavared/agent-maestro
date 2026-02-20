import * as fs from 'fs/promises';
import * as path from 'path';
import { ISkillLoader, Skill, SkillManifest } from '../../domain/services/ISkillLoader';
import { ILogger } from '../../domain/common/ILogger';

/**
 * File system based implementation of ISkillLoader.
 * Loads skills from a directory with async operations.
 */
export class FileSystemSkillLoader implements ISkillLoader {
  private cache: Map<string, Skill> = new Map();

  constructor(
    private skillsDir: string,
    private logger: ILogger
  ) {}

  /**
   * Load a single skill by name.
   */
  async load(skillName: string): Promise<Skill | null> {
    // Check cache first
    if (this.cache.has(skillName)) {
      return this.cache.get(skillName)!;
    }

    const skillPath = path.join(this.skillsDir, skillName);

    try {
      // Check if skill directory exists
      await fs.access(skillPath);
    } catch {
      this.logger.warn(`Skill not found: ${skillName}`, { path: skillPath });
      return null;
    }

    try {
      const manifestPath = path.join(skillPath, 'manifest.json');
      const instructionsPath = path.join(skillPath, 'skill.md');

      // Check manifest exists
      try {
        await fs.access(manifestPath);
      } catch {
        this.logger.warn(`Manifest not found for skill: ${skillName}`);
        return null;
      }

      // Read manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent) as SkillManifest;

      // Read instructions (optional)
      let instructions = '';
      try {
        instructions = await fs.readFile(instructionsPath, 'utf-8');
      } catch {
        this.logger.debug(`No instructions file for skill: ${skillName}`);
      }

      const skill: Skill = { manifest, instructions };

      // Cache the skill
      this.cache.set(skillName, skill);

      return skill;
    } catch (err) {
      this.logger.error(`Failed to load skill ${skillName}:`, err as Error);
      return null;
    }
  }

  /**
   * Load all skills appropriate for a mode.
   */
  async loadForMode(mode: string): Promise<Skill[]> {
    const skills: Skill[] = [];

    // All sessions get maestro-cli
    const cliSkill = await this.load('maestro-cli');
    if (cliSkill) skills.push(cliSkill);

    // Add mode-specific skill
    const modeSkillName = mode === 'execute' ? 'maestro-worker' : 'maestro-orchestrator';
    const modeSkill = await this.load(modeSkillName);
    if (modeSkill) skills.push(modeSkill);

    return skills;
  }

  /**
   * List all available skill names.
   */
  async listAvailable(): Promise<string[]> {
    try {
      await fs.access(this.skillsDir);
    } catch {
      this.logger.warn(`Skills directory not found: ${this.skillsDir}`);
      return [];
    }

    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
      const skillDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

      // Filter to only directories with manifest.json
      const validSkills: string[] = [];
      for (const name of skillDirs) {
        const manifestPath = path.join(this.skillsDir, name, 'manifest.json');
        try {
          await fs.access(manifestPath);
          validSkills.push(name);
        } catch {
          // Skip directories without manifest
        }
      }

      return validSkills.sort();
    } catch (err) {
      this.logger.error('Failed to list skills:', err as Error);
      return [];
    }
  }

  /**
   * Validate that a skill's dependencies are available.
   */
  async validateDependencies(skill: Skill): Promise<boolean> {
    if (!skill.manifest.dependencies || skill.manifest.dependencies.length === 0) {
      return true;
    }

    for (const dep of skill.manifest.dependencies) {
      const depSkill = await this.load(dep);
      if (!depSkill) {
        this.logger.warn(`Missing dependency: ${skill.manifest.name} requires ${dep}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Reload a skill (clears cache and reloads).
   */
  async reload(skillName: string): Promise<Skill | null> {
    this.cache.delete(skillName);
    return this.load(skillName);
  }

  /**
   * Format skills for inclusion in a prompt/manifest.
   */
  formatForPrompt(skills: Skill[]): string {
    return skills
      .map(skill => {
        const header = `# ${skill.manifest.name} (v${skill.manifest.version})\n\n${skill.manifest.description}`;
        const content = skill.instructions ? `\n\n${skill.instructions}` : '';
        return `---\n${header}${content}`;
      })
      .join('\n\n');
  }

  /**
   * Clear the skill cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
