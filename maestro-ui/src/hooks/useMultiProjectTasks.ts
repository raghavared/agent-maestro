import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { MaestroTask } from '../app/types/maestro';

export type BoardTask = MaestroTask & {
    projectName: string;
    projectColor: string;
};

const PROJECT_COLORS = [
    '#00d9ff', // cyan
    '#ff6464', // red
    '#ffb000', // amber
    '#4ade80', // green
    '#a78bfa', // purple
    '#f472b6', // pink
    '#fb923c', // orange
    '#38bdf8', // sky
];

export function getProjectColor(index: number): string {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

/**
 * Hook to fetch and manage tasks for multiple projects in parallel.
 * Returns merged task array with project metadata (name, color) attached.
 */
export function useMultiProjectTasks(
    projectIds: string[],
    projectNames: Map<string, string>,
    projectColors: Map<string, string>,
) {
    const { tasks, loading, errors, fetchTasks } = useMaestroStore(
        useShallow(s => ({ tasks: s.tasks, loading: s.loading, errors: s.errors, fetchTasks: s.fetchTasks }))
    );

    // Fetch tasks for each selected project
    useEffect(() => {
        for (const projectId of projectIds) {
            fetchTasks(projectId);
        }
    }, [projectIds, fetchTasks]);

    // Filter and enrich tasks for selected projects
    const boardTasks = useMemo(() => {
        const projectIdSet = new Set(projectIds);
        const result: BoardTask[] = [];

        for (const task of Object.values(tasks)) {
            if (projectIdSet.has(task.projectId)) {
                result.push({
                    ...task,
                    projectName: projectNames.get(task.projectId) ?? 'Unknown',
                    projectColor: projectColors.get(task.projectId) ?? PROJECT_COLORS[0],
                });
            }
        }

        return result;
    }, [tasks, projectIds, projectNames, projectColors]);

    // Aggregate loading/error states
    const isLoading = projectIds.some((id) => !!loading[`tasks:${id}`]);
    const errorMessages = projectIds
        .map((id) => errors[`tasks:${id}`])
        .filter(Boolean);

    return {
        tasks: boardTasks,
        loading: isLoading,
        errors: errorMessages as string[],
    };
}
