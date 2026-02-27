import React, { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMaestroStore } from "../stores/useMaestroStore";
import { useProjectStore } from "../stores/useProjectStore";
import { maestroClient } from "../utils/MaestroClient";

type ExportToTaskPickerProps = {
  onExport: () => Promise<Blob | null>;
  onClose: () => void;
  whiteboardName: string;
};

export function ExportToTaskPicker({ onExport, onClose, whiteboardName }: ExportToTaskPickerProps) {
  const tasks = useMaestroStore((s) => s.tasks);
  const createTask = useMaestroStore((s) => s.createTask);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  const projectTasks = useMemo(() => {
    const all = Array.from(tasks.values())
      .filter((t) => t.projectId === activeProjectId && t.status !== "cancelled" && t.status !== "archived");
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    return all;
  }, [tasks, activeProjectId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return projectTasks;
    const q = search.toLowerCase();
    return projectTasks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    );
  }, [projectTasks, search]);

  const exportToTask = useCallback(async (taskId: string) => {
    setUploading(true);
    setStatus(null);
    try {
      const blob = await onExport();
      if (!blob) {
        setStatus({ type: "error", message: "Nothing to export (empty canvas)" });
        setUploading(false);
        return;
      }
      const filename = `${whiteboardName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      await maestroClient.uploadTaskImage(taskId, file);
      setStatus({ type: "success", message: "Image exported to task!" });
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setStatus({ type: "error", message: "Failed to export image" });
    } finally {
      setUploading(false);
    }
  }, [onExport, onClose, whiteboardName]);

  const handleCreateAndExport = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title || !activeProjectId) return;

    setUploading(true);
    setStatus(null);
    try {
      const task = await createTask({
        projectId: activeProjectId,
        title,
        description: `Exported from whiteboard: ${whiteboardName}`,
        priority: "medium",
      });
      await exportToTask(task.id);
    } catch (err) {
      setStatus({ type: "error", message: "Failed to create task" });
      setUploading(false);
    }
  }, [newTaskTitle, activeProjectId, createTask, exportToTask]);

  const overlay = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div
        style={{
          background: "var(--theme-bg, #1a1a2e)",
          border: "1px solid var(--theme-border)",
          borderRadius: "8px",
          width: "400px",
          maxHeight: "500px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--theme-border)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--style-font-ui)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--theme-primary)",
              letterSpacing: "0.5px",
            }}
          >
            EXPORT TO TASK
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            style={{
              background: "none",
              border: "none",
              color: "rgba(var(--theme-primary-rgb), 0.5)",
              cursor: "pointer",
              fontSize: "16px",
              padding: "0 4px",
            }}
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--theme-border)" }}>
          <input
            type="text"
            className="themedFormInput"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus={!creatingNew}
            style={{ width: "100%", fontSize: "11px", padding: "6px 10px" }}
          />
        </div>

        {/* Status message */}
        {status && (
          <div
            style={{
              padding: "8px 12px",
              fontSize: "11px",
              color: status.type === "success" ? "#22c55e" : "#ef4444",
              background:
                status.type === "success"
                  ? "rgba(34,197,94,0.1)"
                  : "rgba(239,68,68,0.1)",
              borderBottom: "1px solid var(--theme-border)",
            }}
          >
            {status.message}
          </div>
        )}

        {/* Loading overlay */}
        {uploading && (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              fontSize: "11px",
              color: "var(--theme-primary)",
            }}
          >
            Exporting image to task...
          </div>
        )}

        {/* Task list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {/* New task option */}
          {!creatingNew ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setCreatingNew(true);
                setTimeout(() => newTaskInputRef.current?.focus(), 50);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--theme-border)",
                cursor: uploading ? "not-allowed" : "pointer",
                textAlign: "left",
                color: "var(--theme-primary)",
                fontFamily: "var(--style-font-ui)",
                fontSize: "11px",
                fontWeight: 600,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!uploading)
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(var(--theme-primary-rgb), 0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span style={{ fontSize: "13px", lineHeight: 1 }}>+</span>
              New Task
            </button>
          ) : (
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid var(--theme-border)",
                display: "flex",
                gap: "6px",
                alignItems: "center",
              }}
            >
              <input
                ref={newTaskInputRef}
                type="text"
                className="themedFormInput"
                placeholder="Task title..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskTitle.trim()) {
                    handleCreateAndExport();
                  }
                  if (e.key === "Escape") {
                    setCreatingNew(false);
                    setNewTaskTitle("");
                  }
                }}
                disabled={uploading}
                style={{ flex: 1, fontSize: "11px", padding: "5px 8px" }}
              />
              <button
                type="button"
                className="themedBtn"
                disabled={uploading || !newTaskTitle.trim()}
                onClick={handleCreateAndExport}
                style={{ padding: "4px 10px", fontSize: "10px", whiteSpace: "nowrap" }}
              >
                Create & Export
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(false);
                  setNewTaskTitle("");
                }}
                disabled={uploading}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(var(--theme-primary-rgb), 0.5)",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "0 2px",
                }}
              >
                &times;
              </button>
            </div>
          )}

          {/* Existing tasks */}
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                fontSize: "11px",
                color: "rgba(var(--theme-primary-rgb), 0.4)",
              }}
            >
              {search ? "No matching tasks" : "No tasks in this project"}
            </div>
          ) : (
            filtered.map((task) => (
              <button
                key={task.id}
                type="button"
                disabled={uploading}
                onClick={() => exportToTask(task.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--theme-border)",
                  cursor: uploading ? "not-allowed" : "pointer",
                  textAlign: "left",
                  color: "inherit",
                  fontFamily: "var(--style-font-ui)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!uploading)
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(var(--theme-primary-rgb), 0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background:
                      task.status === "in_progress"
                        ? "#00d9ff"
                        : task.status === "completed"
                        ? "var(--theme-primary)"
                        : task.status === "blocked"
                        ? "#ef4444"
                        : "rgba(var(--theme-primary-rgb), 0.3)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "rgba(var(--theme-primary-rgb), 0.85)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {task.title}
                  </div>
                  <div
                    style={{
                      fontSize: "9px",
                      color: "rgba(var(--theme-primary-rgb), 0.4)",
                      marginTop: "1px",
                    }}
                  >
                    {task.status} &middot; {task.priority}
                    {task.images && task.images.length > 0 && (
                      <> &middot; {task.images.length} img</>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "9px",
                    color: "rgba(var(--theme-primary-rgb), 0.3)",
                    flexShrink: 0,
                  }}
                >
                  {task.id.slice(-6)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
