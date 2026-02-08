import { useMemo } from 'react';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { MaestroTask } from '../app/types/maestro';

export function useTaskBreadcrumb(taskId: string | null): MaestroTask[] {
  const tasks = useMaestroStore(s => s.tasks);

  return useMemo(() => {
    if (!taskId) return [];
    const breadcrumb: MaestroTask[] = [];
    let current = tasks.get(taskId);
    while (current) {
      breadcrumb.unshift(current);
      current = current.parentId ? tasks.get(current.parentId) : undefined;
    }
    return breadcrumb;
  }, [tasks, taskId]);
}
