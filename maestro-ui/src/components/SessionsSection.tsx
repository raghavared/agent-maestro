import React, { useCallback, useLayoutEffect, useState } from "react";
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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPortal } from "react-dom";
import { getProcessEffectById, type ProcessEffect } from "../processEffects";
import { shortenPathSmart, normalizeSeparators } from "../pathDisplay";
import { Icon } from "./Icon";
import { type MaestroTask, type MaestroSession as MaestroSession } from "../app/types/maestro";
import { useMaestroStore } from "../stores/useMaestroStore";
import { useUIStore } from "../stores/useUIStore";
import { MaestroSessionContent } from "./maestro/MaestroSessionContent";
import { StrategyBadge } from "./maestro/StrategyBadge";
import { SessionDetailModal } from "./maestro/SessionDetailModal";
import { SessionLogModal } from "./session-log/SessionLogModal";
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
  activeProjectId: string;
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

function SortableSessionItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortableItemWrapper ${isDragging ? "sortableItemWrapper--dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function SessionsSection({
  agentShortcuts,
  sessions,
  activeSessionId,
  activeProjectId,
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

  const settingsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const settingsBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsDropdownPos, setSettingsDropdownPos] = React.useState<{ top: number; right: number } | null>(null);

  const computeDropdownPos = useCallback((btnRef: React.RefObject<HTMLButtonElement | null>) => {
    const btn = btnRef.current;
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return { top: rect.bottom + 4, right: window.innerWidth - rect.right };
  }, []);

  useLayoutEffect(() => {
    if (settingsOpen) {
      setSettingsDropdownPos(computeDropdownPos(settingsBtnRef));
    }
  }, [settingsOpen, computeDropdownPos]);


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const draggedSession = sessions.find((s) => s.id === active.id);
      const targetSession = sessions.find((s) => s.id === over.id);
      if (!draggedSession || !targetSession) return;

      onReorderSessions(draggedSession.persistId, targetSession.persistId);
    },
    [sessions, onReorderSessions]
  );

  const [sessionModalId, setSessionModalId] = React.useState<string | null>(null);
  const [logModalSessionId, setLogModalSessionId] = React.useState<string | null>(null);

  // Session close confirmation state
  const [sessionToClose, setSessionToClose] = React.useState<Session | null>(null);

  // Maestro session expansion state
  const [expandedSessions, setExpandedSessions] = React.useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = React.useState<Set<string>>(new Set());

  // Use Zustand store - WebSocket updates are automatic
  const maestroTasks = useMaestroStore((s) => s.tasks);
  const maestroSessions = useMaestroStore((s) => s.sessions);
  const fetchSession = useMaestroStore((s) => s.fetchSession);
  const hardRefresh = useMaestroStore((s) => s.hardRefresh);

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    if (!activeProjectId || refreshing) return;
    setRefreshing(true);
    try {
      await hardRefresh(activeProjectId);
    } catch (err) {
      console.error('[SessionsSection] Hard refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [activeProjectId, refreshing, hardRefresh]);

  const handleShowBoard = React.useCallback(() => {
    useUIStore.getState().setShowBoardRequested(true);
  }, []);

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
    if (!settingsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSettingsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  return (
    <>
      <div className="sidebarHeader">
        <div className="title">Sessions</div>
        <div className="sidebarHeaderActions">
          <button
            type="button"
            className="btnSmall btnIcon"
            onClick={handleRefresh}
            disabled={refreshing || !activeProjectId}
            title="Refresh tasks"
            aria-label="Refresh tasks"
          >
            <Icon name="refresh" />
          </button>
          <button
            type="button"
            className="btnSmall btnIcon"
            onClick={handleShowBoard}
            disabled={!activeProjectId}
            title="Open board view"
            aria-label="Open board view"
          >
            <Icon name="layers" />
          </button>
          <div className="sidebarActionMenu" ref={settingsMenuRef}>
            <button
              ref={settingsBtnRef}
              type="button"
              className={`btnSmall btnIcon ${settingsOpen ? "btnIconActive" : ""}`}
              onClick={() =>
                setSettingsOpen((prev) => !prev)
              }
              title="Session tools"
              aria-label="Session tools"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
            >
              <Icon name="settings" />
            </button>
            {settingsOpen && settingsDropdownPos && createPortal(
              <>
                <div
                  className="terminalInlineStatusOverlay"
                  onClick={() => setSettingsOpen(false)}
                />
                <div
                  className="sidebarActionMenuDropdown sidebarActionMenuDropdown--fixed"
                  role="menu"
                  aria-label="Session tools"
                  style={{ position: 'fixed', top: settingsDropdownPos.top, right: settingsDropdownPos.right }}
                >
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
              </>,
              document.body
            )}
          </div>
        </div>
      </div>

      <div className="agentShortcutRow" role="toolbar" aria-label="Quick launch">
        <button
          type="button"
          className="agentShortcutBtn"
          onClick={onOpenNewSession}
          title="New terminal"
        >
          <span className="agentShortcutIconFallback" aria-hidden="true">
            {">_"}
          </span>
          <span className="agentShortcutLabel">Terminal</span>
        </button>
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

      <div className="sessionList">
        {sessions.length === 0 ? (
          <div className="empty">No sessions in this project.</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
          <SortableContext
            items={sessions.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
          {sessions.map((s) => {
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
            if (maestroSession?.needsInput) {
              console.log('[SessionsSection] Session needsInput:', s.maestroSessionId, maestroSession.needsInput);
            }
            const needsInput = maestroSession?.needsInput?.active;

            return (
              <SortableSessionItem key={s.id} id={s.id}>
              <div
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
                  <button
                    className="logBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogModalSessionId(s.id);
                    }}
                    title="View session log"
                  >
                    <Icon name="log" size={12} />
                  </button>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '4px', paddingLeft: '24px', flexWrap: 'wrap' }}>
                    <span className={`sessionStatusBadge sessionStatusBadge--${maestroSession.status} sessionStatusBadge--clickable`}
                      style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionModalId(maestroSession.id);
                      }}>
                      {maestroSession.status === 'spawning' ? 'SPAWN' : maestroSession.status === 'stopped' ? 'STOP' : maestroSession.status.toUpperCase()}
                    </span>
                    {/* Team member badges */}
                    {(() => {
                      const snapshots = maestroSession.teamMemberSnapshots?.length
                        ? maestroSession.teamMemberSnapshots
                        : maestroSession.teamMemberSnapshot
                          ? [maestroSession.teamMemberSnapshot]
                          : [];
                      return snapshots.map((member, idx) => (
                        <span
                          key={idx}
                          className="sessionTeamMemberBadge"
                          title={`${member.name} (${member.role})`}
                        >
                          <span className="sessionTeamMemberBadge__avatar">{member.avatar}</span>
                          <span className="sessionTeamMemberBadge__name">{member.name}</span>
                        </span>
                      ));
                    })()}
                    {maestroSession.needsInput?.active && (
                      <span className="sessionStatusBadge sessionStatusBadge--needsInput"
                        style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px' }}>
                        NEEDS INPUT
                      </span>
                    )}
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
              </SortableSessionItem>
            );
          })
          }
          </SortableContext>
          </DndContext>
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

      {logModalSessionId && (() => {
        const logSession = sessions.find(s => s.id === logModalSessionId);
        return logSession?.cwd ? createPortal(
          <SessionLogModal
            sessionName={logSession.name}
            cwd={logSession.cwd}
            maestroSessionId={logSession.maestroSessionId}
            onClose={() => setLogModalSessionId(null)}
          />,
          document.body
        ) : null;
      })()}

      {sessionToClose && createPortal(
        <ConfirmActionModal
          isOpen={true}
          title="[ CLOSE SESSION ]"
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
