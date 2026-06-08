import type { MaestroSession } from "../app/types/maestro";

export interface ResolvedTeamView {
  /** The current root session. */
  root: MaestroSession;
  /** Direct children of root (by parentSessionId), ordered by start time. */
  children: MaestroSession[];
  /** Breadcrumb path trueRoot → … → root (inclusive). */
  trail: MaestroSession[];
}

/**
 * Resolves the hierarchical Team View from the spawn hierarchy.
 *
 * Structure is keyed entirely off `parentSessionId` (the same data the sidebar
 * tree uses). The breadcrumb walk and the missing-parent stop are cycle-safe via
 * a seen-set, so a malformed parent chain can't infinite-loop.
 *
 * Returns `null` when there is no root id or the root no longer resolves (e.g.
 * the rooted session was removed) — the caller should treat that as "closed".
 */
export function resolveTeamView(
  rootId: string | null,
  sessions: Record<string, MaestroSession>,
): ResolvedTeamView | null {
  if (!rootId) return null;
  const root = sessions[rootId];
  if (!root) return null;

  const children = Object.values(sessions)
    .filter((s) => s.parentSessionId === root.id)
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  const trail: MaestroSession[] = [];
  const seen = new Set<string>();
  let cur: MaestroSession | undefined = root;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    trail.unshift(cur);
    cur = cur.parentSessionId ? sessions[cur.parentSessionId] : undefined;
  }

  return { root, children, trail };
}

/**
 * Builds a predicate that reports whether a session has any direct children in
 * the spawn hierarchy. Computed once over the full session set so each Team View
 * slot can decide whether it's drillable.
 */
export function buildHasChildrenPredicate(
  sessions: Record<string, MaestroSession>,
): (sessionId: string) => boolean {
  const parentIds = new Set<string>();
  for (const s of Object.values(sessions)) {
    if (s.parentSessionId) parentIds.add(s.parentSessionId);
  }
  return (sessionId: string) => parentIds.has(sessionId);
}

export interface ChildStats {
  /** Number of direct children (sub-agents). */
  total: number;
  /** Children that are actively running (working / spawning). */
  active: number;
  /** Children that are idle, done, or otherwise not running. */
  inactive: number;
}

const ACTIVE_STATUSES = new Set(['working', 'spawning']);

/**
 * Builds a function returning the direct-children stats for a session: total
 * sub-agents plus an active/inactive breakdown by status. Computed once over the
 * full session set so each Team View slot can show its sub-agent counts.
 */
export function buildChildStatsFn(
  sessions: Record<string, MaestroSession>,
): (sessionId: string) => ChildStats {
  const byParent = new Map<string, MaestroSession[]>();
  for (const s of Object.values(sessions)) {
    if (!s.parentSessionId) continue;
    const arr = byParent.get(s.parentSessionId);
    if (arr) arr.push(s);
    else byParent.set(s.parentSessionId, [s]);
  }
  return (sessionId: string): ChildStats => {
    const kids = byParent.get(sessionId) ?? [];
    let active = 0;
    for (const k of kids) {
      if (ACTIVE_STATUSES.has(k.status)) active++;
    }
    return { total: kids.length, active, inactive: kids.length - active };
  };
}
