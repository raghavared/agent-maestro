import { useEffect, useMemo } from 'react';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { MaestroTask } from '../app/types/maestro';

/**
 * Hook to fetch and manage tasks for a project
 *
 * @param projectId - The project ID to fetch tasks for
 * @returns Object with tasks array, loading state, and error
 */
export function useTasks(projectId: string | null | undefined) {
    const tasks = useMaestroStore(s => s.tasks);
    const loading = useMaestroStore(s => s.loading);
    const errors = useMaestroStore(s => s.errors);
    const fetchTasks = useMaestroStore(s => s.fetchTasks);

    // Fetch tasks when projectId changes
    useEffect(() => {
        if (projectId) {
            fetchTasks(projectId);
        }
    }, [projectId, fetchTasks]);

    // Filter tasks for this project
    const filteredTasks = useMemo(() => {
        if (!projectId) return [];
        return Array.from(tasks.values()).filter(
            task => task.projectId === projectId
        );
    }, [tasks, projectId]);

    const isLoading = projectId ? loading.has(`tasks:${projectId}`) : false;
    const error = projectId ? errors.get(`tasks:${projectId}`) : undefined;

    return {
        tasks: filteredTasks,
        loading: isLoading,
        error,
    };
}
