import { useEffect, useMemo } from 'react';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { MaestroTask } from '../app/types/maestro';

/**
 * Hook to fetch and manage tasks for a session
 *
 * @param sessionId - The session ID to fetch tasks for
 * @returns Object with session, tasks array, loading state, and error
 */
export function useSessionTasks(sessionId: string | null | undefined) {
    const sessions = useMaestroStore(s => s.sessions);
    const tasks = useMaestroStore(s => s.tasks);
    const loadingSet = useMaestroStore(s => s.loading);
    const errors = useMaestroStore(s => s.errors);
    const fetchSession = useMaestroStore(s => s.fetchSession);

    // Fetch session to ensure we have taskIds
    useEffect(() => {
        if (sessionId) {
            fetchSession(sessionId);
        }
    }, [sessionId, fetchSession]);

    // Get session and its tasks
    const { session, sessionTasks } = useMemo(() => {
        if (!sessionId) return { session: null, sessionTasks: [] };

        const session = sessions.get(sessionId);
        if (!session) return { session: null, sessionTasks: [] };

        const sessionTasks = session.taskIds
            .map(taskId => tasks.get(taskId))
            .filter((task): task is MaestroTask => task !== undefined);

        return { session, sessionTasks };
    }, [sessions, tasks, sessionId]);

    const loading = sessionId ? loadingSet.has(`session:${sessionId}`) : false;
    const error = sessionId ? errors.get(`session:${sessionId}`) : undefined;

    return {
        session,
        tasks: sessionTasks,
        loading,
        error,
    };
}
