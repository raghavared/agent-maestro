import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { TaskList } from '../app/types/maestro';

export function useTaskLists(projectId: string | null | undefined) {
  const { taskLists, taskListOrdering, loading, errors, fetchTaskLists, fetchTaskListOrdering } = useMaestroStore(
    useShallow(s => ({ taskLists: s.taskLists, taskListOrdering: s.taskListOrdering, loading: s.loading, errors: s.errors, fetchTaskLists: s.fetchTaskLists, fetchTaskListOrdering: s.fetchTaskListOrdering }))
  );

  useEffect(() => {
    if (!projectId) return;
    fetchTaskLists(projectId);
    fetchTaskListOrdering(projectId);
  }, [projectId, fetchTaskLists, fetchTaskListOrdering]);

  const listArray = useMemo(() => {
    if (!projectId) return [] as TaskList[];
    const lists = Object.values(taskLists).filter(list => list.projectId === projectId);
    const ordering = taskListOrdering[projectId];
    if (!ordering || ordering.length === 0) {
      return lists;
    }
    const byId: Record<string, TaskList> = {};
    for (const list of lists) byId[list.id] = list;
    const ordered = ordering.map(id => byId[id]).filter(Boolean) as TaskList[];
    const missing = lists.filter(list => !ordering.includes(list.id));
    return [...ordered, ...missing];
  }, [projectId, taskLists, taskListOrdering]);

  const isLoading = projectId ? !!loading[`taskLists:${projectId}`] : false;
  const error = projectId ? errors[`taskLists:${projectId}`] : undefined;

  return {
    taskLists: listArray,
    loading: isLoading,
    error,
  };
}
