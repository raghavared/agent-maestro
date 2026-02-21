import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTaskLists } from "../../hooks/useTaskLists";
import { useTasks } from "../../hooks/useTasks";
import { useMaestroStore } from "../../stores/useMaestroStore";
import type { MaestroTask, TaskList } from "../../app/types/maestro";
import { TaskListModal } from "./TaskListModal";
import { TaskListAddTasksModal } from "./TaskListAddTasksModal";
import { ConfirmActionModal } from "../modals/ConfirmActionModal";

const emptySet = new Set<string>();

function SortableWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`taskListSortable ${isDragging ? "taskListSortable--dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

type TaskListTasksProps = {
  list: TaskList;
  tasksById: Map<string, MaestroTask>;
  onRemoveTask: (taskId: string) => void;
  onReorder: (orderedTaskIds: string[]) => void;
  onMoveTask: (taskId: string, delta: number) => void;
};

function TaskListTasks({ list, tasksById, onRemoveTask, onReorder, onMoveTask }: TaskListTasksProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const taskIds = list.orderedTaskIds || [];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = taskIds.findIndex(id => id === active.id);
    const newIndex = taskIds.findIndex(id => id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(taskIds, oldIndex, newIndex));
  };

  if (taskIds.length === 0) {
    return <div className="taskListEmptyTasks">No tasks yet. Add tasks to populate this list.</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="taskListTasks">
          {taskIds.map((taskId, index) => {
            const task = tasksById.get(taskId);
            const isMissing = !task;
            return (
              <SortableWrapper key={taskId} id={taskId}>
                <div className={`taskListTaskRow ${isMissing ? "taskListTaskRow--missing" : ""}`}>
                  <div className="taskListTaskRowLeft">
                    <div className="taskListTaskTitle">
                      {task ? task.title : `Missing task reference (${taskId})`}
                    </div>
                    {task ? (
                      <div className="taskListTaskMeta">
                        <span className={`taskListItemStatusBadge taskListItemStatusBadge--${task.status}`}>{task.status.replace('_', ' ')}</span>
                        <span className={`taskListItemPriorityBadge taskListItemPriorityBadge--${task.priority}`}>{task.priority}</span>
                      </div>
                    ) : (
                      <div className="taskListTaskMeta">Task no longer exists</div>
                    )}
                  </div>
                  <div className="taskListTaskRowActions">
                    <button
                      className="taskListActionBtn"
                      onClick={() => onMoveTask(taskId, -1)}
                      disabled={index === 0}
                      aria-label="Move task up"
                    >
                      ↑
                    </button>
                    <button
                      className="taskListActionBtn"
                      onClick={() => onMoveTask(taskId, 1)}
                      disabled={index === taskIds.length - 1}
                      aria-label="Move task down"
                    >
                      ↓
                    </button>
                    <button className="taskListActionBtn taskListActionBtn--danger" onClick={() => onRemoveTask(taskId)}>
                      Remove
                    </button>
                  </div>
                </div>
              </SortableWrapper>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

type TaskListsPanelProps = {
  projectId: string;
  createListSignal?: number;
};

export function TaskListsPanel({ projectId, createListSignal }: TaskListsPanelProps) {
  const { taskLists, loading, error } = useTaskLists(projectId);
  const { tasks } = useTasks(projectId);
  const saveTaskListOrdering = useMaestroStore(s => s.saveTaskListOrdering);
  const addTaskToList = useMaestroStore(s => s.addTaskToList);
  const removeTaskFromList = useMaestroStore(s => s.removeTaskFromList);
  const reorderTaskListTasks = useMaestroStore(s => s.reorderTaskListTasks);
  const deleteTaskList = useMaestroStore(s => s.deleteTaskList);

  const [expandedLists, setExpandedLists] = useState<Set<string>>(emptySet);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [addingTasksList, setAddingTasksList] = useState<TaskList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskList | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const createSignalRef = useRef<number | undefined>(createListSignal);

  const tasksById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const listOrder = useMemo(() => taskLists.map(list => list.id), [taskLists]);

  useEffect(() => {
    if (createListSignal === undefined) return;
    if (createSignalRef.current === undefined) {
      createSignalRef.current = createListSignal;
      return;
    }
    if (createListSignal !== createSignalRef.current) {
      setEditingList({} as TaskList);
      createSignalRef.current = createListSignal;
    }
  }, [createListSignal]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleExpanded = (listId: string) => {
    setExpandedLists(prev => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  const handleListReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = listOrder.indexOf(active.id as string);
    const newIndex = listOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrder = arrayMove(listOrder, oldIndex, newIndex);
    saveTaskListOrdering(projectId, nextOrder).catch((err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reorder lists");
    });
  };

  const moveList = useCallback((listId: string, delta: number) => {
    const index = listOrder.indexOf(listId);
    const nextIndex = index + delta;
    if (index === -1 || nextIndex < 0 || nextIndex >= listOrder.length) return;
    const nextOrder = arrayMove(listOrder, index, nextIndex);
    saveTaskListOrdering(projectId, nextOrder).catch((err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reorder lists");
    });
  }, [listOrder, projectId, saveTaskListOrdering]);

  const handleAddTasks = async (list: TaskList, taskIds: string[]) => {
    try {
      await Promise.all(taskIds.map(taskId => addTaskToList(list.id, taskId)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add tasks");
      throw err;
    }
  };

  const handleRemoveTask = async (list: TaskList, taskId: string) => {
    try {
      await removeTaskFromList(list.id, taskId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove task");
    }
  };

  const handleReorderTasks = async (list: TaskList, orderedTaskIds: string[]) => {
    try {
      await reorderTaskListTasks(list.id, orderedTaskIds);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reorder tasks");
    }
  };

  const moveTask = async (list: TaskList, taskId: string, delta: number) => {
    const index = list.orderedTaskIds.indexOf(taskId);
    const nextIndex = index + delta;
    if (index === -1 || nextIndex < 0 || nextIndex >= list.orderedTaskIds.length) return;
    const nextOrder = arrayMove(list.orderedTaskIds, index, nextIndex);
    await handleReorderTasks(list, nextOrder);
  };

  const handleDeleteList = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTaskList(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete list");
    }
  };

  return (
    <div className="terminalContent taskListsPanel">
      {(error || actionError) && (
        <div className="terminalErrorBanner">
          <span className="terminalErrorSymbol">[ERROR]</span>
          <span className="terminalErrorText">{error || actionError}</span>
          <button className="terminalErrorClose" onClick={() => setActionError(null)}>×</button>
        </div>
      )}

      <div className="taskListsPanelHeader">
        <div>
          <div className="terminalSectionTitle">Task Lists</div>
          <div className="terminalSectionSubtitle">Organize tasks into curated lists.</div>
        </div>
        <button className="themedBtn themedBtnPrimary" onClick={() => setEditingList({} as TaskList)}>
          + New List
        </button>
      </div>

      {loading ? (
        <div className="terminalLoadingState">
          <div className="terminalSpinner">
            <span className="terminalSpinnerDot">●</span>
            <span className="terminalSpinnerDot">●</span>
            <span className="terminalSpinnerDot">●</span>
          </div>
          <p className="terminalLoadingText">
            <span className="terminalCursor">█</span> Loading lists...
          </p>
        </div>
      ) : taskLists.length === 0 ? (
        <div className="terminalEmptyState">
          <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║       NO TASK LISTS YET               ║
    ║                                       ║
    ║    Create lists to organize tasks     ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                        `}</pre>
          <button className="themedBtn themedBtnPrimary" onClick={() => setEditingList({} as TaskList)}>
            + Create Task List
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleListReorder}>
          <SortableContext items={listOrder} strategy={verticalListSortingStrategy}>
            <div className="taskList">
              {taskLists.map((list, index) => {
                const isExpanded = expandedLists.has(list.id);
                const taskCount = list.orderedTaskIds?.length || 0;
                return (
                  <SortableWrapper key={list.id} id={list.id}>
                    <div className="taskListItem">
                      <div className="taskListItemMain" onClick={() => toggleExpanded(list.id)}>
                        <div className="taskListItemLeft">
                          <button
                            className={`taskListItemExpand ${isExpanded ? "expanded" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(list.id);
                            }}
                            aria-label={isExpanded ? "Collapse list" : "Expand list"}
                          >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <div className="taskListItemContent">
                            <div className="taskListItemHeader">
                              <h3 className="taskListItemTitle">{list.name}</h3>
                              <div className="taskListItemBadges">
                                <span className="taskListItemStatusBadge taskListItemStatusBadge--todo">{taskCount} tasks</span>
                              </div>
                            </div>
                            {list.description && (
                              <div className="taskListItemMeta">
                                <div className="taskListItemMetaItem">{list.description}</div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="taskListItemRight" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="taskListActionBtn"
                            onClick={() => moveList(list.id, -1)}
                            disabled={index === 0}
                            aria-label="Move list up"
                          >
                            ↑
                          </button>
                          <button
                            className="taskListActionBtn"
                            onClick={() => moveList(list.id, 1)}
                            disabled={index === taskLists.length - 1}
                            aria-label="Move list down"
                          >
                            ↓
                          </button>
                          <button className="taskListItemActionBtn" onClick={() => setAddingTasksList(list)}>Add Tasks</button>
                          <button className="taskListItemActionBtn" onClick={() => setEditingList(list)}>Edit</button>
                          <button className="taskListItemActionBtn taskListActionBtn--danger" onClick={() => setDeleteTarget(list)}>Delete</button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="taskListItemWorkArea">
                          <TaskListTasks
                            list={list}
                            tasksById={tasksById}
                            onRemoveTask={(taskId) => handleRemoveTask(list, taskId)}
                            onReorder={(ordered) => handleReorderTasks(list, ordered)}
                            onMoveTask={(taskId, delta) => moveTask(list, taskId, delta)}
                          />
                        </div>
                      )}
                    </div>
                  </SortableWrapper>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <TaskListModal
        isOpen={!!editingList}
        projectId={projectId}
        list={editingList && editingList.id ? editingList : null}
        onClose={() => setEditingList(null)}
      />

      <TaskListAddTasksModal
        isOpen={!!addingTasksList}
        list={addingTasksList}
        tasks={tasks}
        onClose={() => setAddingTasksList(null)}
        onAddTasks={(taskIds) => addingTasksList ? handleAddTasks(addingTasksList, taskIds) : Promise.resolve()}
      />

      <ConfirmActionModal
        isOpen={!!deleteTarget}
        title="Delete task list"
        message={
          <span>
            This will remove the list "{deleteTarget?.name}". Tasks will remain intact.
          </span>
        }
        confirmLabel="Delete"
        confirmDanger
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteList}
      />
    </div>
  );
}
