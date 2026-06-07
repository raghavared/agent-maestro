import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import type { MaestroManifest } from '../../src/types/manifest.js';
import { resolveCapabilitySet } from '../../src/prompting/capability-policy.js';

const postMock = vi.fn();
const guardCommandMock = vi.fn();

vi.mock('../../src/api.js', () => ({
  api: { post: (...args: unknown[]) => postMock(...args) },
}));

vi.mock('../../src/services/command-permissions.js', () => ({
  guardCommand: (...args: unknown[]) => guardCommandMock(...args),
}));

vi.mock('ora', () => ({
  default: () => ({ start: () => ({ succeed: vi.fn(), stop: vi.fn() }) }),
}));

import { registerAnnounceCommands } from '../../src/commands/announce.js';

function buildProgram() {
  const program = new Command();
  program.exitOverride();
  program.option('--json', 'JSON output');
  registerAnnounceCommands(program);
  return program;
}

function buildManifest(mode: MaestroManifest['mode']): MaestroManifest {
  return {
    manifestVersion: '1.0',
    mode,
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
    session: { model: 'sonnet', permissionMode: 'acceptEdits' },
  };
}

describe('maestro announce command', () => {
  beforeEach(() => {
    postMock.mockReset();
    guardCommandMock.mockReset();
  });

  it('posts the text to /api/announce on the happy path', async () => {
    postMock.mockResolvedValue({ success: true, device: 'yolo' });

    await buildProgram().parseAsync(['node', 'cli', 'announce', 'hello there']);

    expect(guardCommandMock).toHaveBeenCalledWith('announce');
    expect(postMock).toHaveBeenCalledWith('/api/announce', { text: 'hello there' });
  });

  it('forwards an explicit --device to the server', async () => {
    postMock.mockResolvedValue({ success: true, device: 'kitchen' });

    await buildProgram().parseAsync(['node', 'cli', 'announce', 'hi', '--device', 'kitchen']);

    expect(postMock).toHaveBeenCalledWith('/api/announce', { text: 'hi', device: 'kitchen' });
  });

  it('is gated behind the announce capability', async () => {
    guardCommandMock.mockRejectedValue(new Error('Command not allowed: announce'));
    postMock.mockResolvedValue({ success: true });

    await expect(
      buildProgram().parseAsync(['node', 'cli', 'announce', 'blocked']),
    ).rejects.toThrow(/not allowed/);

    // Guard ran and rejected; the API must not be hit when the guard denies.
    expect(guardCommandMock).toHaveBeenCalledWith('announce');
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe('announce capability gating', () => {
  it('is available to coordinators', () => {
    const result = resolveCapabilitySet(buildManifest('coordinator'));
    expect(result.allowedCommands).toContain('announce');
  });

  it('is available to workers', () => {
    const result = resolveCapabilitySet(buildManifest('worker'));
    expect(result.allowedCommands).toContain('announce');
  });

  it('is available to coordinated-workers (Alexa Debugger runs in this mode)', () => {
    const result = resolveCapabilitySet(buildManifest('coordinated-worker'));
    expect(result.allowedCommands).toContain('announce');
  });

  it('is available to coordinated-coordinators', () => {
    const result = resolveCapabilitySet(buildManifest('coordinated-coordinator'));
    expect(result.allowedCommands).toContain('announce');
  });
});
