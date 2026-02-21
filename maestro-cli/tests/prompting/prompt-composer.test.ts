import { describe, it, expect } from 'vitest';
import type { MaestroManifest } from '../../src/types/manifest.js';
import { PromptComposer } from '../../src/prompting/prompt-composer.js';
import { ClaudeSpawner } from '../../src/services/claude-spawner.js';
import { CodexSpawner } from '../../src/services/codex-spawner.js';
import { GeminiSpawner } from '../../src/services/gemini-spawner.js';

function buildManifest(overrides: Partial<MaestroManifest> = {}): MaestroManifest {
  return {
    manifestVersion: '1.0',
    mode: 'worker',
    tasks: [
      {
        id: 'task-1',
        title: 'Implement API',
        description: 'Build endpoint and tests',
        acceptanceCriteria: ['Endpoint works', 'Tests pass'],
        projectId: 'proj-1',
        createdAt: '2026-02-21T00:00:00Z',
      },
    ],
    session: {
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    },
    referenceTaskIds: ['task-ref-1', 'task-ref-2'],
    ...overrides,
  };
}

describe('prompt-composer', () => {
  it('builds deterministic system/task prompts with a single session_context block', () => {
    const composer = new PromptComposer();
    const envelope = composer.compose(buildManifest(), { sessionId: 'sess-123' });

    expect(envelope.system).toContain('<commands_reference>');
    expect(envelope.system).toContain('<capability_summary>');
    expect(envelope.task).toContain('<reference_tasks>');
    expect(envelope.task).toContain('<task_id>task-ref-1</task_id>');

    const sessionContextCount = (envelope.task.match(/<session_context>/g) || []).length;
    expect(sessionContextCount).toBe(1);
    expect(envelope.task).toContain('<session_id>sess-123</session_id>');
  });

  it('ignores deprecated workflow fields in prompt output', () => {
    const composer = new PromptComposer();

    const base = buildManifest();
    const withDeprecated = buildManifest({
      teamMemberWorkflowTemplateId: 'execute-simple',
      teamMemberCustomWorkflow: 'Legacy workflow details',
    });

    const baseEnvelope = composer.compose(base, { sessionId: 'sess-abc' });
    const deprecatedEnvelope = composer.compose(withDeprecated, { sessionId: 'sess-abc' });

    expect(deprecatedEnvelope.system).toBe(baseEnvelope.system);
    expect(deprecatedEnvelope.task).toBe(baseEnvelope.task);
  });

  it('keeps prompt envelope semantics consistent across Claude/Codex/Gemini adapters', () => {
    const manifest = buildManifest({ mode: 'coordinator' });
    const sessionId = 'sess-contract';

    const claude = new ClaudeSpawner().buildPromptEnvelope(manifest, sessionId);
    const codex = new CodexSpawner().buildPromptEnvelope(manifest, sessionId);
    const gemini = new GeminiSpawner().buildPromptEnvelope(manifest, sessionId);

    expect(codex.system).toBe(claude.system);
    expect(gemini.system).toBe(claude.system);
    expect(codex.task).toBe(claude.task);
    expect(gemini.task).toBe(claude.task);
  });
});
