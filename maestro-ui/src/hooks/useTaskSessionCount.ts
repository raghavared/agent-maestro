import { useCallback } from 'react';
import { useMaestroStore } from '../stores/useMaestroStore';

/**
 * Hook to get real-time session count for a task.
 * Returns a primitive number — Zustand skips re-render when the count is unchanged.
 */
export function useTaskSessionCount(taskId: string | null | undefined): number {
    return useMaestroStore(
        useCallback(
            (s) => {
                if (!taskId) return 0;
                let count = 0;
                for (const session of Object.values(s.sessions)) {
                    if (session.taskIds?.includes(taskId)) count++;
                }
                return count;
            },
            [taskId],
        ),
    );
}
