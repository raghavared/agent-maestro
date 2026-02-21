import { useEffect, useMemo } from 'react';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { TaskList } from '../app/types/maestro';

export function useTaskLists(projectId: string | null | undefined) {
  const taskLists = useMaestroStore(s => s.taskLists);
  const taskListOrdering = useMaestroStore(s => s.taskListOrdering);
  const loading = useMaestroStore(s => s.loading);
  const errors = useMaestroStore(s => s.errors);
  const fetchTaskLists = useMaestroStore(s => s.fetchTaskLists);
  const fetchTaskListOrdering = useMaestroStore(s => s.fetchTaskListOrdering);

  useEffect(() => {
    if (!projectId) return;
    fetchTaskLists(projectId);
    fetchTaskListOrdering(projectId);
  }, [projectId, fetchTaskLists, fetchTaskListOrdering]);

  const listArray = useMemo(() => {
    if (!projectId) return [] as TaskList[];
    const lists = Array.from(taskLists.values()).filter(list => list.projectId === projectId);
    const ordering = taskListOrdering.get(projectId);
    if (!ordering || ordering.length === 0) {
      return lists;
    }
    const byId = new Map(lists.map(list => [list.id, list]));
    const ordered = ordering.map(id => byId.get(id)).filter(Boolean) as TaskList[];
    const missing = lists.filter(list => !ordering.includes(list.id));
    return [...ordered, ...missing];
  }, [projectId, taskLists, taskListOrdering]);

  const isLoading = projectId ? loading.has(`taskLists:${projectId}`) : false;
  const error = projectId ? errors.get(`taskLists:${projectId}`) : undefined;

  return {
    taskLists: listArray,
    loading: isLoading,
    error,
  };
}
