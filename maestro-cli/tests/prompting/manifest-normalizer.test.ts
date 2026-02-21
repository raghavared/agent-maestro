import { describe, it, expect } from 'vitest';
import type { MaestroManifest } from '../../src/types/manifest.js';
import { normalizeManifest } from '../../src/prompting/manifest-normalizer.js';

function buildManifest(overrides: Partial<MaestroManifest> = {}): MaestroManifest {
  return {
    manifestVersion: '1.0',
    mode: 'worker',
    tasks: [
      {
        id: 'task-1',
        title: 'Test',
        description: 'Test description',
        acceptanceCriteria: ['Done'],
        projectId: 'proj-1',
        createdAt: '2026-02-21T00:00:00Z',
      },
    ],
    session: {
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    },
    ...overrides,
  };
}

describe('manifest-normalizer', () => {
  it('normalizes legacy execute mode to worker', () => {
    const manifest = buildManifest({ mode: 'execute' as any });
    const result = normalizeManifest(manifest);

    expect(result.manifest.mode).toBe('worker');
    expect(result.legacyModeNormalized).toBe(true);
  });

  it('normalizes legacy coordinate mode to coordinated-coordinator when coordinator session exists', () => {
    const manifest = buildManifest({
      mode: 'coordinate' as any,
      coordinatorSessionId: 'sess-parent',
    });

    const result = normalizeManifest(manifest);

    expect(result.manifest.mode).toBe('coordinated-coordinator');
  });

  it('builds teamMemberProfiles from legacy singular team member fields', () => {
    const manifest = buildManifest({
      teamMemberId: 'tm-1',
      teamMemberName: 'Alice',
      teamMemberAvatar: 'A',
      teamMemberRole: 'Engineer',
      teamMemberIdentity: 'Build backend APIs',
      teamMemberMemory: ['Prefers TypeScript'],
    });

    const result = normalizeManifest(manifest);

    expect(result.manifest.teamMemberProfiles).toBeDefined();
    expect(result.manifest.teamMemberProfiles?.[0].id).toBe('tm-1');
    expect(result.manifest.teamMemberProfiles?.[0].identity).toBe('Build backend APIs');
  });

  it('flags deprecated workflow fields as warnings', () => {
    const manifest = buildManifest({
      teamMemberWorkflowTemplateId: 'execute-simple',
      teamMemberCustomWorkflow: 'Do the thing',
    });

    const result = normalizeManifest(manifest);

    expect(result.deprecatedWorkflowFieldsPresent).toBe(true);
    expect(result.warnings.some((message) => message.includes('Deprecated workflow fields'))).toBe(true);
  });
});
