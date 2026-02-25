import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AgentMode, MaestroManifest, TeamMemberData, TeamMemberProfile } from '../../src/types/manifest.js';
import { PromptComposer } from '../../src/prompting/prompt-composer.js';
import { ClaudeSpawner } from '../../src/services/claude-spawner.js';
import { CodexSpawner } from '../../src/services/codex-spawner.js';
import { GeminiSpawner } from '../../src/services/gemini-spawner.js';

const ORIGINAL_V2_FLAG = process.env.MAESTRO_PROMPT_IDENTITY_V2;
const ORIGINAL_COORD_POLICY = process.env.MAESTRO_PROMPT_IDENTITY_COORDINATOR_POLICY;

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

function defaultTeam(selfId = 'tm-self'): TeamMemberData[] {
  return [
    {
      id: selfId,
      name: 'Self',
      role: 'Owner',
      identity: 'Self identity',
      avatar: 'S',
      mode: 'worker',
      permissionMode: 'acceptEdits',
      model: 'sonnet',
      agentTool: 'claude-code',
    },
    {
      id: 'tm-alpha',
      name: 'Alpha',
      role: 'Backend Engineer',
      identity: 'Design backend services',
      avatar: 'A',
      mode: 'worker',
      permissionMode: 'readOnly',
      model: 'sonnet',
      agentTool: 'codex',
      capabilities: {
        canUseMasterCommands: true,
      },
      commandPermissions: {
        groups: {
          task: true,
        },
        commands: {
          'task:get': true,
        },
      },
      memory: ['Prefers small, safe changes'],
    },
    {
      id: 'tm-beta',
      name: 'Beta',
      role: 'QA Engineer',
      identity: 'Build test plans',
      avatar: 'B',
      mode: 'worker',
      permissionMode: 'acceptEdits',
      model: 'opus',
      agentTool: 'claude-code',
    },
  ];
}

function singleSelfProfile(selfId = 'tm-self'): TeamMemberProfile[] {
  return [
    {
      id: selfId,
      name: 'Self',
      role: 'Lead Engineer',
      avatar: 'S',
      identity: 'Execute and report',
      memory: ['Keep changes scoped'],
    },
  ];
}

function multiSelfProfiles(): TeamMemberProfile[] {
  return [
    {
      id: 'tm-self-a',
      name: 'Self A',
      role: 'Backend Engineer',
      avatar: 'A',
      identity: 'Backend ownership',
      memory: ['Strict on tests'],
    },
    {
      id: 'tm-self-b',
      name: 'Self B',
      role: 'Infra Engineer',
      avatar: 'B',
      identity: 'Infra ownership',
      memory: ['Prefer deterministic deploys'],
    },
  ];
}

