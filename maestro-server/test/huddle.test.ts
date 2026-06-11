/**
 * Tests for HuddleService.computeHuddles — connected components (union-find) over
 * the session-prompt graph. Each SessionPrompt is an undirected edge fromSessionId
 * <-> toSessionId. Seeds a connected {a,b,c} component and an isolated {d,e} pair.
 */

import { createHash } from 'crypto';

import { TestDataDir, createTestContainer, createTestProject, createTestSession } from './helpers';
import { SessionPrompt } from '../src/types';

function expectedHuddleId(sessionIds: string[]): string {
  const sorted = [...sessionIds].sort();
  const hash = createHash('sha1').update(sorted.join(',')).digest('hex');
  return `huddle_${hash.slice(0, 12)}`;
}

describe('HuddleService.computeHuddles', () => {
  let testDataDir: TestDataDir;
  let container: any;

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    container = await createTestContainer(testDataDir.getPath());
  });

  afterEach(async () => {
    await testDataDir.cleanup();
  });

  async function makeSession(name: string) {
    const project = await container.projectService.createProject(createTestProject({ name }));
    return container.sessionService.createSession(createTestSession(project.id, [], { name }));
  }

  function seedPrompt(from: string, to: string, timestamp: number): Promise<SessionPrompt> {
    const prompt: SessionPrompt = {
      id: `sp_${timestamp}_${from}_${to}`,
      fromSessionId: from,
      toSessionId: to,
      fromProjectId: null,
      toProjectId: null,
      content: `${from} -> ${to}`,
      mode: 'send',
      fromTeamMember: null,
      toTeamMember: null,
      fromSessionName: null,
      toSessionName: null,
      timestamp,
    };
    return container.sessionPromptRepo.create(prompt);
  }

  it('groups a->b, b->c into one huddle and d->e into a separate huddle', async () => {
    const [a, b, c, d, e] = await Promise.all([
      makeSession('A'),
      makeSession('B'),
      makeSession('C'),
      makeSession('D'),
      makeSession('E'),
    ]);

    // {a,b,c} component: three edges, seeded out of timestamp order.
    await seedPrompt(a.id, b.id, 1000);
    await seedPrompt(c.id, a.id, 3000);
    await seedPrompt(b.id, c.id, 2000);
    // {d,e} component: one edge, earliest activity so it sorts last.
    await seedPrompt(d.id, e.id, 500);

    const huddles = await container.huddleService.computeHuddles();

    expect(huddles).toHaveLength(2);

    // Sorted by lastActivity desc: {a,b,c} (3000) before {d,e} (500).
    const [first, second] = huddles;
    expect(first.lastActivity).toBe(3000);
    expect(second.lastActivity).toBe(500);

    expect(first.sessionIds).toEqual([a.id, b.id, c.id].sort());
    expect(first.promptCount).toBe(3);
    expect(first.prompts).toHaveLength(3);
    // Prompts within a huddle are sorted by timestamp ascending.
    expect(first.prompts.map((p: SessionPrompt) => p.timestamp)).toEqual([1000, 2000, 3000]);

    expect(second.sessionIds).toEqual([d.id, e.id].sort());
    expect(second.promptCount).toBe(1);

    // No overlap between the two components.
    expect(first.sessionIds).not.toContain(d.id);
    expect(first.sessionIds).not.toContain(e.id);
  });

  it('produces a stable id derived from the sorted sessionIds', async () => {
    const [a, b] = await Promise.all([makeSession('A'), makeSession('B')]);
    await seedPrompt(a.id, b.id, 100);

    const first = await container.huddleService.computeHuddles();
    const second = await container.huddleService.computeHuddles();

    expect(first[0].id).toBe(expectedHuddleId([a.id, b.id]));
    expect(first[0].id).toBe(second[0].id);
    expect(first[0].id).toMatch(/^huddle_/);
  });

  it('resolves session refs and falls back to nulls for unresolved sessions', async () => {
    const a = await makeSession('A');
    await seedPrompt(a.id, 'sess_missing', 100);

    const huddles = await container.huddleService.computeHuddles();
    expect(huddles).toHaveLength(1);

    const refs = huddles[0].sessions;
    const resolved = refs.find((r: any) => r.sessionId === a.id);
    const missing = refs.find((r: any) => r.sessionId === 'sess_missing');

    expect(resolved.sessionName).toBe('A');
    expect(missing.sessionName).toBeNull();
    expect(missing.projectId).toBeNull();
    expect(missing.teamMember).toBeNull();
  });
});
