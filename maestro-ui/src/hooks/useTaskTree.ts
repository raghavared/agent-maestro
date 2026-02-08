import { useMemo } from 'react';
import type { MaestroTask, TaskTreeNode } from '../app/types/maestro';

export function useTaskTree(tasks: MaestroTask[]) {
  return useMemo(() => {
    const childrenMap = new Map<string | null, TaskTreeNode[]>();

    // Build tree nodes
    for (const task of tasks) {
      const node: TaskTreeNode = { ...task, children: [] };
      const parentKey = task.parentId ?? null;
      if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
      childrenMap.get(parentKey)!.push(node);
    }

    // Attach children recursively
    function attachChildren(node: TaskTreeNode): TaskTreeNode {
      node.children = childrenMap.get(node.id) || [];
      node.children.forEach(attachChildren);
      return node;
    }

    const roots = (childrenMap.get(null) || []).map(attachChildren);

    const getChildren = (taskId: string): TaskTreeNode[] =>
      childrenMap.get(taskId) || [];

    return { roots, getChildren };
  }, [tasks]);
}
