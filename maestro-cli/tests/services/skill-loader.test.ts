import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillLoader } from '../../src/services/skill-loader.js';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir, homedir } from 'os';
import { randomBytes } from 'crypto';

describe('SkillLoader', () => {
  let testProjectDir: string;
  let projectClaudeSkillsDir: string;
  let projectAgentsSkillsDir: string;

  const createLoader = (projectPath = testProjectDir): SkillLoader =>
    new SkillLoader(projectPath, { includeGlobal: false });

  const createSkill = async (
    source: 'claude' | 'agents',
    name: string,
    content?: string,
    filename: 'skill.md' | 'SKILL.md' = 'skill.md'
  ): Promise<string> => {
    const baseDir = source === 'claude' ? projectClaudeSkillsDir : projectAgentsSkillsDir;
    const skillDir = join(baseDir, name);
    await mkdir(skillDir, { recursive: true });
    if (content !== undefined) {
      await writeFile(join(skillDir, filename), content);
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

  describe('discover()', () => {
    it('returns empty array when project path does not exist', async () => {
      const loader = new SkillLoader(join(testProjectDir, 'nonexistent'), { includeGlobal: false });
      const skills = await loader.discover();

      expect(skills).toEqual([]);
    });

    it('returns empty array when project skills directories are empty', async () => {
      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toEqual([]);
    });

    it('discovers valid skills with lowercase skill.md', async () => {
      const validSkillDir = await createSkill('claude', 'valid-skill', '# Valid Skill\n');

      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0]).toMatchObject({
        name: 'valid-skill',
        valid: true,
        path: validSkillDir,
        scope: 'project',
        source: 'claude',
      });
    });

    it('accepts uppercase SKILL.md files', async () => {
      await createSkill('claude', 'uppercase-skill', '# Uppercase Skill\n', 'SKILL.md');

      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('uppercase-skill');
      expect(skills[0].valid).toBe(true);
    });

    it('marks skill directories without markdown file as invalid', async () => {
      const invalidSkillDir = await createSkill('agents', 'invalid-skill');

      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0]).toMatchObject({
        name: 'invalid-skill',
        valid: false,
        path: invalidSkillDir,
        scope: 'project',
        source: 'agents',
      });
    });

    it('discovers skills across both project sources', async () => {
      await createSkill('claude', 'skill-1', '# Skill 1\n');
      await createSkill('agents', 'skill-2', '# Skill 2\n');
      await createSkill('agents', 'skill-3');

      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toHaveLength(3);
      expect(skills.filter((s) => s.valid)).toHaveLength(2);
      expect(skills.filter((s) => !s.valid)).toHaveLength(1);
    });

    it('ignores non-directory entries inside skills directories', async () => {
      await createSkill('claude', 'valid-skill', '# Valid Skill\n');
      await writeFile(join(projectClaudeSkillsDir, 'readme.txt'), 'not a skill');

      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('valid-skill');
    });

    it('de-duplicates same-name project skills and keeps claude source first', async () => {
      const claudeSkillDir = await createSkill('claude', 'shared-skill', '# Claude Skill\n');
      await createSkill('agents', 'shared-skill', '# Agents Skill\n');

      const loader = createLoader();
      const skills = await loader.discover();

      expect(skills).toHaveLength(1);
      expect(skills[0]).toMatchObject({
        name: 'shared-skill',
        path: claudeSkillDir,
        source: 'claude',
      });
    });
  });

  describe('discoverAll()', () => {
    it('returns duplicate names across sources for validation workflows', async () => {
      await createSkill('claude', 'shared-skill', '# Claude Skill\n');
      await createSkill('agents', 'shared-skill', '# Agents Skill\n');

      const loader = createLoader();
      const skills = await loader.discoverAll();

      expect(skills.filter((s) => s.name === 'shared-skill')).toHaveLength(2);
      expect(skills.map((s) => s.source).sort()).toEqual(['agents', 'claude']);
    });
  });

  describe('load()', () => {
    it('returns empty result for empty skill list', async () => {
      const loader = createLoader();
      const result = await loader.load([]);

      expect(result).toEqual({
        loaded: [],
        missing: [],
        invalid: [],
      });
    });

    it('categorizes missing skills', async () => {
      const loader = createLoader();
      const result = await loader.load(['nonexistent-skill']);

      expect(result.missing).toContain('nonexistent-skill');
      expect(result.loaded).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    it('categorizes invalid skills', async () => {
      await createSkill('agents', 'invalid-skill');

      const loader = createLoader();
      const result = await loader.load(['invalid-skill']);

      expect(result.invalid).toContain('invalid-skill');
      expect(result.loaded).toEqual([]);
      expect(result.missing).toEqual([]);
    });

    it('loads valid skills and returns full paths', async () => {
      const validSkillDir = await createSkill('claude', 'valid-skill', '# Valid Skill\n');

      const loader = createLoader();
      const result = await loader.load(['valid-skill']);

      expect(result.loaded).toEqual([validSkillDir]);
      expect(result.missing).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    it('handles mixed valid, invalid, and missing skills', async () => {
      const validSkillDir = await createSkill('claude', 'valid-skill', '# Valid Skill\n');
      await createSkill('agents', 'invalid-skill');

      const loader = createLoader();
      const result = await loader.load(['valid-skill', 'invalid-skill', 'missing-skill']);

      expect(result.loaded).toContain(validSkillDir);
      expect(result.invalid).toContain('invalid-skill');
      expect(result.missing).toContain('missing-skill');
    });
  });

  describe('getSkillInfo()', () => {
    it('returns null for nonexistent skills', async () => {
      const loader = createLoader();
      const info = await loader.getSkillInfo('nonexistent');

      expect(info).toBeNull();
    });

    it('returns metadata for valid skills', async () => {
      const validSkillDir = await createSkill('claude', 'valid-skill', '# Valid Skill\n');

      const loader = createLoader();
      const info = await loader.getSkillInfo('valid-skill');

      expect(info).toMatchObject({
        name: 'valid-skill',
        path: validSkillDir,
        valid: true,
        scope: 'project',
        source: 'claude',
      });
    });

    it('returns metadata for invalid skills', async () => {
      const invalidSkillDir = await createSkill('agents', 'invalid-skill');

      const loader = createLoader();
      const info = await loader.getSkillInfo('invalid-skill');

      expect(info).toMatchObject({
        name: 'invalid-skill',
        path: invalidSkillDir,
        valid: false,
        scope: 'project',
        source: 'agents',
      });
    });

    it('extracts a description from non-heading content', async () => {
      await createSkill('claude', 'described-skill', '# Heading\nThis is a description\n');

      const loader = createLoader();
      const info = await loader.getSkillInfo('described-skill');

      expect(info?.valid).toBe(true);
      expect(info?.description).toBe('This is a description');
    });
  });

  describe('getInstallDir()', () => {
    it('returns project install directories for project scope', () => {
      const loader = createLoader();

      expect(loader.getInstallDir('project', 'claude')).toBe(join(testProjectDir, '.claude', 'skills'));
      expect(loader.getInstallDir('project', 'agents')).toBe(join(testProjectDir, '.agents', 'skills'));
    });

    it('returns home-scoped install directories for global scope', () => {
      const loader = createLoader();

      expect(loader.getInstallDir('global', 'claude')).toBe(join(homedir(), '.claude', 'skills'));
      expect(loader.getInstallDir('global', 'agents')).toBe(join(homedir(), '.agents', 'skills'));
    });
  });

  describe('graceful error handling', () => {
    it('returns empty array instead of throwing on discover errors', async () => {
      const loader = new SkillLoader('/nonexistent/path/that/should/not/exist', { includeGlobal: false });
      const skills = await loader.discover();

      expect(skills).toEqual([]);
    });

    it('categorizes unresolved skills as missing in load()', async () => {
      const loader = createLoader();
      const result = await loader.load(['skill-1', 'skill-2']);

      expect(result.missing).toEqual(['skill-1', 'skill-2']);
      expect(result.loaded).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    it('returns null instead of throwing on getSkillInfo errors', async () => {
      const loader = new SkillLoader('/nonexistent/path/that/should/not/exist', { includeGlobal: false });
      const info = await loader.getSkillInfo('any-skill');

      expect(info).toBeNull();
    });
  });
});
