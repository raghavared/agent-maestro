import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillLoader, type SkillInfo, type SkillLoadResult } from '../../src/services/skill-loader.js';
import { join } from 'path';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

describe('SkillLoader', () => {
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
        // Remove all files first
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

  describe('discover()', () => {
    it('should return empty array when skills directory does not exist', async () => {
      const loader = new SkillLoader(join(testSkillsDir, 'nonexistent'));
      const skills = await loader.discover();

      expect(skills).toEqual([]);
    });

    it('should return empty array when skills directory is empty', async () => {
      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      expect(skills).toEqual([]);
    });

    it('should discover valid skills with skill.md', async () => {
      // Create a valid skill
      const validSkillDir = join(testSkillsDir, 'valid-skill');
      await mkdir(validSkillDir, { recursive: true });
      await writeFile(join(validSkillDir, 'skill.md'), '# Valid Skill\n');

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0]).toMatchObject({
        name: 'valid-skill',
        valid: true,
        path: validSkillDir,
      });
    });

    it('should mark invalid skills without skill.md', async () => {
      // Create a skill without skill.md
      const invalidSkillDir = join(testSkillsDir, 'invalid-skill');
      await mkdir(invalidSkillDir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0]).toMatchObject({
        name: 'invalid-skill',
        valid: false,
        path: invalidSkillDir,
      });
    });

    it('should discover multiple skills and categorize them correctly', async () => {
      // Create valid skills
      const skill1Dir = join(testSkillsDir, 'skill-1');
      await mkdir(skill1Dir, { recursive: true });
      await writeFile(join(skill1Dir, 'skill.md'), '# Skill 1\n');

      const skill2Dir = join(testSkillsDir, 'skill-2');
      await mkdir(skill2Dir, { recursive: true });
      await writeFile(join(skill2Dir, 'skill.md'), '# Skill 2\n');

      // Create invalid skill
      const skill3Dir = join(testSkillsDir, 'skill-3');
      await mkdir(skill3Dir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      expect(skills).toHaveLength(3);
      const validSkills = skills.filter((s) => s.valid);
      const invalidSkills = skills.filter((s) => !s.valid);

      expect(validSkills).toHaveLength(2);
      expect(invalidSkills).toHaveLength(1);
    });

    it('should ignore non-directory entries', async () => {
      // Create a skill directory
      const skillDir = join(testSkillsDir, 'valid-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'skill.md'), '# Valid Skill\n');

      // Create a file in the skills directory (should be ignored)
      await writeFile(join(testSkillsDir, 'readme.txt'), 'This is not a skill');

      const loader = new SkillLoader(testSkillsDir);
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('valid-skill');
    });
  });

  describe('load()', () => {
    it('should return empty result for empty skill names array', async () => {
      const loader = new SkillLoader(testSkillsDir);
      const result = await loader.load([]);

      expect(result).toEqual({
        loaded: [],
        missing: [],
        invalid: [],
      });
    });

    it('should categorize missing skills', async () => {
      const loader = new SkillLoader(testSkillsDir);
      const result = await loader.load(['nonexistent-skill']);

      expect(result.missing).toContain('nonexistent-skill');
      expect(result.loaded).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    it('should categorize invalid skills (no skill.md)', async () => {
      // Create invalid skill
      const invalidSkillDir = join(testSkillsDir, 'invalid-skill');
      await mkdir(invalidSkillDir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const result = await loader.load(['invalid-skill']);

      expect(result.invalid).toContain('invalid-skill');
      expect(result.loaded).toEqual([]);
      expect(result.missing).toEqual([]);
    });

    it('should load valid skills', async () => {
      // Create valid skill
      const validSkillDir = join(testSkillsDir, 'valid-skill');
      await mkdir(validSkillDir, { recursive: true });
      await writeFile(join(validSkillDir, 'skill.md'), '# Valid Skill\n');

      const loader = new SkillLoader(testSkillsDir);
      const result = await loader.load(['valid-skill']);

      expect(result.loaded).toContain(validSkillDir);
      expect(result.missing).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    it('should handle mixed valid, invalid, and missing skills', async () => {
      // Create valid skill
      const validSkillDir = join(testSkillsDir, 'valid-skill');
      await mkdir(validSkillDir, { recursive: true });
      await writeFile(join(validSkillDir, 'skill.md'), '# Valid Skill\n');

      // Create invalid skill
      const invalidSkillDir = join(testSkillsDir, 'invalid-skill');
      await mkdir(invalidSkillDir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const result = await loader.load(['valid-skill', 'invalid-skill', 'missing-skill']);

      expect(result.loaded).toContain(validSkillDir);
      expect(result.invalid).toContain('invalid-skill');
      expect(result.missing).toContain('missing-skill');
    });

    it('should return full paths for loaded skills', async () => {
      const validSkillDir = join(testSkillsDir, 'test-skill');
      await mkdir(validSkillDir, { recursive: true });
      await writeFile(join(validSkillDir, 'skill.md'), '# Test Skill\n');

      const loader = new SkillLoader(testSkillsDir);
      const result = await loader.load(['test-skill']);

      expect(result.loaded).toHaveLength(1);
      expect(result.loaded[0]).toBe(validSkillDir);
    });
  });

  describe('getSkillInfo()', () => {
    it('should return null for nonexistent skill', async () => {
      const loader = new SkillLoader(testSkillsDir);
      const info = await loader.getSkillInfo('nonexistent');

      expect(info).toBeNull();
    });

    it('should return SkillInfo for valid skill', async () => {
      const validSkillDir = join(testSkillsDir, 'valid-skill');
      await mkdir(validSkillDir, { recursive: true });
      await writeFile(join(validSkillDir, 'skill.md'), '# Valid Skill\n');

      const loader = new SkillLoader(testSkillsDir);
      const info = await loader.getSkillInfo('valid-skill');

      expect(info).toMatchObject({
        name: 'valid-skill',
        path: validSkillDir,
        valid: true,
      });
    });

    it('should return SkillInfo for invalid skill (missing skill.md)', async () => {
      const invalidSkillDir = join(testSkillsDir, 'invalid-skill');
      await mkdir(invalidSkillDir, { recursive: true });

      const loader = new SkillLoader(testSkillsDir);
      const info = await loader.getSkillInfo('invalid-skill');

      expect(info).toMatchObject({
        name: 'invalid-skill',
        path: invalidSkillDir,
        valid: false,
      });
    });

    it('should include description if available', async () => {
      const skillDir = join(testSkillsDir, 'described-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'skill.md'), '# Described Skill\nThis is a description');

      const loader = new SkillLoader(testSkillsDir);
      const info = await loader.getSkillInfo('described-skill');

      expect(info?.valid).toBe(true);
      expect(info?.name).toBe('described-skill');
    });
  });

  describe('custom skills directory', () => {
    it('should use custom skills directory when provided', async () => {
      const customDir = join(testSkillsDir, 'custom-skills');
      await mkdir(customDir, { recursive: true });

      const skillDir = join(customDir, 'custom-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'skill.md'), '# Custom Skill\n');

      const loader = new SkillLoader(customDir);
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('custom-skill');
    });
  });

  describe('graceful error handling', () => {
    it('should return empty array instead of throwing on discover error', async () => {
      const loader = new SkillLoader('/nonexistent/path/that/should/not/exist');
      const skills = await loader.discover();

      expect(skills).toEqual([]);
    });

    it('should categorize errors in load as invalid skills', async () => {
      const loader = new SkillLoader(testSkillsDir);
      const result = await loader.load(['skill-1', 'skill-2']);

      // Should categorize as missing, not throw
      expect(result.missing).toEqual(['skill-1', 'skill-2']);
      expect(result.loaded).toEqual([]);
    });

    it('should return null instead of throwing on getSkillInfo error', async () => {
      const loader = new SkillLoader('/nonexistent/path/that/should/not/exist');
      const info = await loader.getSkillInfo('any-skill');

      expect(info).toBeNull();
    });
  });
});
