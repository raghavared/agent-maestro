import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { MaestroTask } from '../app/types/maestro';

/**
 * Hook to fetch and manage tasks for a session
 *
 * @param sessionId - The session ID to fetch tasks for
 * @returns Object with session, tasks array, loading state, and error
 */
export function useSessionTasks(sessionId: string | null | undefined) {
    const { sessions, tasks, loadingSet, errors, fetchSession } = useMaestroStore(
        useShallow(s => ({ sessions: s.sessions, tasks: s.tasks, loadingSet: s.loading, errors: s.errors, fetchSession: s.fetchSession }))
    );

    // Fetch session to ensure we have taskIds
    useEffect(() => {
        if (sessionId) {
            fetchSession(sessionId);
        }
    }, [sessionId, fetchSession]);

    // Get session and its tasks
    const { session, sessionTasks } = useMemo(() => {
        if (!sessionId) return { session: null, sessionTasks: [] };

        const session = sessions[sessionId];
        if (!session) return { session: null, sessionTasks: [] };

        const sessionTasks = session.taskIds
            .map(taskId => tasks[taskId])
            .filter((task): task is MaestroTask => task !== undefined);

        return { session, sessionTasks };
    }, [sessions, tasks, sessionId]);

    const loading = sessionId ? !!loadingSet[`session:${sessionId}`] : false;
    const error = sessionId ? errors[`session:${sessionId}`] : undefined;

    return {
        session,
        tasks: sessionTasks,
        loading,
        error,
    };
}