describe('prompt-composer', () => {
  beforeEach(() => {
    delete process.env.MAESTRO_PROMPT_IDENTITY_V2;
    delete process.env.MAESTRO_PROMPT_IDENTITY_COORDINATOR_POLICY;
  });

  afterEach(() => {
    if (ORIGINAL_V2_FLAG === undefined) {
      delete process.env.MAESTRO_PROMPT_IDENTITY_V2;
    } else {
      process.env.MAESTRO_PROMPT_IDENTITY_V2 = ORIGINAL_V2_FLAG;
    }
    if (ORIGINAL_COORD_POLICY === undefined) {
      delete process.env.MAESTRO_PROMPT_IDENTITY_COORDINATOR_POLICY;
    } else {
      process.env.MAESTRO_PROMPT_IDENTITY_COORDINATOR_POLICY = ORIGINAL_COORD_POLICY;
    }
  });

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

  it('keeps prompt envelope semantics consistent across Claude/Codex/Gemini adapters', () => {
    const manifest = buildManifest({
      mode: 'coordinator',
      teamMemberProfiles: [
        {
          id: 'tm-coordinator',
          name: 'Coordinator Self',
          role: 'Coordinator',
          avatar: 'C',
          identity: 'Coordinate and delegate work',
        },
      ],
    });
    const sessionId = 'sess-contract';

    const claude = new ClaudeSpawner().buildPromptEnvelope(manifest, sessionId);
    const codex = new CodexSpawner().buildPromptEnvelope(manifest, sessionId);
    const gemini = new GeminiSpawner().buildPromptEnvelope(manifest, sessionId);

    expect(codex.system).toBe(claude.system);
    expect(gemini.system).toBe(claude.system);
    expect(codex.task).toBe(claude.task);
    expect(gemini.task).toBe(claude.task);
  });

  describe('identity-kernel v2 matrix', () => {
    const modes: Array<{ mode: AgentMode; expectedLens: string }> = [
      { mode: 'worker', expectedLens: 'full_expertise' },
      { mode: 'coordinator', expectedLens: 'slim_roster' },
      { mode: 'coordinated-worker', expectedLens: 'full_expertise' },
      { mode: 'coordinated-coordinator', expectedLens: 'slim_roster' },
    ];

    const scenarios = ['no-self', 'single-self', 'multi-self', 'team-overlap'] as const;

    for (const { mode, expectedLens } of modes) {
      for (const scenario of scenarios) {
        it(`renders mode=${mode} scenario=${scenario}`, () => {
          process.env.MAESTRO_PROMPT_IDENTITY_V2 = 'true';

          const base = buildManifest({
            mode,
            availableTeamMembers: defaultTeam('tm-self'),
            coordinatorSessionId: mode.startsWith('coordinated') ? 'sess-parent' : undefined,
          });

          if (scenario === 'single-self') {
            base.teamMemberProfiles = singleSelfProfile('tm-self');
          }
          if (scenario === 'multi-self') {
            base.teamMemberProfiles = multiSelfProfiles();
          }
          if (scenario === 'team-overlap') {
            base.teamMemberProfiles = singleSelfProfile('tm-self');
            base.availableTeamMembers = defaultTeam('tm-self');
          }

          const compose = () => new PromptComposer().compose(base, { sessionId: 'sess-xyz' });
          const coordinatorMode = mode === 'coordinator' || mode === 'coordinated-coordinator';
          const shouldFail = coordinatorMode && (scenario === 'no-self' || scenario === 'multi-self');

          if (shouldFail) {
            expect(compose).toThrowErrorMatchingSnapshot();
            return;
          }

          const envelope = compose();
          expect(envelope.system).toContain('<identity_kernel>');
          expect(envelope.system).toContain(`<team_context lens="${expectedLens}"`);
          expect(envelope.task).not.toContain('<coordinator_session_id>');

          if (mode.startsWith('coordinated')) {
            expect(envelope.system).toContain('<coordination_context>');
            expect(envelope.system).toContain('<coordinator_session_id>sess-parent</coordinator_session_id>');
          } else {
            expect(envelope.system).not.toContain('<coordination_context>');
          }

          if (scenario === 'no-self') {
            expect(envelope.system).not.toContain('<self_identity>');
          }
          if (scenario === 'single-self') {
            expect(envelope.system).toContain('<self_identity>');
          }
          if (scenario === 'multi-self') {
            expect(envelope.system).toContain('merged="true"');
            expect(envelope.system).toContain('<expertise source="Self A" id="tm-self-a">');
          }
          if (scenario === 'team-overlap') {
            expect(envelope.system).not.toContain('id="tm-self" name="Self" role="Owner"');
          }

          expect(envelope.system).toMatchSnapshot();
          expect(envelope.task).toMatchSnapshot();
        });
      }
    }

    it('renders coordinated directives under coordination_context when present', () => {
      process.env.MAESTRO_PROMPT_IDENTITY_V2 = 'true';

      const manifest = buildManifest({
        mode: 'coordinated-worker',
        coordinatorSessionId: 'sess-parent',
        teamMemberProfiles: singleSelfProfile('tm-self'),
        availableTeamMembers: defaultTeam('tm-self'),
        initialDirective: {
          subject: 'Implement phase 1',
          message: 'Start with API contract and report milestone.',
          fromSessionId: 'sess-parent',
        },
      });

      const envelope = new PromptComposer().compose(manifest, { sessionId: 'sess-coord' });

      expect(envelope.system).toContain('<coordination_context>');
      expect(envelope.system).toContain('<directive>');
      expect(envelope.system).toContain('<subject>Implement phase 1</subject>');
      expect(envelope.system).toContain('<from_session_id>sess-parent</from_session_id>');
      expect(envelope.system).toMatchSnapshot();
      expect(envelope.task).toMatchSnapshot();
    });

    it('supports permissive fallback for coordinator multi-self in v2', () => {
      process.env.MAESTRO_PROMPT_IDENTITY_V2 = 'true';
      process.env.MAESTRO_PROMPT_IDENTITY_COORDINATOR_POLICY = 'permissive';

      const manifest = buildManifest({
        mode: 'coordinator',
        teamMemberProfiles: [
          { id: 'tm-first', name: 'First', avatar: '1', identity: 'First identity' },
          { id: 'tm-second', name: 'Second', avatar: '2', identity: 'Second identity' },
        ],
        availableTeamMembers: defaultTeam('tm-first'),
      });

      const envelope = new PromptComposer().compose(manifest, { sessionId: 'sess-permissive' });
      expect(envelope.system).toContain('<id>tm-first</id>');
      expect(envelope.system).not.toContain('<id>tm-second</id>');
    });
  });
});
