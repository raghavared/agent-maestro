import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { MaestroSession } from '../app/types/maestro';

/**
 * Hook to fetch and manage sessions for a task
 *
 * @param taskId - The task ID to fetch sessions for
 * @returns Object with sessions array, loading state, and error
 */
export function useTaskSessions(taskId: string | null | undefined) {
    const { sessions, loadingSet, errors, fetchSessions } = useMaestroStore(
        useShallow(s => ({ sessions: s.sessions, loadingSet: s.loading, errors: s.errors, fetchSessions: s.fetchSessions }))
    );

    // Fetch sessions for this task
    useEffect(() => {
        if (taskId) {
            fetchSessions(taskId);
        }
    }, [taskId, fetchSessions]);

    // Filter sessions that include this task
    const filteredSessions = useMemo(() => {
        if (!taskId) return [];
        return Object.values(sessions).filter(
            session => {
                if (!session?.taskIds || !Array.isArray(session.taskIds)) {
                    return false;
                }
                return session.taskIds.includes(taskId);
            }
        );
    }, [sessions, taskId]);

    const loading = taskId ? !!loadingSet[`sessions:task:${taskId}`] : false;
    const error = taskId ? errors[`sessions:task:${taskId}`] : undefined;

    return {
        sessions: filteredSessions,
        loading,
        error,
    };
}
