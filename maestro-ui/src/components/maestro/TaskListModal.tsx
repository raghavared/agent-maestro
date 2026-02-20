import React, { useEffect, useState } from "react";
import { useMaestroStore } from "../../stores/useMaestroStore";
import type { TaskList, CreateTaskListPayload, UpdateTaskListPayload } from "../../app/types/maestro";

type TaskListModalProps = {
  isOpen: boolean;
  projectId: string;
  list?: TaskList | null;
  onClose: () => void;
};

export function TaskListModal({ isOpen, projectId, list, onClose }: TaskListModalProps) {
  const isEditMode = !!list;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTaskList = useMaestroStore(s => s.createTaskList);
  const updateTaskList = useMaestroStore(s => s.updateTaskList);

  useEffect(() => {
    if (!isOpen) return;
    if (list) {
      setName(list.name);
      setDescription(list.description || "");
    } else {
      setName("");
      setDescription("");
    }
    setError(null);
  }, [isOpen, list]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isEditMode && list) {
        const payload: UpdateTaskListPayload = {
          name: name.trim(),
          description: description.trim() || undefined,
        };
        await updateTaskList(list.id, payload);
      } else {
        const payload: CreateTaskListPayload = {
          projectId,
          name: name.trim(),
          description: description.trim() || undefined,
        };
        await createTaskList(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task list");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="themedModalBackdrop" onClick={onClose}>
      <div className="themedModal" onClick={(e) => e.stopPropagation()}>
        <div className="themedModalHeader">
          <span className="themedModalTitle">[ {isEditMode ? "EDIT TASK LIST" : "NEW TASK LIST"} ]</span>
          <button className="themedModalClose" onClick={onClose} disabled={isSaving}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="themedModalContent">
            <div className="themedFormRow">
              <div className="themedFormLabel">Name</div>
              <input
                className="themedFormInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. release prep"
              />
            </div>
            <div className="themedFormRow">
              <div className="themedFormLabel">Description</div>
              <textarea
                className="themedFormTextarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes for this list"
              />
            </div>
            {error && <div className="themedFormHint" style={{ color: "var(--danger)" }}>{error}</div>}
          </div>
          <div className="themedFormActions">
            <button type="button" className="themedBtn" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="themedBtn themedBtnPrimary" disabled={isSaving}>
              {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Create List"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
