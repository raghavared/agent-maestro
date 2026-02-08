import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillLoader } from '../../src/services/skill-loader.js';
import { join } from 'path';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

describe('SkillLoader (for CLI command integration)', () => {
  let testSkillsDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testSkillsDir = join(tmpdir(), `maestro-skills-test-${randomBytes(4).toString('hex')}`);
    await mkdir(testSkillsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testSkillsDir)) {
      try {
        const fs = await import('fs/promises');
        const entries = await fs.readdir(testSkillsDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(testSkillsDir, entry.name);
          if (entry.isDirectory()) {
            const subEntries = await fs.readdir(fullPath);
            for (const subEntry of subEntries) {
              await fs.unlink(join(fullPath, subEntry));
            }
            await fs.rmdir(fullPath);
          } else {
            await fs.unlink(fullPath);
          }
        }
        await rmdir(testSkillsDir);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('CLI skill list command behavior', () => {
    it('should discover skills correctly for "maestro skill list"', async () => {
      // Create test skills
      const skill1Dir = join(testSkillsDir, 'code-review');
      await mkdir(skill1Dir, { recursive: true });
      await writeFile(join(skill1Dir, 'skill.md'), '# Code Review Skill\n');

      const skill2Dir = join(testSkillsDir, 'test-writer');
      await mkdir(skill2Dir, { recursive: true });
      await writeFile(join(skill2Dir, 'skill.md'), '# Test Writer Skill\n');

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name).sort()).toEqual(['code-review', 'test-writer']);
      expect(skills.every((s) => s.valid)).toBe(true);
    });

    it('should handle empty skills directory gracefully', async () => {
      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      expect(skills).toEqual([]);
    });

    it('should mark invalid skills in list output', async () => {
      // Create invalid skill
      const invalidDir = join(testSkillsDir, 'broken-skill');
      await mkdir(invalidDir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      const invalidSkills = skills.filter((s) => !s.valid);
      expect(invalidSkills).toHaveLength(1);
      expect(invalidSkills[0].name).toBe('broken-skill');
    });
  });

  describe('CLI skill info command behavior', () => {
    it('should return skill info for valid skill', async () => {
      const skillDir = join(testSkillsDir, 'test-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'skill.md'), '# Test Skill\n');

      const loader = new SkillLoader(testSkillsDir);
      const info = await loader.getSkillInfo('test-skill');

      expect(info).toBeDefined();
      expect(info?.name).toBe('test-skill');
      expect(info?.path).toBe(skillDir);
      expect(info?.valid).toBe(true);
    });

    it('should return null for nonexistent skill', async () => {
      const loader = new SkillLoader(testSkillsDir);
      const info = await loader.getSkillInfo('nonexistent');

      expect(info).toBeNull();
    });

    it('should show invalid status for skills without skill.md', async () => {
      const skillDir = join(testSkillsDir, 'incomplete-skill');
      await mkdir(skillDir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const info = await loader.getSkillInfo('incomplete-skill');

      expect(info?.valid).toBe(false);
    });
  });

  describe('CLI skill validate command behavior', () => {
    it('should categorize valid skills for validation summary', async () => {
      // Create valid skills
      const skill1Dir = join(testSkillsDir, 'skill-1');
      await mkdir(skill1Dir, { recursive: true });
      await writeFile(join(skill1Dir, 'skill.md'), '# Skill 1\n');

      const skill2Dir = join(testSkillsDir, 'skill-2');
      await mkdir(skill2Dir, { recursive: true });
      await writeFile(join(skill2Dir, 'skill.md'), '# Skill 2\n');

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      const valid = skills.filter((s) => s.valid);
      const invalid = skills.filter((s) => !s.valid);

      expect(valid).toHaveLength(2);
      expect(invalid).toHaveLength(0);
    });

    it('should report warnings for invalid skills', async () => {
      // Create invalid skill
      const invalidDir = join(testSkillsDir, 'incomplete-skill');
      await mkdir(invalidDir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      const valid = skills.filter((s) => s.valid);
      const invalid = skills.filter((s) => !s.valid);

      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(1);
      expect(invalid[0].name).toBe('incomplete-skill');
    });

    it('should provide summary counts', async () => {
      // Create mixed skills
      const validDir = join(testSkillsDir, 'valid-skill');
      await mkdir(validDir, { recursive: true });
      await writeFile(join(validDir, 'skill.md'), '# Valid\n');

      const invalidDir = join(testSkillsDir, 'invalid-skill');
      await mkdir(invalidDir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      const valid = skills.filter((s) => s.valid);
      const invalid = skills.filter((s) => !s.valid);

      expect(valid).toHaveLength(1);
      expect(invalid).toHaveLength(1);
    });
  });

  describe('JSON output format', () => {
    it('should provide JSON-serializable skill list', async () => {
      const skillDir = join(testSkillsDir, 'test-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'skill.md'), '# Test\n');

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      // Should be JSON serializable
      const json = JSON.stringify(skills);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toHaveProperty('name');
      expect(parsed[0]).toHaveProperty('path');
      expect(parsed[0]).toHaveProperty('valid');
    });

    it('should provide JSON-serializable skill info', async () => {
      const skillDir = join(testSkillsDir, 'test-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'skill.md'), '# Test\n');

      const loader = new SkillLoader(testSkillsDir);
      const info = await loader.getSkillInfo('test-skill');

      // Should be JSON serializable
      const json = JSON.stringify(info);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('path');
      expect(parsed).toHaveProperty('valid');
    });
  });
});
