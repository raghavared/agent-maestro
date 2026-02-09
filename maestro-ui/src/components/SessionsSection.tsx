import React from "react";
import { createPortal } from "react-dom";
import { getProcessEffectById, type ProcessEffect } from "../processEffects";
import { shortenPathSmart, normalizeSeparators } from "../pathDisplay";
import { Icon } from "./Icon";
import { type MaestroTask, type MaestroSession as MaestroSession } from "../app/types/maestro";
import { useMaestroStore } from "../stores/useMaestroStore";
import { MaestroSessionContent } from "./maestro/MaestroSessionContent";
import { StrategyBadge } from "./maestro/StrategyBadge";
import { SessionDetailModal } from "./maestro/SessionDetailModal";
import { ConfirmActionModal } from "./modals/ConfirmActionModal";

function isSshCommand(commandLine: string | null | undefined): boolean {
  const trimmed = commandLine?.trim() ?? "";
  if (!trimmed) return false;
  const token = trimmed.split(/\s+/)[0];
  const base = token.split(/[\\/]/).pop() ?? token;
  return base.toLowerCase().replace(/\.exe$/, "") === "ssh";
}

type Session = {
  id: string;
  persistId: string;
  name: string;
  command: string;
  cwd: string | null;
  launchCommand: string | null;
  restoreCommand?: string | null;
  persistent?: boolean;
  effectId?: string | null;
  processTag?: string | null;
  agentWorking?: boolean;
  recordingActive?: boolean;
  exited?: boolean;
  closing?: boolean;
  exitCode?: number | null;
  maestroSessionId?: string | null;
};


type SessionsSectionProps = {
  agentShortcuts: ProcessEffect[];
  sessions: Session[];
  activeSessionId: string | null;
  projectName: string | null;
  projectBasePath: string | null;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onReorderSessions: (draggedPersistId: string, targetPersistId: string) => void;
  onQuickStart: (effect: ProcessEffect) => void;
  onOpenNewSession: () => void;
  onOpenAgentShortcuts: () => void;
  onOpenPersistentSessions: () => void;
  onOpenSshManager: () => void;
  onOpenManageTerminals: () => void;
};

