import { useEffect, useMemo } from 'react';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { MaestroSession } from '../app/types/maestro';

/**
 * Hook to fetch and manage sessions for a task
 *
 * @param taskId - The task ID to fetch sessions for
 * @returns Object with sessions array, loading state, and error
 */
export function useTaskSessions(taskId: string | null | undefined) {
    const sessions = useMaestroStore(s => s.sessions);
    const loadingSet = useMaestroStore(s => s.loading);
    const errors = useMaestroStore(s => s.errors);
    const fetchSessions = useMaestroStore(s => s.fetchSessions);

    // Fetch sessions for this task
    useEffect(() => {
        if (taskId) {
            fetchSessions(taskId);
        }
    }, [taskId, fetchSessions]);

    // Filter sessions that include this task
    const filteredSessions = useMemo(() => {
        if (!taskId) return [];
        return Array.from(sessions.values()).filter(
            session => {
                if (!session?.taskIds || !Array.isArray(session.taskIds)) {
                    console.warn('[useTaskSessions] Session missing taskIds:', session?.id, session);
                    return false;
                }
                return session.taskIds.includes(taskId);
            }
        );
    }, [sessions, taskId]);

    const loading = taskId ? loadingSet.has(`sessions:task:${taskId}`) : false;
    const error = taskId ? errors.get(`sessions:task:${taskId}`) : undefined;

    return {
        sessions: filteredSessions,
        loading,
        error,
    };
}
