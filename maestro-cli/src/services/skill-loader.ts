import { readdir, stat } from 'fs/promises';
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
  /** Whether this is a valid skill (has skill.md) */
  valid: boolean;
  /** Optional description extracted from skill.md */
  description?: string;
}

/**
 * Result of loading skills
 */
export interface SkillLoadResult {
  /** Array of successfully loaded skill paths */
  loaded: string[];
  /** Array of skill names that were not found */
  missing: string[];
  /** Array of skill directories that don't contain skill.md */
  invalid: string[];
}

/**
 * SkillLoader - Manages discovery and loading of Claude Code skills
 *
 * Skills are stored in ~/.skills/ directory, with each skill in its own
 * subdirectory containing at minimum a skill.md file.
 *
 * Features:
 * - Discover all available skills
 * - Load specific skills and categorize results
 * - Graceful error handling (no exceptions, categorized results)
 * - Configurable skills directory (for testing)
 */
export class SkillLoader {
  private skillsDir: string;

  /**
   * Create a new SkillLoader
   *
   * @param skillsDir - Optional custom skills directory (defaults to ~/.skills/)
   */
  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir || join(homedir(), '.skills');
  }

  /**
   * Discover all available skills in the skills directory
   *
   * Returns empty array if skills directory doesn't exist.
   * Does not throw errors - gracefully handles missing directory.
   *
   * @returns Array of discovered SkillInfo objects
   */
  async discover(): Promise<SkillInfo[]> {
    try {
      // Return empty array if directory doesn't exist
      if (!existsSync(this.skillsDir)) {
        return [];
      }

      // Read directory entries
      const entries = await readdir(this.skillsDir, { withFileTypes: true });

      // Filter to directories only and check for skill.md
      const skills: SkillInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillPath = join(this.skillsDir, entry.name);
        const skillMdPath = join(skillPath, 'skill.md');
        const valid = existsSync(skillMdPath);

        skills.push({
          name: entry.name,
          path: skillPath,
          valid,
        });
      }

      return skills;
    } catch (error) {
      // Graceful degradation - return empty array on error
      return [];
    }
  }

  /**
   * Load specific skills and categorize results
   *
   * Does not throw errors. Returns categorized results for:
   * - loaded: Successfully loaded skill paths
   * - missing: Skill names where directory doesn't exist
   * - invalid: Skill directories without skill.md
   *
   * @param skillNames - Array of skill names to load
   * @returns SkillLoadResult with categorized results
   */
  async load(skillNames: string[]): Promise<SkillLoadResult> {
    const result: SkillLoadResult = {
      loaded: [],
      missing: [],
      invalid: [],
    };

    for (const skillName of skillNames) {
      const skillPath = join(this.skillsDir, skillName);
      const skillMdPath = join(skillPath, 'skill.md');

      try {
        // Check if directory exists
        if (!existsSync(skillPath)) {
          result.missing.push(skillName);
          continue;
        }

        // Check if skill.md exists
        if (!existsSync(skillMdPath)) {
          result.invalid.push(skillName);
          continue;
        }

        // Successfully loaded
        result.loaded.push(skillPath);
      } catch (error) {
        // On any error, categorize as invalid
        result.invalid.push(skillName);
      }
    }

    return result;
  }

  /**
   * Get information about a specific skill
   *
   * Returns null if skill not found or invalid.
   * Does not throw errors.
   *
   * @param skillName - Name of the skill
   * @returns SkillInfo if found, null otherwise
   */
  async getSkillInfo(skillName: string): Promise<SkillInfo | null> {
    try {
      const skillPath = join(this.skillsDir, skillName);

      // Check if directory exists
      if (!existsSync(skillPath)) {
        return null;
      }

      // Check if skill.md exists
      const skillMdPath = join(skillPath, 'skill.md');
      const valid = existsSync(skillMdPath);

      return {
        name: skillName,
        path: skillPath,
        valid,
      };
    } catch (error) {
      return null;
    }
  }
}

/**
 * Default instance of SkillLoader
 */
export const defaultSkillLoader = new SkillLoader();
