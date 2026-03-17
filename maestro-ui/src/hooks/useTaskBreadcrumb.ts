import { useMaestroStore } from '../stores/useMaestroStore';
import { useShallow } from 'zustand/react/shallow';
import type { MaestroTask } from '../app/types/maestro';

const EMPTY: MaestroTask[] = [];

export function useTaskBreadcrumb(taskId: string | null): MaestroTask[] {
  return useMaestroStore(
    useShallow((s) => {
      if (!taskId) return EMPTY;
      const result: MaestroTask[] = [];
      let current: MaestroTask | undefined = s.tasks[taskId];
      while (current) {
        result.unshift(current);
        current = current.parentId ? s.tasks[current.parentId] : undefined;
      }
      return result.length === 0 ? EMPTY : result;
    }),
  );
}