export function SessionsSection({
  agentShortcuts,
  sessions,
  activeSessionId,
  projectName,
  projectBasePath,
  onSelectSession,
  onCloseSession,
  onReorderSessions,
  onQuickStart,
  onOpenNewSession,
  onOpenAgentShortcuts,
  onOpenPersistentSessions,
  onOpenSshManager,
  onOpenManageTerminals,
}: SessionsSectionProps) {
  // ==================== STATE MANAGEMENT (PHASE V) ====================

  const createMenuRef = React.useRef<HTMLDivElement | null>(null);
  const settingsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const [sessionModalId, setSessionModalId] = React.useState<string | null>(null);

  // Session close confirmation state
  const [sessionToClose, setSessionToClose] = React.useState<Session | null>(null);

  // Maestro session expansion state
  const [expandedSessions, setExpandedSessions] = React.useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = React.useState<Set<string>>(new Set());

  // Use Zustand store - WebSocket updates are automatic
  const maestroTasks = useMaestroStore((s) => s.tasks);
  const maestroSessions = useMaestroStore((s) => s.sessions);
  const fetchSession = useMaestroStore((s) => s.fetchSession);

  // Compute session tasks from global state
  const sessionTasks = React.useMemo(() => {
    const map = new Map<string, MaestroTask[]>();

    for (const session of sessions) {
      if (session.maestroSessionId && expandedSessions.has(session.id)) {
        const maestroSession = maestroSessions.get(session.maestroSessionId);

        if (maestroSession) {
          const tasks = maestroSession.taskIds
            .map(taskId => maestroTasks.get(taskId))
            .filter((task): task is MaestroTask => task !== undefined);

          map.set(session.id, tasks);
        }
      }
    }

    return map;
  }, [maestroSessions, maestroTasks, sessions, expandedSessions]);

  // Function to toggle session expansion
  const toggleSession = (sessionId: string, maestroSessionId?: string | null) => {
    if (!maestroSessionId) return;

    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
        // Trigger fetch if expanding
        fetchMaestroData(sessionId, maestroSessionId);
      }
      return next;
    });
  };

  // Fetch Maestro data for a session (using global context)
  const fetchMaestroData = async (sessionId: string, maestroSessionId: string) => {
    console.log('[SessionsSection] Fetching maestro data for session:', maestroSessionId);

    setLoadingTasks(prev => new Set(prev).add(sessionId));
    try {
      // Always fetch to get latest data
      await fetchSession(maestroSessionId);
      console.log('[SessionsSection] ✓ Fetched session data');
    } catch (err) {
      console.error("[SessionsSection] Failed to fetch maestro data for session", maestroSessionId, err);
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  React.useEffect(() => {
    if (!createOpen && !settingsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (createMenuRef.current?.contains(target)) return;
      if (settingsMenuRef.current?.contains(target)) return;
      setCreateOpen(false);
      setSettingsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCreateOpen(false);
      setSettingsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [createOpen, settingsOpen]);

  return (
    <>
      <div className="sidebarHeader">
        <div className="title">Sessions</div>
        <div className="sidebarHeaderActions">
          <div className="sidebarActionMenu" ref={createMenuRef}>
            <button
              type="button"
              className={`btnSmall btnIcon ${createOpen ? "btnIconActive" : ""}`}
              onClick={() =>
                setCreateOpen((prev) => {
                  const next = !prev;
                  if (next) setSettingsOpen(false);
                  return next;
                })
              }
              title="New terminal"
              aria-label="New terminal"
              aria-haspopup="menu"
              aria-expanded={createOpen}
            >
              <Icon name="plus" />
            </button>
            {createOpen && (
              <div className="sidebarActionMenuDropdown" role="menu" aria-label="New terminal">
                <button
                  type="button"
                  className="sidebarActionMenuItem"
                  role="menuitem"
                  onClick={() => {
                    setCreateOpen(false);
                    onOpenNewSession();
                  }}
                >
                  <Icon name="plus" />
                  <span
                    className="sessionLegendSwatch sessionLegendSwatchDefault"
                    aria-hidden="true"
                  />
                  <span>New terminal</span>
                </button>
                <button
                  type="button"
                  className="sidebarActionMenuItem"
                  role="menuitem"
                  onClick={() => {
                    setCreateOpen(false);
                    onOpenSshManager();
                  }}
                >
                  <Icon name="ssh" />
                  <span className="sessionLegendSwatch sessionLegendSwatchSsh" aria-hidden="true" />
                  <span>SSH connect</span>
                </button>
              </div>
            )}
          </div>

          <div className="sidebarActionMenu" ref={settingsMenuRef}>
            <button
              type="button"
              className={`btnSmall btnIcon ${settingsOpen ? "btnIconActive" : ""}`}
              onClick={() =>
                setSettingsOpen((prev) => {
                  const next = !prev;
                  if (next) setCreateOpen(false);
                  return next;
                })
              }
              title="Session tools"
              aria-label="Session tools"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
            >
              <Icon name="settings" />
            </button>
            {settingsOpen && (
              <div className="sidebarActionMenuDropdown" role="menu" aria-label="Session tools">
                <button
                  type="button"
                  className="sidebarActionMenuItem"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(false);
                    onOpenAgentShortcuts();
                  }}
                >
                  <Icon name="bolt" />
                  <span>Agent shortcuts</span>
                </button>
                <button
                  type="button"
                  className="sidebarActionMenuItem"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(false);
                    onOpenManageTerminals();
                  }}
                >
                  <Icon name="files" />
                  <span>Manage terminals</span>
                </button>
                <button
                  type="button"
                  className="sidebarActionMenuItem"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(false);
                    onOpenPersistentSessions();
                  }}
                >
                  <Icon name="layers" />
                  <span
                    className="sessionLegendSwatch sessionLegendSwatchPersistent"
                    aria-hidden="true"
                  />
                  <span>Manage persistent terminals</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {agentShortcuts.length > 0 && (
        <div className="agentShortcutRow" role="toolbar" aria-label="Agent shortcuts">
          {agentShortcuts.map((effect) => (
            <button
              key={effect.id}
              type="button"
              className="agentShortcutBtn"
              onClick={() => onQuickStart(effect)}
              title={`Start ${effect.label}`}
            >
              {effect.iconSrc ? (
                <img className="agentShortcutIcon" src={effect.iconSrc} alt="" aria-hidden="true" />
              ) : (
                <span className="agentShortcutIconFallback" aria-hidden="true">
                  {"\u25B6"}
                </span>
              )}
              <span className="agentShortcutLabel">{effect.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sessionList">
        {sessions.length === 0 ? (
          <div className="empty">No sessions in this project.</div>
        ) : (
          sessions.map((s) => {
            const isActive = s.id === activeSessionId;
            const isExited = Boolean(s.exited);
            const isClosing = Boolean(s.closing);
            const effect = getProcessEffectById(s.effectId);
            const chipLabel = effect?.label ?? s.processTag ?? null;
            const hasAgentIcon = Boolean(effect?.iconSrc);
            const isWorking = Boolean(effect && s.agentWorking && !isExited && !isClosing);
            const isRecording = Boolean(s.recordingActive && !isExited && !isClosing);
            const launchOrRestore =
              s.launchCommand ??
              (s.restoreCommand?.trim() ? s.restoreCommand.trim() : null) ??
              null;
            const isSsh = isSshCommand(launchOrRestore);
            const isPersistent = Boolean(s.persistent);
            const isSshType = isSsh && !isPersistent;
            const isDefaultType = !isPersistent && !isSshType;
            const chipClass = effect
              ? `chip chip-${effect.id}`
              : isSshType
                ? "chip chip-ssh"
                : "chip";
            const showChipLabel =
              Boolean(chipLabel) &&
              !hasAgentIcon &&
              !(isSshType && (chipLabel ?? "").trim().toLowerCase() === "ssh");

            const maestroSession = s.maestroSessionId ? maestroSessions.get(s.maestroSessionId) : null;
            const needsInput = maestroSession?.status === 'needs-user-input';

            return (
              <div
                key={s.id}
                className={`sessionItem ${isActive ? "sessionItemActive" : ""} ${isExited ? "sessionItemExited" : ""
                  } ${isClosing ? "sessionItemClosing" : ""} ${isSshType ? "sessionItemSsh" : ""
                  } ${isPersistent ? "sessionItemPersistent" : ""} ${isDefaultType ? "sessionItemDefault" : ""
                  } ${needsInput ? "sessionItemNeedsInput" : ""}`}
                onClick={() => onSelectSession(s.id)}
                style={{ flexDirection: 'column', alignItems: 'stretch' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
                  {s.maestroSessionId && (
                    <button
                      className={`terminalExpandBtn ${expandedSessions.has(s.id) ? 'expanded' : ''}`}
                      style={{ marginRight: '6px', border: 'none', width: '16px', height: '16px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSession(s.id, s.maestroSessionId);
                      }}
                    >
                      {expandedSessions.has(s.id) ? '▾' : '▸'}
                    </button>
                  )}
                  <div className={`dot ${isActive ? "dotActive" : ""}`} />
                  <div className="sessionMeta">
                    <div className="sessionName">
                      {hasAgentIcon && chipLabel && effect?.iconSrc && (
                        <span className={`agentBadge chip-${effect.id}`} title={chipLabel}>
                          <img className="agentIcon" src={effect.iconSrc} alt={chipLabel} />
                          {isWorking && (
                            <span className="chipActivity agentBadgeDot" aria-label="Working" />
                          )}
                        </span>
                      )}
                      <span className="sessionNameText">{s.name}</span>
                      {showChipLabel && chipLabel && (
                        <span className={chipClass} title={chipLabel}>
                          <span className="chipLabel">{chipLabel}</span>
                          {isWorking && <span className="chipActivity" aria-label="Working" />}
                        </span>
                      )}
                      {isRecording && <span className="recordingDot" title="Recording" />}
                      {isClosing ? (
                        <span className="sessionStatus">closing…</span>
                      ) : isExited ? (
                        <span className="sessionStatus">
                          exited{s.exitCode != null ? ` ${s.exitCode}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    className="closeBtn"
                    disabled={isClosing}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Show confirmation for active sessions
                      const isActiveSession = !isExited && !isClosing;
                      if (isActiveSession) {
                        setSessionToClose(s);
                      } else {
                        onCloseSession(s.id);
                      }
                    }}
                    title="Close session"
                  >
                    ×
                  </button>
                </div>

                {/* Session status indicator at bottom */}
                {maestroSession && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '4px', paddingLeft: '24px' }}>
                    <span className={`sessionStatusBadge sessionStatusBadge--${maestroSession.status} sessionStatusBadge--clickable`}
                      style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionModalId(maestroSession.id);
                      }}>
                      {maestroSession.status === 'spawning' ? 'SPAWN' : maestroSession.status === 'stopped' ? 'STOP' : maestroSession.status === 'needs-user-input' ? 'NEEDS INPUT' : maestroSession.status.toUpperCase()}
                    </span>
                    <StrategyBadge strategy={maestroSession.strategy} orchestratorStrategy={maestroSession.orchestratorStrategy} compact />
                  </div>
                )}

                {/* Maestro Session Content - Enhanced */}
                {expandedSessions.has(s.id) && maestroSession && (
                  <MaestroSessionContent
                    session={maestroSession}
                    tasks={sessionTasks.get(s.id) || []}
                    allTasks={maestroTasks}
                    loading={loadingTasks.has(s.id)}
                  />
                )}
                {expandedSessions.has(s.id) && !maestroSession && loadingTasks.has(s.id) && (
                  <div className="terminalSubtasks" style={{ padding: '8px 24px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
                      Loading session data...
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {sessionModalId && createPortal(
        <SessionDetailModal
          sessionId={sessionModalId}
          isOpen={true}
          onClose={() => setSessionModalId(null)}
        />,
        document.body
      )}

      {sessionToClose && createPortal(
        <ConfirmActionModal
          isOpen={true}
          title="Close Active Session"
          message={
            <>
              Are you sure you want to close the session <strong>{sessionToClose.name}</strong>?
              {sessionToClose.agentWorking && (
                <div style={{ marginTop: '8px', color: 'var(--warning)' }}>
                  This session has an agent currently working.
                </div>
              )}
            </>
          }
          confirmLabel="Close Session"
          cancelLabel="Cancel"
          confirmDanger={true}
          onClose={() => setSessionToClose(null)}
          onConfirm={() => {
            onCloseSession(sessionToClose.id);
            setSessionToClose(null);
          }}
        />,
        document.body
      )}
    </>
  );
}
