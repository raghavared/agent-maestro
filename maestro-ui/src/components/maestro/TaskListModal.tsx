import React, { useEffect, useState } from "react";
import { useMaestroStore } from "../../stores/useMaestroStore";
import type { TaskList, CreateTaskListPayload, UpdateTaskListPayload } from "../../app/types/maestro";
import { Icon } from "./redesign/kit";

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
      <div className="pn-mdl" onClick={(e) => e.stopPropagation()}>
        <div className="pn-mdl__hd">
          <div className="pn-mdl__hdmain">
            <div className="pn-mdl__crumb"><Icon name="listChecks" /> <b>Task list</b></div>
            <h2 className="pn-mdl__titleinput" style={{ margin: 0 }}>{isEditMode ? "Edit list" : "New list"}</h2>
          </div>
          <button type="button" className="pn-mdl__close" onClick={onClose} disabled={isSaving}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="pn-mdl__body">
            <div className="pn-fld">
              <span className="pn-flabel">Name</span>
              <input
                className="pn-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. release prep"
              />
            </div>
            <div className="pn-fld">
              <span className="pn-flabel">Description</span>
              <textarea
                className="pn-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes for this list"
              />
            </div>
            {error && <div className="pn-fhint" style={{ color: "var(--pn-block)" }}>{error}</div>}
          </div>
          <div className="pn-mdl__foot">
            <div className="pn-mdl__footL" />
            <div className="pn-mdl__footR">
              <button type="button" className="pn-btn pn-btn--ghost" onClick={onClose} disabled={isSaving}>Cancel</button>
              <button type="submit" className="pn-btn pn-btn--primary" disabled={isSaving}>
                {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Create List"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
