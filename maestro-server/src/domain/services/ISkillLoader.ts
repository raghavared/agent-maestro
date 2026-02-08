/**
 * Skill manifest structure.
 */
export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  type?: 'system' | 'role' | 'custom';
  assignTo?: string[];
  capabilities?: string[];
  dependencies?: string[];
  author?: string;
  license?: string;
  config?: Record<string, any>;
}

/**
 * Skill structure with manifest and instructions.
 */
export interface Skill {
  manifest: SkillManifest;
  instructions: string;
}

/**
 * Interface for loading and managing skills.
 * Implementations can load from filesystem, database, or remote API.
 */
export interface ISkillLoader {
  /**
   * Load a single skill by name.
   * @param skillName - Name of the skill to load
   * @returns The skill if found, null otherwise
   * @throws {SkillLoadError} if skill exists but failed to load
   */
  load(skillName: string): Promise<Skill | null>;

  /**
   * Load all skills appropriate for a role.
   * @param role - Role type (worker or orchestrator)
   * @returns Array of skills for the role
   */
  loadForRole(role: 'worker' | 'orchestrator'): Promise<Skill[]>;

  /**
   * List all available skill names.
   * @returns Array of skill names
   */
  listAvailable(): Promise<string[]>;

  /**
   * Validate that a skill's dependencies are available.
   * @param skill - Skill to validate
   * @returns true if all dependencies are available
   */
  validateDependencies(skill: Skill): Promise<boolean>;

  /**
   * Reload a skill (useful for development/hot-reload).
   * @param skillName - Name of the skill to reload
   * @returns The reloaded skill if found, null otherwise
   */
  reload?(skillName: string): Promise<Skill | null>;

  /**
   * Format skills for inclusion in a prompt/manifest.
   * @param skills - Array of skills to format
   * @returns Formatted string representation
   */
  formatForPrompt?(skills: Skill[]): string;
}
