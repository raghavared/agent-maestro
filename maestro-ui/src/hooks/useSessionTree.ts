import { useMemo } from 'react';
import type { MaestroSession, SessionTreeNode } from '../app/types/maestro';

// Build a parent→child tree of maestro sessions using the spawn chain
// (parentSessionId). A session whose parent is not in the current set is
// promoted to a root, so cross-project / out-of-scope parents don't hide it.
export function useSessionTree(sessions: MaestroSession[]) {
  return useMemo(() => {
    const idSet = new Set(sessions.map((s) => s.id));
    const childrenMap = new Map<string | null, SessionTreeNode[]>();

    for (const session of sessions) {
      const node: SessionTreeNode = { ...session, children: [] };
      const parentKey =
        session.parentSessionId && idSet.has(session.parentSessionId)
          ? session.parentSessionId
          : null;
      if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
      childrenMap.get(parentKey)!.push(node);
    }

    function attachChildren(node: SessionTreeNode): SessionTreeNode {
      node.children = childrenMap.get(node.id) || [];
      node.children.forEach(attachChildren);
      return node;
    }

    const roots = (childrenMap.get(null) || []).map(attachChildren);

    const getChildren = (sessionId: string): SessionTreeNode[] =>
      childrenMap.get(sessionId) || [];

    return { roots, getChildren };
  }, [sessions]);
}
