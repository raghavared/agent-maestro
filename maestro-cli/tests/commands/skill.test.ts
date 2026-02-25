import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillLoader } from '../../src/services/skill-loader.js';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

describe('SkillLoader (for CLI command integration)', () => {
  let testProjectDir: string;
  let projectClaudeSkillsDir: string;
  let projectAgentsSkillsDir: string;

  const createLoader = (): SkillLoader =>
    new SkillLoader(testProjectDir, { includeGlobal: false });

  const createSkill = async (
    source: 'claude' | 'agents',
    name: string,
    content?: string
  ): Promise<string> => {
    const baseDir = source === 'claude' ? projectClaudeSkillsDir : projectAgentsSkillsDir;
    const skillDir = join(baseDir, name);
    await mkdir(skillDir, { recursive: true });
    if (content !== undefined) {
      await writeFile(join(skillDir, 'skill.md'), content);
    }
    return skillDir;
  };

  beforeEach(async () => {
    testProjectDir = join(tmpdir(), `maestro-skills-test-${randomBytes(4).toString('hex')}`);
    projectClaudeSkillsDir = join(testProjectDir, '.claude', 'skills');
    projectAgentsSkillsDir = join(testProjectDir, '.agents', 'skills');
    await mkdir(projectClaudeSkillsDir, { recursive: true });
    await mkdir(projectAgentsSkillsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testProjectDir, { recursive: true, force: true });
  });

  describe('CLI skill list command behavior', () => {
    it('should discover skills correctly for "maestro skill list"', async () => {
      await createSkill('claude', 'code-review', '# Code Review Skill\n');
      await createSkill('agents', 'test-writer', '# Test Writer Skill\n');

      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name).sort()).toEqual(['code-review', 'test-writer']);
      expect(skills.every((s) => s.valid)).toBe(true);
      expect(skills.every((s) => s.scope === 'project')).toBe(true);
    });

    it('should handle empty skills directory gracefully', async () => {
      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toEqual([]);
    });

    it('should mark invalid skills in list output', async () => {
      await createSkill('claude', 'broken-skill');

      const loader = createLoader();
      const skills = await loader.discover();

      const invalidSkills = skills.filter((s) => !s.valid);
      expect(invalidSkills).toHaveLength(1);
      expect(invalidSkills[0].name).toBe('broken-skill');
    });
  });

  describe('CLI skill info command behavior', () => {
    it('should return skill info for valid skill', async () => {
      const skillDir = await createSkill('claude', 'test-skill', '# Test Skill\n');

      const loader = createLoader();
      const info = await loader.getSkillInfo('test-skill');

      expect(info).toBeDefined();
      expect(info?.name).toBe('test-skill');
      expect(info?.path).toBe(skillDir);
      expect(info?.valid).toBe(true);
    });

    it('should return null for nonexistent skill', async () => {
      const loader = createLoader();
      const info = await loader.getSkillInfo('nonexistent');

      expect(info).toBeNull();
    });

    it('should show invalid status for skills without skill.md', async () => {
      await createSkill('claude', 'incomplete-skill');

      const loader = createLoader();
      const info = await loader.getSkillInfo('incomplete-skill');

      expect(info?.valid).toBe(false);
    });
  });

  describe('CLI skill validate command behavior', () => {
    it('should categorize valid skills for validation summary', async () => {
      await createSkill('claude', 'skill-1', '# Skill 1\n');
      await createSkill('agents', 'skill-2', '# Skill 2\n');

      const loader = createLoader();
      const skills = await loader.discover();

      const valid = skills.filter((s) => s.valid);
      const invalid = skills.filter((s) => !s.valid);

      expect(valid).toHaveLength(2);
      expect(invalid).toHaveLength(0);
    });

    it('should report warnings for invalid skills', async () => {
      await createSkill('agents', 'incomplete-skill');

      const loader = createLoader();
      const skills = await loader.discover();

      const valid = skills.filter((s) => s.valid);
      const invalid = skills.filter((s) => !s.valid);

      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(1);
      expect(invalid[0].name).toBe('incomplete-skill');
    });

    it('should provide summary counts', async () => {
      await createSkill('claude', 'valid-skill', '# Valid\n');
      await createSkill('agents', 'invalid-skill');

      const loader = createLoader();
      const skills = await loader.discover();

      const valid = skills.filter((s) => s.valid);
      const invalid = skills.filter((s) => !s.valid);

      expect(valid).toHaveLength(1);
      expect(invalid).toHaveLength(1);
    });
  });

  describe('JSON output format', () => {
    it('should provide JSON-serializable skill list', async () => {
      await createSkill('claude', 'test-skill', '# Test\n');

      const loader = createLoader();
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
      await createSkill('claude', 'test-skill', '# Test\n');

      const loader = createLoader();
      const info = await loader.getSkillInfo('test-skill');

      // Should be JSON serializable
      const json = JSON.stringify(info);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('path');
      expect(parsed).toHaveProperty('valid');
    });

    it('should include scope and source in serialized skill entries', async () => {
      await createSkill('agents', 'agent-skill', '# Agent Skill\n');

      const loader = createLoader();
      const skills = await loader.discover();
      const parsed = JSON.parse(JSON.stringify(skills));

      expect(parsed[0]).toHaveProperty('scope', 'project');
      expect(parsed[0]).toHaveProperty('source', 'agents');
    });
  });
});
