import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { MaestroManifest } from '../../src/types/manifest.js';
import { PromptComposer } from '../../src/prompting/prompt-composer.js';
import { PromptBuilder } from '../../src/services/prompt-builder.js';

const ORIG_V2 = process.env.MAESTRO_PROMPT_IDENTITY_V2;

function buildManifest(overrides: Partial<MaestroManifest> = {}): MaestroManifest {
  return {
    manifestVersion: '1.0',
    mode: 'worker',
    tasks: [
      {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        acceptanceCriteria: ['Done'],
        projectId: 'proj-1',
        createdAt: '2026-05-31T00:00:00Z',
      },
    ],
    session: {
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    },
    ...overrides,
  };
}

describe('workspace_context block', () => {
  beforeEach(() => {
    process.env.MAESTRO_PROMPT_IDENTITY_V2 = 'true';
  });
  afterEach(() => {
    if (ORIG_V2 === undefined) delete process.env.MAESTRO_PROMPT_IDENTITY_V2;
    else process.env.MAESTRO_PROMPT_IDENTITY_V2 = ORIG_V2;
  });

  it('emits <workspace_context> when isMaster=true', () => {
    const manifest = buildManifest({ isMaster: true });
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).toContain('<workspace_context>');
    expect(envelope.system).toContain('You can reach any session in any project');
    expect(envelope.system).not.toContain('<master_project_context>');
  });

  it('emits <workspace_context> when masterProjects has >1 entries', () => {
    const manifest = buildManifest({
      isMaster: false,
      masterProjects: [
        { id: 'proj-1', name: 'Project 1', workingDir: '/proj1' },
        { id: 'proj-2', name: 'Project 2', workingDir: '/proj2' },
      ],
    });
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).toContain('<workspace_context>');
  });

  it('does NOT emit <workspace_context> when isMaster=false and only 1 project', () => {
    const manifest = buildManifest({
      isMaster: false,
      masterProjects: [{ id: 'proj-1', name: 'Project 1', workingDir: '/proj1' }],
    });
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).not.toContain('<workspace_context>');
  });

  it('does NOT emit <workspace_context> by default (no isMaster, no masterProjects)', () => {
    const manifest = buildManifest();
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).not.toContain('<workspace_context>');
    expect(envelope.system).not.toContain('<master_project_context>');
  });

  it('includes project list in <workspace_context> when masterProjects provided', () => {
    const manifest = buildManifest({
      isMaster: true,
      masterProjects: [
        { id: 'proj-a', name: 'Alpha', workingDir: '/alpha', isMaster: true },
        { id: 'proj-b', name: 'Beta', workingDir: '/beta' },
      ],
    });
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).toContain('id="proj-a"');
    expect(envelope.system).toContain('id="proj-b"');
    expect(envelope.system).toContain('isMaster="true"');
  });
});

describe('coordinator_promotion block', () => {
  beforeEach(() => {
    process.env.MAESTRO_PROMPT_IDENTITY_V2 = 'true';
  });
  afterEach(() => {
    if (ORIG_V2 === undefined) delete process.env.MAESTRO_PROMPT_IDENTITY_V2;
    else process.env.MAESTRO_PROMPT_IDENTITY_V2 = ORIG_V2;
  });

  it('emits <coordinator_promotion> for worker mode', () => {
    const manifest = buildManifest({ mode: 'worker' });
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).toContain('<coordinator_promotion>');
    expect(envelope.system).toContain('maestro coordinator enable');
  });

  it('emits <coordinator_promotion> for coordinated-worker mode', () => {
    const manifest = buildManifest({
      mode: 'coordinated-worker',
      coordinatorSessionId: 'sess-parent',
    });
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).toContain('<coordinator_promotion>');
  });

  it('does NOT emit <coordinator_promotion> for coordinator mode', () => {
    const manifest = buildManifest({
      mode: 'coordinator',
      teamMemberProfiles: [
        { id: 'tm-1', name: 'Lead', avatar: 'L', identity: 'Lead identity' },
      ],
    });
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).not.toContain('<coordinator_promotion>');
  });

  it('does NOT emit <coordinator_promotion> for coordinated-coordinator mode', () => {
    const manifest = buildManifest({
      mode: 'coordinated-coordinator',
      coordinatorSessionId: 'sess-parent',
      teamMemberProfiles: [
        { id: 'tm-1', name: 'Lead', avatar: 'L', identity: 'Lead identity' },
      ],
    });
    const composer = new PromptComposer();
    const envelope = composer.compose(manifest);
    expect(envelope.system).not.toContain('<coordinator_promotion>');
  });

  it('buildCoordinatorPromotionBlock returns null for coordinator mode', () => {
    const builder = new PromptBuilder();
    const manifest = buildManifest({ mode: 'coordinator' });
    expect(builder.buildCoordinatorPromotionBlock(manifest)).toBeNull();
  });

  it('buildCoordinatorPromotionBlock returns block for worker mode', () => {
    const builder = new PromptBuilder();
    const manifest = buildManifest({ mode: 'worker' });
    const block = builder.buildCoordinatorPromotionBlock(manifest);
    expect(block).not.toBeNull();
    expect(block).toContain('<coordinator_promotion>');
  });
});
