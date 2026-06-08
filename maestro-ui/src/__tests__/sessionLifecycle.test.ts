import { describe, it, expect } from 'vitest';
import {
  resolveSessionTab,
  buildChildrenByParent,
  collectSubtreeIds,
} from '../utils/sessionLifecycle';

describe('resolveSessionTab', () => {
  it('returns active when the subtree has a live terminal', () => {
    expect(resolveSessionTab({}, true)).toBe('active');
    expect(resolveSessionTab({ archivedAt: null }, true)).toBe('active');
  });

  it('returns inactive when there is no live terminal', () => {
    expect(resolveSessionTab({}, false)).toBe('inactive');
    expect(resolveSessionTab({ archivedAt: null }, false)).toBe('inactive');
  });

  it('returns archived when archivedAt is set, regardless of liveness', () => {
    expect(resolveSessionTab({ archivedAt: 123 }, false)).toBe('archived');
    expect(resolveSessionTab({ archivedAt: 123 }, true)).toBe('archived');
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
