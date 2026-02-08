import { useMemo } from 'react';
import { useMaestroStore } from '../stores/useMaestroStore';

/**
 * Hook to get real-time session count for a task
 *
 * Computes the count from global sessions state (all sessions, including completed)
 * This ensures the count is always up-to-date with WebSocket updates
 *
 * @param taskId - The task ID to count sessions for
 * @returns The number of sessions containing this task
 */
export function useTaskSessionCount(taskId: string | null | undefined): number {
    const sessions = useMaestroStore(s => s.sessions);

    return useMemo(() => {
        if (!taskId) return 0;

        let count = 0;
        for (const session of sessions.values()) {
            if (session.taskIds.includes(taskId)) {
                count++;
            }
        }

        return count;
    }, [sessions, taskId]);
}
