import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { MaestroTask } from '../app/types/maestro';

/**
 * Hook to fetch and manage tasks for a project
 *
 * @param projectId - The project ID to fetch tasks for
 * @returns Object with tasks array, loading state, and error
 */
export function useTasks(projectId: string | null | undefined) {
    const { tasks, loading, errors, fetchTasks } = useMaestroStore(
        useShallow(s => ({ tasks: s.tasks, loading: s.loading, errors: s.errors, fetchTasks: s.fetchTasks }))
    );

    // Fetch tasks when projectId changes
    useEffect(() => {
        if (projectId) {
            fetchTasks(projectId);
        }
    }, [projectId, fetchTasks]);

    // Filter tasks for this project
    const filteredTasks = useMemo(() => {
        if (!projectId) return [];
        return Object.values(tasks).filter(
            task => task.projectId === projectId
        );
    }, [tasks, projectId]);

    const isLoading = projectId ? !!loading[`tasks:${projectId}`] : false;
    const error = projectId ? errors[`tasks:${projectId}`] : undefined;

    return {
        tasks: filteredTasks,
        loading: isLoading,
        error,
    };
}
