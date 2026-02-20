import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ISkillLoader, Skill, SkillManifest } from '../../domain/services/ISkillLoader';
import { ClaudeCodeSkillLoader } from './ClaudeCodeSkillLoader';
import { ILogger } from '../../domain/common/ILogger';

interface ScopeConfig {
  dir: string;
  scope: 'project' | 'global';
  source: 'claude' | 'agents';
}

export interface SkillWithMeta extends Skill {
  meta: {
    scope: 'project' | 'global';
    source: 'claude' | 'agents';
    path: string;
  };
}

/**
 * Multi-scope skill loader that reads skills from multiple directories:
 * - Global: ~/.claude/skills/ and ~/.agents/skills/
 * - Project: <projectPath>/.claude/skills/ and <projectPath>/.agents/skills/
 *
 * Project-level skills override global skills with the same name.
 * Implements ISkillLoader for backwards compatibility and adds loadAllWithScope().
 */
export class MultiScopeSkillLoader implements ISkillLoader {
  private globalScopes: ScopeConfig[];
  private loaderCache: Map<string, ClaudeCodeSkillLoader> = new Map();

  constructor(private logger: ILogger) {
    const home = os.homedir();
    this.globalScopes = [
      { dir: path.join(home, '.claude', 'skills'), scope: 'global', source: 'claude' },
      { dir: path.join(home, '.agents', 'skills'), scope: 'global', source: 'agents' },
    ];
  }

  /**
   * Get or create a ClaudeCodeSkillLoader for a given directory.
   */
  private getLoader(dir: string): ClaudeCodeSkillLoader {
    let loader = this.loaderCache.get(dir);
    if (!loader) {
      loader = new ClaudeCodeSkillLoader(dir, this.logger);
      this.loaderCache.set(dir, loader);
    }
    return loader;
  }

  /**
   * Build the full list of scope configs, including project-level if projectPath is provided.
   */
  private buildScopes(projectPath?: string): ScopeConfig[] {
    const scopes: ScopeConfig[] = [...this.globalScopes];

    if (projectPath) {
      scopes.push(
        { dir: path.join(projectPath, '.claude', 'skills'), scope: 'project', source: 'claude' },
        { dir: path.join(projectPath, '.agents', 'skills'), scope: 'project', source: 'agents' },
      );
    }

    return scopes;
  }

  /**
   * Check if a directory exists.
   */
  private async dirExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Load all skills with scope/source metadata.
   * Project skills override global skills with the same name.
   */
  async loadAllWithScope(projectPath?: string): Promise<SkillWithMeta[]> {
    const scopes = this.buildScopes(projectPath);
    // Map from skill name to SkillWithMeta. Later entries (project) override earlier (global).
    const skillMap = new Map<string, SkillWithMeta>();

    for (const scopeConfig of scopes) {
      if (!(await this.dirExists(scopeConfig.dir))) {
        continue;
      }

      const loader = this.getLoader(scopeConfig.dir);
      const names = await loader.listAvailable();

      for (const name of names) {
        const skill = await loader.load(name);
        if (!skill) continue;

        const skillWithMeta: SkillWithMeta = {
          manifest: skill.manifest,
          instructions: skill.instructions,
          meta: {
            scope: scopeConfig.scope,
            source: scopeConfig.source,
            path: path.join(scopeConfig.dir, name),
          },
        };

        // Project-level skills override global; within same scope, later source overrides earlier
        skillMap.set(name, skillWithMeta);
      }
    }

    return Array.from(skillMap.values());
  }

  // ---- ISkillLoader interface (delegates to global loaders) ----

  async load(skillName: string): Promise<Skill | null> {
    // Search all global scopes
    for (const scopeConfig of this.globalScopes) {
      if (!(await this.dirExists(scopeConfig.dir))) continue;
      const loader = this.getLoader(scopeConfig.dir);
      const skill = await loader.load(skillName);
      if (skill) return skill;
    }
    return null;
  }

  async loadForMode(mode: string): Promise<Skill[]> {
    const isCoord = mode === 'coordinator' || mode === 'coordinated-coordinator' || mode === 'coordinate';
    const allSkills = await this.loadAllWithScope();
    return allSkills.filter(skill => {
      const skillRole = skill.manifest.config?.role;
      if (isCoord && skillRole === 'orchestrator') return true;
      if (!isCoord && skillRole !== 'orchestrator') return true;
      return false;
    });
  }

  async listAvailable(): Promise<string[]> {
    const nameSet = new Set<string>();
    for (const scopeConfig of this.globalScopes) {
      if (!(await this.dirExists(scopeConfig.dir))) continue;
      const loader = this.getLoader(scopeConfig.dir);
      const names = await loader.listAvailable();
      for (const name of names) {
        nameSet.add(name);
      }
    }
    return Array.from(nameSet).sort();
  }

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

  async reload(skillName: string): Promise<Skill | null> {
    // Clear from all cached loaders
    for (const loader of this.loaderCache.values()) {
      loader.clearCache();
    }
    return this.load(skillName);
  }

  formatForPrompt(skills: Skill[]): string {
    return skills
      .map(skill => {
        const header = `# ${skill.manifest.name} (v${skill.manifest.version})\n\n${skill.manifest.description}`;
        const content = skill.instructions ? `\n\n${skill.instructions}` : '';
        return `---\n${header}${content}`;
      })
      .join('\n\n');
  }
}
