import { describe, it, expect } from 'vitest';
import {
  resolveSessionTab,
  buildChildrenByParent,
  collectSubtreeIds,
} from '../utils/sessionLifecycle';

describe('resolveSessionTab', () => {
  it('returns open for a fresh session with no stamps', () => {
    expect(resolveSessionTab({})).toBe('open');
    expect(resolveSessionTab({ archivedAt: null, humanCompletedAt: null })).toBe('open');
  });

  it('returns done when humanCompletedAt is set', () => {
    expect(resolveSessionTab({ humanCompletedAt: 123 })).toBe('done');
    expect(resolveSessionTab({ archivedAt: null, humanCompletedAt: 456 })).toBe('done');
  });

  it('returns archived when archivedAt is set, regardless of humanCompletedAt', () => {
    expect(resolveSessionTab({ archivedAt: 123 })).toBe('archived');
    expect(resolveSessionTab({ archivedAt: 123, humanCompletedAt: 456 })).toBe('archived');
  });

  // Option 3 invariant: tabs are driven only by the two persisted intent stamps.
  // Terminal liveness and the unreliable `status` field are NOT routing inputs —
  // they're decoration only — so a session's tab is stable across app restarts.
  it('ignores status and liveness — only archivedAt/humanCompletedAt drive the tab', () => {
    expect(resolveSessionTab({ status: 'working' } as any)).toBe('open');
    expect(resolveSessionTab({ status: 'stopped', humanCompletedAt: 1 } as any)).toBe('done');
    expect(resolveSessionTab({ status: 'working', archivedAt: 1 } as any)).toBe('archived');
  });
});

describe('buildChildrenByParent / collectSubtreeIds', () => {
  const sessions = [
    { id: 'root', parentSessionId: null },
    { id: 'a', parentSessionId: 'root' },
    { id: 'b', parentSessionId: 'root' },
    { id: 'a1', parentSessionId: 'a' },
    { id: 'lone', parentSessionId: null },
  ];

  it('indexes children by their parent', () => {
    const map = buildChildrenByParent(sessions);
    expect(map.get('root')).toEqual(['a', 'b']);
    expect(map.get('a')).toEqual(['a1']);
    expect(map.has('lone')).toBe(false);
  });

  it('collects the full subtree inclusive of the root', () => {
    const map = buildChildrenByParent(sessions);
    expect(collectSubtreeIds('root', map).sort()).toEqual(['a', 'a1', 'b', 'root']);
    expect(collectSubtreeIds('a', map).sort()).toEqual(['a', 'a1']);
    expect(collectSubtreeIds('lone', map)).toEqual(['lone']);
  });

  it('is cycle-safe', () => {
    const cyclic = [
      { id: 'x', parentSessionId: 'y' },
      { id: 'y', parentSessionId: 'x' },
    ];
    const map = buildChildrenByParent(cyclic);
    expect(collectSubtreeIds('x', map).sort()).toEqual(['x', 'y']);
  });
});
