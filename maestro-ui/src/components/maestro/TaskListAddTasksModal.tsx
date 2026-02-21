import React, { useMemo, useState, useEffect } from "react";
import type { MaestroTask, TaskList } from "../../app/types/maestro";

type TaskListAddTasksModalProps = {
  isOpen: boolean;
  list: TaskList | null;
  tasks: MaestroTask[];
  onClose: () => void;
  onAddTasks: (taskIds: string[]) => Promise<void>;
};

export function TaskListAddTasksModal({
  isOpen,
  list,
  tasks,
  onClose,
  onAddTasks,
}: TaskListAddTasksModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTasks = useMemo(() => {
    if (!list) return [];
    const lower = search.trim().toLowerCase();
    return tasks.filter(task => {
      if (list.orderedTaskIds.includes(task.id)) return false;
      if (!lower) return true;
      return task.title.toLowerCase().includes(lower) || task.description.toLowerCase().includes(lower);
    });
  }, [tasks, list, search]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected([]);
    setError(null);
  }, [isOpen, list?.id]);

  if (!isOpen || !list) return null;

  const toggleTask = (taskId: string) => {
    setSelected(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (selected.length === 0) {
      setError("Select at least one task");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onAddTasks(selected);
      setSelected([]);
      setSearch("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tasks");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="themedModalBackdrop" onClick={onClose}>
      <div className="themedModal themedModal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="themedModalHeader">
          <span className="themedModalTitle">[ ADD TASKS TO LIST ]</span>
          <button className="themedModalClose" onClick={onClose} disabled={isSaving}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="themedModalContent">
            <div className="themedFormRow">
              <div className="themedFormLabel">List</div>
              <div className="themedFormHint">{list.name}</div>
            </div>
            <div className="themedFormRow">
              <div className="themedFormLabel">Search</div>
              <input
                className="themedFormInput"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter tasks..."
              />
            </div>
            <div className="taskListModalTaskPicker">
              {availableTasks.length === 0 ? (
                <div className="themedFormHint">No tasks available to add.</div>
              ) : (
                availableTasks.map(task => (
                  <label key={task.id} className="taskListModalTaskRow">
                    <input
                      type="checkbox"
                      checked={selected.includes(task.id)}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span className="taskListModalTaskTitle">{task.title}</span>
                    <span className={`taskListItemStatusBadge taskListItemStatusBadge--${task.status}`}>{task.status.replace('_', ' ')}</span>
                  </label>
                ))
              )}
            </div>
            {error && <div className="themedFormHint" style={{ color: "var(--danger)" }}>{error}</div>}
          </div>
          <div className="themedFormActions">
            <button type="button" className="themedBtn" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="themedBtn themedBtnPrimary" disabled={isSaving}>
              {isSaving ? "Adding..." : "Add Selected"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
