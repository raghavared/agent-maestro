import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Information about a discovered skill
 */
export interface SkillInfo {
  /** Name of the skill */
  name: string;
  /** Full path to the skill directory */
  path: string;
  /** Whether this is a valid skill (has SKILL.md or skill.md) */
  valid: boolean;
  /** Optional description extracted from SKILL.md */
  description?: string;
  /** Scope: project-level or global */
  scope: 'project' | 'global';
  /** Source: which skills directory tree */
  source: 'claude' | 'agents';
}

/**
 * Result of loading skills
 */
export interface SkillLoadResult {
  /** Array of successfully loaded skill paths */
  loaded: string[];
  /** Array of skill names that were not found */
  missing: string[];
  /** Array of skill directories that don't contain SKILL.md */
  invalid: string[];
}

/**
 * A directory to scan for skills, with associated metadata
 */
interface SkillDirectory {
  path: string;
  scope: 'project' | 'global';
  source: 'claude' | 'agents';
}

/**
 * Check if a skill directory has a valid skill file (SKILL.md or skill.md).
 * Returns the path to the skill file if found, null otherwise.
 */
function findSkillFile(skillPath: string): string | null {
  const uppercase = join(skillPath, 'SKILL.md');
  if (existsSync(uppercase)) return uppercase;
  const lowercase = join(skillPath, 'skill.md');
  if (existsSync(lowercase)) return lowercase;
  return null;
}

/**
 * Extract the first non-heading, non-empty line as a description from a skill file.
 */
async function extractDescription(skillFilePath: string): Promise<string | undefined> {
  try {
    const content = await readFile(skillFilePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        return trimmed.length > 120 ? trimmed.slice(0, 117) + '...' : trimmed;
      }
    }
  } catch {
    // ignore read errors
  }
  return undefined;
}

/**
 * SkillLoader - Manages discovery and loading of Claude Code and Agent skills
 *
 * Skills can be stored in multiple directories:
 * - ~/.claude/skills/       (global, claude)
 * - ~/.agents/skills/       (global, agents)
 * - <project>/.claude/skills/  (project, claude)
 * - <project>/.agents/skills/  (project, agents)
 *
 * Each skill lives in its own subdirectory containing a SKILL.md (preferred)
 * or skill.md (backwards compat) file.
 *
 * Project-scoped skills override global skills with the same name.
 */
export class SkillLoader {
  private projectPath?: string;
  private directories: SkillDirectory[];

  /**
   * Create a new SkillLoader
   *
   * @param projectPath - Optional project root for project-scoped skills
   */
  constructor(projectPath?: string) {
    this.projectPath = projectPath;
    this.directories = this.buildDirectories();
  }

  private buildDirectories(): SkillDirectory[] {
    const home = homedir();
    const dirs: SkillDirectory[] = [
      { path: join(home, '.claude', 'skills'), scope: 'global', source: 'claude' },
      { path: join(home, '.agents', 'skills'), scope: 'global', source: 'agents' },
    ];

    if (this.projectPath) {
      dirs.push(
        { path: join(this.projectPath, '.claude', 'skills'), scope: 'project', source: 'claude' },
        { path: join(this.projectPath, '.agents', 'skills'), scope: 'project', source: 'agents' },
      );
    }

    return dirs;
  }

  /**
   * Discover all available skills across all configured directories.
   *
   * Project skills override global skills with the same name.
   * Returns empty array if no skills directories exist.
   */
  async discover(): Promise<SkillInfo[]> {
    const skillMap = new Map<string, SkillInfo>();

    for (const dir of this.directories) {
      const skills = await this.scanDirectory(dir);
      for (const skill of skills) {
        const existing = skillMap.get(skill.name);
        // Project scope overrides global scope
        if (!existing || (skill.scope === 'project' && existing.scope === 'global')) {
          skillMap.set(skill.name, skill);
        }
      }
    }

    // Sort: project first, then global; alphabetical within each group
    return Array.from(skillMap.values()).sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'project' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Discover all skills without deduplication (useful for validation).
   */
  async discoverAll(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];
    for (const dir of this.directories) {
      skills.push(...await this.scanDirectory(dir));
    }
    return skills;
  }

  private async scanDirectory(dir: SkillDirectory): Promise<SkillInfo[]> {
    try {
      if (!existsSync(dir.path)) return [];

      const entries = await readdir(dir.path, { withFileTypes: true });
      const skills: SkillInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(dir.path, entry.name);
        const skillFile = findSkillFile(skillPath);
        const valid = skillFile !== null;
        const description = skillFile ? await extractDescription(skillFile) : undefined;

        skills.push({
          name: entry.name,
          path: skillPath,
          valid,
          description,
          scope: dir.scope,
          source: dir.source,
        });
      }

      return skills;
    } catch {
      return [];
    }
  }

  /**
   * Load specific skills and categorize results.
   * Searches all directories; project scope takes priority.
   */
  async load(skillNames: string[]): Promise<SkillLoadResult> {
    const result: SkillLoadResult = {
      loaded: [],
      missing: [],
      invalid: [],
    };

    const allSkills = await this.discover();
    const skillsByName = new Map(allSkills.map(s => [s.name, s]));

    for (const skillName of skillNames) {
      const skill = skillsByName.get(skillName);
      if (!skill) {
        result.missing.push(skillName);
      } else if (!skill.valid) {
        result.invalid.push(skillName);
      } else {
        result.loaded.push(skill.path);
      }
    }

    return result;
  }

  /**
   * Get information about a specific skill.
   * Searches all directories; project scope takes priority.
   */
  async getSkillInfo(skillName: string): Promise<SkillInfo | null> {
    const allSkills = await this.discover();
    return allSkills.find(s => s.name === skillName) || null;
  }

  /**
   * Get the target directory path for installing a skill.
   */
  getInstallDir(scope: 'project' | 'global', target: 'claude' | 'agents'): string {
    if (scope === 'project' && this.projectPath) {
      return join(this.projectPath, target === 'claude' ? '.claude' : '.agents', 'skills');
    }
    return join(homedir(), target === 'claude' ? '.claude' : '.agents', 'skills');
  }
}

/**
 * Default instance of SkillLoader (global-only, backwards compatible)
 */
export const defaultSkillLoader = new SkillLoader();

/**
 * Factory function to create a SkillLoader with optional project path
 */
export function createSkillLoader(projectPath?: string): SkillLoader {
  return new SkillLoader(projectPath);
}
