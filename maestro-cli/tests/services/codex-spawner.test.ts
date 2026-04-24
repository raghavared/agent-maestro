import { describe, expect, it } from 'vitest';
import { CodexSpawner } from '../../src/services/codex-spawner.js';
import type { MaestroManifest } from '../../src/types/manifest.js';

describe('CodexSpawner', () => {
  const manifest: MaestroManifest = {
    manifestVersion: '1.0',
    mode: 'worker',
    tasks: [{
      id: 'task-123',
      title: 'Test task',
      description: 'Test description',
      acceptanceCriteria: ['Test criterion'],
      projectId: 'proj-1',
      createdAt: '2026-02-02T00:00:00Z',
    }],
    session: {
      model: 'gpt-5.5',
      permissionMode: 'acceptEdits',
    },
  };

  it('includes Codex 5.5 in the supported model catalog', () => {
    expect(CodexSpawner.MODELS).toContain('gpt-5.5');
  });

  it('passes Codex 5.5 through to the Codex CLI model flag', () => {
    const args = new CodexSpawner().buildCodexArgs(manifest);

    expect(args).toContain('--model');
    expect(args).toContain('gpt-5.5');
  });
});
