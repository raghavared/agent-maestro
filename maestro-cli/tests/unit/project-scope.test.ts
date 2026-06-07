import { describe, it, expect, afterEach } from 'vitest';
import { resolveProjectScope } from '../../src/utils/project-scope.js';

const ORIG_PROJECT_ID = process.env.MAESTRO_PROJECT_ID;

afterEach(() => {
  if (ORIG_PROJECT_ID === undefined) {
    delete process.env.MAESTRO_PROJECT_ID;
  } else {
    process.env.MAESTRO_PROJECT_ID = ORIG_PROJECT_ID;
  }
});

describe('resolveProjectScope', () => {
  it('returns all-projects when allProjects flag is set', () => {
    process.env.MAESTRO_PROJECT_ID = 'env-proj';
    const scope = resolveProjectScope({ allProjects: true }, { project: 'global-proj' });
    expect(scope.source).toBe('all-projects');
    expect(scope.projectId).toBeUndefined();
  });

  it('--projectId flag takes precedence over global --project', () => {
    const scope = resolveProjectScope({ projectId: 'flag-proj' }, { project: 'global-proj' });
    expect(scope.source).toBe('flag');
    expect(scope.projectId).toBe('flag-proj');
  });

  it('global --project takes precedence over env var', () => {
    process.env.MAESTRO_PROJECT_ID = 'env-proj';
    const scope = resolveProjectScope({}, { project: 'global-proj' });
    expect(scope.source).toBe('global');
    expect(scope.projectId).toBe('global-proj');
  });

  it('env var MAESTRO_PROJECT_ID used when no flag or global', () => {
    process.env.MAESTRO_PROJECT_ID = 'env-proj';
    const scope = resolveProjectScope({}, {});
    expect(scope.source).toBe('env');
    expect(scope.projectId).toBe('env-proj');
  });

  it('falls back to all-projects when nothing set', () => {
    delete process.env.MAESTRO_PROJECT_ID;
    const scope = resolveProjectScope({}, {});
    expect(scope.source).toBe('all-projects');
    expect(scope.projectId).toBeUndefined();
  });

  it('allProjects overrides even if projectId is also set', () => {
    const scope = resolveProjectScope({ allProjects: true, projectId: 'flag-proj' }, { project: 'global' });
    expect(scope.source).toBe('all-projects');
    expect(scope.projectId).toBeUndefined();
  });
});
