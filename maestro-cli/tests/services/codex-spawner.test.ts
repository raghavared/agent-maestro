import { describe, expect, it } from 'vitest';
import { CodexSpawner } from '../../src/services/codex-spawner.js';
import type { MaestroManifest } from '../../src/types/manifest.js';

describe('CodexSpawner', () => {
  const createManifest = (model: string): MaestroManifest => ({
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
      model,
      permissionMode: 'acceptEdits',
    },
  });

  it('includes both Codex 5.4 and 5.5 in the supported model catalog', () => {
    expect(CodexSpawner.MODELS).toContain('gpt-5.4');
    expect(CodexSpawner.MODELS).toContain('gpt-5.5');
  });

  it.each(['gpt-5.4', 'gpt-5.5'])(
    'passes %s through to the Codex CLI model flag',
    (model) => {
      const args = new CodexSpawner().buildCodexArgs(createManifest(model));

      expect(args).toContain('--model');
      expect(args).toContain(model);
    }
  );

  it('does not pass unsupported max-turns to the Codex CLI', () => {
    const args = new CodexSpawner().buildCodexArgs({
      ...createManifest('gpt-5.5'),
      session: {
        ...createManifest('gpt-5.5').session,
        maxTurns: 1,
      },
    });

    expect(args).not.toContain('--max-turns');
  });
});
