import { useMemo } from 'react';
import { useMaestroStore } from '../stores/useMaestroStore';

export function useSubtaskProgress(taskId: string | null) {
  const tasks = useMaestroStore(s => s.tasks);

  return useMemo(() => {
    if (!taskId) return { completed: 0, total: 0, percentage: 0 };
    const children = Array.from(tasks.values()).filter(t => t.parentId === taskId);
    const total = children.length;
    const completed = children.filter(t => t.status === 'completed').length;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [tasks, taskId]);
}
