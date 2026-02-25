import { describe, it, expect } from 'vitest';
import type { MaestroManifest } from '../../src/types/manifest.js';
import { resolveCapabilitySet, resolveManifestFailureCapabilities } from '../../src/prompting/capability-policy.js';

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

describe('capability-policy', () => {
  it('always keeps core commands available', () => {
    const manifest = buildManifest({
      teamMemberCommandPermissions: {
        groups: {
          root: false,
        },
      },
    });

    const result = resolveCapabilitySet(manifest);

    expect(result.allowedCommands).toContain('whoami');
    expect(result.allowedCommands).toContain('status');
    expect(result.allowedCommands).toContain('commands');
  });

  it('applies explicit allowlist while preserving core commands', () => {
    const manifest = buildManifest({
      session: {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
        allowedCommands: ['task:get'],
      } as any,
    });

    const result = resolveCapabilitySet(manifest);

    expect(result.allowedCommands).toContain('task:get');
    expect(result.allowedCommands).toContain('whoami');
    expect(result.allowedCommands).toContain('commands');
    expect(result.allowedCommands).not.toContain('task:create');
  });

  it('does not enable mode-incompatible commands via overrides', () => {
    const manifest = buildManifest({
      teamMemberCommandPermissions: {
        commands: {
          'session:spawn': true,
        },
      },
    });

    const result = resolveCapabilitySet(manifest);

    expect(result.allowedCommands).not.toContain('session:spawn');
  });

  it('excludes team-member:list from coordinator defaults', () => {
    const result = resolveCapabilitySet(buildManifest({ mode: 'coordinator' }));
    expect(result.allowedCommands).not.toContain('team-member:list');
  });

  it('allows worker overrides to grant recruiter team-member commands', () => {
    const manifest = buildManifest({
      mode: 'worker',
      teamMemberCommandPermissions: {
        commands: {
          'team-member:create': true,
          'team-member:list': true,
          'team-member:get': true,
        },
      },
    });

    const result = resolveCapabilitySet(manifest);

    expect(result.allowedCommands).toContain('team-member:create');
    expect(result.allowedCommands).toContain('team-member:list');
    expect(result.allowedCommands).toContain('team-member:get');
  });

  it('keeps non-grantable team-member commands blocked for worker overrides', () => {
    const manifest = buildManifest({
      mode: 'worker',
      teamMemberCommandPermissions: {
        commands: {
          'team-member:edit': true,
        },
      },
    });

    const result = resolveCapabilitySet(manifest);

    expect(result.allowedCommands).not.toContain('team-member:edit');
  });

  it('hard-blocks coordinated-coordinator spawn even with explicit allowlist', () => {
    const manifest = buildManifest({
      mode: 'coordinated-coordinator',
      coordinatorSessionId: 'sess-parent',
      session: {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
        allowedCommands: ['session:spawn', 'session:siblings', 'session:prompt'],
      } as any,
    });

    const result = resolveCapabilitySet(manifest);
    expect(result.allowedCommands).toContain('session:siblings');
    expect(result.allowedCommands).toContain('session:prompt');
    expect(result.allowedCommands).not.toContain('session:spawn');
  });

  it('returns safe degraded fallback when manifest load fails', () => {
    const result = resolveManifestFailureCapabilities('worker', 'safe-degraded');

    expect(result.allowedCommands).toContain('whoami');
    expect(result.allowedCommands).toContain('session:report:progress');
    expect(result.allowedCommands).not.toContain('task:create');
    expect(result.resolution).toBe('fallback');
  });

  it('enables canPromptOtherSessions only for coordinated modes', () => {
    const worker = resolveCapabilitySet(buildManifest({ mode: 'worker' }));
    const coordinator = resolveCapabilitySet(buildManifest({ mode: 'coordinator' }));
    const coordinatedWorker = resolveCapabilitySet(buildManifest({ mode: 'coordinated-worker' }));
    const coordinatedCoordinator = resolveCapabilitySet(buildManifest({ mode: 'coordinated-coordinator' }));

    expect(worker.capabilities.canPromptOtherSessions).toBe(false);
    expect(coordinator.capabilities.canPromptOtherSessions).toBe(false);
    expect(coordinatedWorker.capabilities.canPromptOtherSessions).toBe(true);
    expect(coordinatedCoordinator.capabilities.canPromptOtherSessions).toBe(true);
  });
});
