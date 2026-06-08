import React, { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMaestroStore } from "../stores/useMaestroStore";
import { useProjectStore } from "../stores/useProjectStore";
import { maestroClient } from "../utils/MaestroClient";

type ExportToSessionPickerProps = {
  onExport: () => Promise<{ png: Blob; sceneJson: string } | null>;
  onClose: () => void;
  whiteboardName: string;
};

export function ExportToSessionPicker({ onExport, onClose, whiteboardName }: ExportToSessionPickerProps) {
  const sessions = useMaestroStore((s) => s.sessions);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const runningSessions = useMemo(() => {
    const all = Object.values(sessions).filter(
      (s) =>
        s.projectId === activeProjectId &&
        (s.status === "spawning" || s.status === "idle" || s.status === "working"),
    );
    all.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return all;
  }, [sessions, activeProjectId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return runningSessions;
    const q = search.toLowerCase();
    return runningSessions.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    );
  }, [runningSessions, search]);

  const exportToSession = useCallback(
    async (sessionId: string) => {
      setSending(true);
      setStatus(null);
      try {
        const result = await onExport();
        if (!result) {
          setStatus({ type: "error", message: "Nothing to export (empty canvas)" });
          setSending(false);
          return;
        }
        await maestroClient.injectDiagramToSession(sessionId, result.png, result.sceneJson, whiteboardName);
        setStatus({ type: "success", message: "Diagram sent to session!" });
        setTimeout(() => onClose(), 1200);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ type: "error", message: `Failed to send: ${msg}` });
      } finally {
        setSending(false);
      }
    },
    [onExport, onClose, whiteboardName],
  );

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
        if (e.target === e.currentTarget && !sending) onClose();
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
            SEND TO SESSION
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
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
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{ width: "100%", fontSize: "11px", padding: "6px 10px" }}
          />
        </div>

        {/* Status */}
        {status && (
          <div
            style={{
              padding: "8px 12px",
              fontSize: "11px",
              color: status.type === "success" ? "#22c55e" : "#ef4444",
              background:
                status.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              borderBottom: "1px solid var(--theme-border)",
            }}
          >
            {status.message}
          </div>
        )}

        {/* Loading */}
        {sending && (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              fontSize: "11px",
              color: "var(--theme-primary)",
            }}
          >
            Sending diagram to session...
          </div>
        )}

        {/* Session list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                fontSize: "11px",
                color: "rgba(var(--theme-primary-rgb), 0.4)",
              }}
            >
              {runningSessions.length === 0
                ? "No running sessions in this project"
                : "No matching sessions"}
            </div>
          ) : (
            filtered.map((session) => (
              <button
                key={session.id}
                type="button"
                disabled={sending}
                onClick={() => exportToSession(session.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--theme-border)",
                  cursor: sending ? "not-allowed" : "pointer",
                  textAlign: "left",
                  color: "inherit",
                  fontFamily: "var(--style-font-ui)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!sending)
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
                      session.status === "working"
                        ? "#00d9ff"
                        : session.status === "idle"
                        ? "var(--theme-primary)"
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
                    {session.name || session.id}
                  </div>
                  <div
                    style={{
                      fontSize: "9px",
                      color: "rgba(var(--theme-primary-rgb), 0.4)",
                      marginTop: "1px",
                    }}
                  >
                    {session.status}
                    {session.teamMemberSnapshot?.name && (
                      <> &middot; {session.teamMemberSnapshot.name}</>
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
                  {session.id.slice(-6)}
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
