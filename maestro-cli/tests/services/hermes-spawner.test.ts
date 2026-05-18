import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MaestroManifest } from '../../src/types/manifest.js';
import { AgentSpawner } from '../../src/services/agent-spawner.js';
import { HermesSpawner } from '../../src/services/hermes-spawner.js';

const spawnWithUlimit = vi.fn(() => ({
  stdin: {
    destroyed: false,
    write: vi.fn(),
  },
}));

vi.mock('../../src/services/spawn-with-ulimit.js', () => ({
  spawnWithUlimit,
}));

const manifest: MaestroManifest = {
  manifestVersion: '1.0',
  mode: 'worker',
  agentTool: 'hermes',
  tasks: [{
    id: 'task-123',
    title: 'Test task',
    description: 'Test description',
    acceptanceCriteria: ['Done'],
    projectId: 'proj-1',
    createdAt: '2026-02-02T00:00:00Z',
  }],
  session: {
    model: 'hermes-default',
    permissionMode: 'acceptEdits',
    maxTurns: 42,
    workingDirectory: '/tmp/project',
  },
};

describe('HermesSpawner', () => {
  beforeEach(() => {
    spawnWithUlimit.mockClear();
  });

  it('builds Hermes chat args for one-shot Maestro sessions', () => {
    const spawner = new HermesSpawner();

    const args = spawner.buildHermesArgs(manifest, 'session-123', 'system prompt', 'task prompt');

    expect(args).toEqual([
      'chat',
      '--max-turns',
      '42',
      '--yolo',
      '--query',
      '[SYSTEM INSTRUCTIONS]\nsystem prompt\n\n[TASK]\ntask prompt',
    ]);
  });

  it('passes explicit Hermes models through to the CLI', () => {
    const spawner = new HermesSpawner();

    const args = spawner.buildHermesArgs({
      ...manifest,
      session: {
        ...manifest.session,
        model: 'anthropic/claude-sonnet-4.6',
        permissionMode: 'interactive',
      },
    }, 'session-123', 'system prompt', 'task prompt');

    expect(args).toContain('--model');
    expect(args).toContain('anthropic/claude-sonnet-4.6');
    expect(args).not.toContain('--yolo');
  });

  it('routes Hermes manifests through the agent spawner factory', async () => {
    const result = await new AgentSpawner().spawn(manifest, 'session-123', { cwd: '/tmp/project' });

    expect(result.sessionId).toBe('session-123');
    expect(spawnWithUlimit).toHaveBeenCalledWith(
      'hermes',
      expect.arrayContaining(['chat', '--query']),
      expect.objectContaining({ cwd: '/tmp/project' }),
    );
  });
});
