import { useMaestroStore } from '../stores/useMaestroStore';
import { useShallow } from 'zustand/react/shallow';

const EMPTY = { completed: 0, total: 0, percentage: 0 };

export function useSubtaskProgress(taskId: string | null) {
  return useMaestroStore(
    useShallow((s) => {
      if (!taskId) return EMPTY;
      let total = 0;
      let completed = 0;
      for (const t of Object.values(s.tasks)) {
        if (t.parentId === taskId) {
          total++;
          if (t.status === 'completed') completed++;
        }
      }
      if (total === 0) return EMPTY;
      return { completed, total, percentage: Math.round((completed / total) * 100) };
    }),
  );
}
