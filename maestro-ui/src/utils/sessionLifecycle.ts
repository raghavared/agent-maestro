import type { MaestroSession } from '../app/types/maestro';

export type SessionSubTab = 'active' | 'inactive' | 'archived';

// The tab a session (tree root) belongs to.
// Archived (archivedAt set) always wins. Otherwise liveness decides: a root is
// Active when it (or any session in its spawn subtree) has a live terminal,
// else Inactive. humanCompletedAt is a marker only — it does NOT pick the tab.
export function resolveSessionTab(
  session: Pick<MaestroSession, 'archivedAt'>,
  hasLiveTerminal: boolean,
): SessionSubTab {
  if (session.archivedAt) return 'archived';
  return hasLiveTerminal ? 'active' : 'inactive';
}

// Build a parentSessionId → child ids index for the given sessions.
export function buildChildrenByParent(
  sessions: Array<{ id: string; parentSessionId?: string | null }>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const s of sessions) {
    const pid = s.parentSessionId;
    if (!pid) continue;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(s.id);
  }
  return map;
}

// All session ids in the spawn subtree rooted at rootId (inclusive). Cycle-safe.
export function collectSubtreeIds(
  rootId: string,
  childrenByParent: Map<string, string[]>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    const kids = childrenByParent.get(id);
    if (kids) stack.push(...kids);
  }
  return out;
}
