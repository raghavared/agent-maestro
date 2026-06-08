import { describe, it, expect } from 'vitest';
import {
  agentIsBusy,
  willOpenStatsOnClick,
  type ClickRoutingLink,
} from '../utils/sessionClickRouting';
import type { MaestroSession } from '../app/types/maestro';

type S = Pick<MaestroSession, 'status' | 'needsInput'>;

const live: ClickRoutingLink = { exited: false };
const dead: ClickRoutingLink = { exited: true };

describe('agentIsBusy', () => {
  it('treats working / spawning / needsInput as busy', () => {
    expect(agentIsBusy({ status: 'working' } as S)).toBe(true);
    expect(agentIsBusy({ status: 'spawning' } as S)).toBe(true);
    expect(
      agentIsBusy({ status: 'idle', needsInput: { active: true } } as S),
    ).toBe(true);
  });

  it('treats completed / failed / stopped / idle as not busy', () => {
    expect(agentIsBusy({ status: 'completed' } as S)).toBe(false);
    expect(agentIsBusy({ status: 'failed' } as S)).toBe(false);
    expect(agentIsBusy({ status: 'stopped' } as S)).toBe(false);
    expect(agentIsBusy({ status: 'idle' } as S)).toBe(false);
  });
});

describe('willOpenStatsOnClick — the LOCKED invariant', () => {
  // === LOCKED: tile Resume button is shown ⇔ willOpenStatsOnClick returns true.
  // Rule: a live PTY ALWAYS routes to the terminal (regardless of agent
  // busyness); only a missing/exited PTY routes to stats. This keeps resumed
  // sessions reachable after they go idle between turns.

  it('any live PTY → opens TERMINAL (Resume hidden), regardless of agent state', () => {
    expect(willOpenStatsOnClick({ status: 'working' } as S, live)).toBe(false);
    expect(
      willOpenStatsOnClick(
        { status: 'idle', needsInput: { active: true } } as S,
        live,
      ),
    ).toBe(false);
    // Idle / completed / stopped but still-live PTY (e.g. freshly resumed and
    // now between turns) must NOT route to stats — that was the resume-blank bug.
    expect(willOpenStatsOnClick({ status: 'completed' } as S, live)).toBe(false);
    expect(willOpenStatsOnClick({ status: 'stopped' } as S, live)).toBe(false);
    expect(willOpenStatsOnClick({ status: 'idle' } as S, live)).toBe(false);
  });

  it('dead/missing PTY → opens STATS (Resume shown), regardless of agent state', () => {
    expect(willOpenStatsOnClick({ status: 'working' } as S, dead)).toBe(true);
    expect(willOpenStatsOnClick({ status: 'working' } as S, null)).toBe(true);
    expect(willOpenStatsOnClick({ status: 'completed' } as S, null)).toBe(true);
    expect(willOpenStatsOnClick({ status: 'failed' } as S, dead)).toBe(true);
  });

  it('archived sessions follow the same rule — predicate is purely about the PTY, not the tab', () => {
    // Archived stamping lives outside this predicate (it routes the tile to
    // the Archived tab); for click-routing purposes, archived sessions follow
    // the same live-PTY rule as any other.
    expect(willOpenStatsOnClick({ status: 'stopped' } as S, null)).toBe(true);
    expect(willOpenStatsOnClick({ status: 'stopped' } as S, live)).toBe(false);
  });
});
