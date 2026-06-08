import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { type MaestroTask, type MaestroSession as MaestroSession, type Team } from "../app/types/maestro";
import { useMaestroStore } from "../stores/useMaestroStore";
import { useUIStore } from "../stores/useUIStore";
import { useSpacesStore } from "../stores/useSpacesStore";
import { MaestroSessionContent } from "./maestro/MaestroSessionContent";
import { SessionDetailModal } from "./maestro/SessionDetailModal";
import { SessionLogModal } from "./session-log/SessionLogModal";
import { ConfirmActionModal } from "./modals/ConfirmActionModal";
import { buildTeamGroups } from "../utils/teamGrouping";
import type { TeamColor } from "../app/constants/teamColors";
import type { Space } from "../app/types/space";
import { useSessionTree } from "../hooks/useSessionTree";
import { SessionListItem, type SessionTileLinkInfo } from "./maestro/SessionListItem";
import type { SessionTreeNode } from "../app/types/maestro";
import { resolveSessionTab, buildChildrenByParent, collectSubtreeIds as collectSubtreeIdsUtil, type SessionSubTab } from "../utils/sessionLifecycle";

function formatSpaceAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Phase 2: Module-scope static constants
const AGENT_TOOL_ICONS: Record<string, string> = {
  'claude-code': '/agent-icons/claude-code-icon.png',
  'codex': '/agent-icons/openai-codex-icon.png',
  'gemini': '/agent-icons/gemini-logo.png',
};

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
  onCreateWhiteboard?: () => void;
  onCloseSpace?: (id: string) => void;
};

const SortableSessionItem = React.memo(function SortableSessionItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = useMemo<React.CSSProperties>(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : undefined,
    willChange: isDragging ? "transform" : "auto",
  }), [transform, transition, isDragging]);

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
});

function VirtualizedHistoryList({
  historySessions,
  resumingSessionId,
  setResumingSessionId,
  resumeSession,
  setShowHistory,
  maestroTasks,
}: {
  historySessions: MaestroSession[];
  resumingSessionId: string | null;
  setResumingSessionId: (id: string | null) => void;
  resumeSession: (id: string) => Promise<any>;
  setShowHistory: (v: boolean) => void;
  maestroTasks: Record<string, MaestroTask>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_BASE = 36;
  const ROW_WITH_TASKS = 58;
  const rowVirtualizer = useVirtualizer({
    count: historySessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => historySessions[i]?.taskIds?.length ? ROW_WITH_TASKS : ROW_BASE,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="sessionHistoryDropdown__list" style={{ maxHeight: 320, overflow: 'auto' }}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const hs = historySessions[virtualRow.index];
          const canResume = ((hs.metadata as any)?.agentTool || 'claude-code') === 'claude-code';
          const isResuming = resumingSessionId === hs.id;
          const snap = hs.teamMemberSnapshot;
          const sec = Math.floor((Date.now() - hs.lastActivity) / 1000);
          const ago = sec < 60 ? `${sec}s ago`
            : sec < 3600 ? `${Math.floor(sec / 60)}m ago`
            : sec < 86400 ? `${Math.floor(sec / 3600)}h ago`
            : `${Math.floor(sec / 86400)}d ago`;
          const tasks = hs.taskIds
            ?.map(tid => maestroTasks[tid])
            .filter((t): t is MaestroTask => t !== undefined) ?? [];
          return (
            <div
              key={hs.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="sessionHistoryDropdown__row">
                <span className={`sessionHistoryDropdown__dot sessionHistoryDropdown__dot--${hs.status}`} />
                <div className="sessionHistoryDropdown__info">
                  <span className="sessionHistoryDropdown__name">
                    {snap?.avatar && <span>{snap.avatar} </span>}
                    {snap?.name || hs.name}
                  </span>
                  <span className="sessionHistoryDropdown__meta">
                    {hs.status} · {ago}
                  </span>
                  {tasks.length > 0 && (
                    <div className="sessionHistoryDropdown__tasks">
                      {tasks.slice(0, 3).map(task => (
                        <span key={task.id} className={`sessionTaskChip sessionTaskChip--${task.status}`} title={`${task.title} (${task.status})`}>
                          <span className="sessionTaskChip__dot" />
                          <span className="sessionTaskChip__label">{task.title}</span>
                        </span>
                      ))}
                      {tasks.length > 3 && (
                        <span className="sessionTaskChip sessionTaskChip--more">+{tasks.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                {canResume && (
                  <button
                    type="button"
                    className="sessionHistoryDropdown__resumeBtn"
                    disabled={isResuming}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setResumingSessionId(hs.id);
                      try {
                        await resumeSession(hs.id);
                        setShowHistory(false);
                      } catch (err) {
                        console.error('Failed to resume session:', err);
                        useUIStore.getState().reportError('Failed to resume session', err);
                      } finally {
                        setResumingSessionId(null);
                      }
                    }}
                  >
                    {isResuming ? '...' : 'Resume'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Phase 5: Extracted memoized SessionItem component
interface SessionItemProps {
  session: Session;
  teamColor: TeamColor | null;
  isActive: boolean;
  isExpanded: boolean;
  maestroSession: MaestroSession | null;
  maestroTasks: Record<string, MaestroTask>;
  contentTasks: MaestroTask[];
  isLoadingTasks: boolean;
  isResuming: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (sessionId: string, maestroSessionId?: string | null) => void;
  onRequestClose: (session: Session) => void;
  onOpenSessionModal: (id: string) => void;
  onOpenLogModal: (id: string) => void;
  onResume: (id: string) => Promise<void>;
}

const SessionItem = React.memo(function SessionItem({
  session: s,
  teamColor,
  isActive,
  isExpanded,
  maestroSession,
  maestroTasks,
  contentTasks,
  isLoadingTasks,
  isResuming,
  onSelect,
  onToggleExpand,
  onRequestClose,
  onOpenSessionModal,
  onOpenLogModal,
  onResume,
}: SessionItemProps) {
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

  const needsInput = maestroSession?.needsInput?.active;

  const teamSnapshots = maestroSession?.teamMemberSnapshots?.length
    ? maestroSession.teamMemberSnapshots
    : maestroSession?.teamMemberSnapshot
      ? [maestroSession.teamMemberSnapshot]
      : [];

  const hasMaestroTeam = teamSnapshots.length > 0;

  const metadataAgentTool = (maestroSession?.metadata as { agentTool?: string } | undefined)?.agentTool ?? null;
  const agentTool = teamSnapshots[0]?.agentTool
    ?? metadataAgentTool
    ?? (s.effectId === 'codex' ? 'codex' : null);
  const agentToolIcon = agentTool && agentTool in AGENT_TOOL_ICONS
    ? AGENT_TOOL_ICONS[agentTool as keyof typeof AGENT_TOOL_ICONS]
    : null;

  const displayTitle = hasMaestroTeam
    ? teamSnapshots.map(m => m.name).join(', ')
    : s.name;

  const displayAvatar = hasMaestroTeam
    ? teamSnapshots.map(m => m.avatar).join('')
    : null;

  const isLive = isWorking || (maestroSession?.status === 'working' && !isExited && !isClosing);

  const sessionTaskList = useMemo(() => maestroSession
    ? maestroSession.taskIds
        .map((tid: string) => maestroTasks[tid])
        .filter((t): t is MaestroTask => t !== undefined)
    : [], [maestroSession, maestroTasks]);

  return (
    <SortableSessionItem key={s.id} id={s.id}>
    <div
      className={`sessionItem ${isActive ? "sessionItemActive" : ""} ${isExited ? "sessionItemExited" : ""
        } ${isClosing ? "sessionItemClosing" : ""} ${isSshType ? "sessionItemSsh" : ""
        } ${isPersistent ? "sessionItemPersistent" : ""} ${isDefaultType ? "sessionItemDefault" : ""
        } ${needsInput ? "sessionItemNeedsInput" : ""} ${!isActive ? "sessionItemCompact" : ""}`}
      onClick={() => onSelect(s.id)}
      style={{ flexDirection: 'column', alignItems: 'stretch' }}
      {...(s.maestroSessionId ? { 'data-maestro-session-id': s.maestroSessionId } : {})}
    >
      <div className="sessionItemRow">
        <div className="sessionAgentIcon">
          {agentToolIcon ? (
            <div className={`sessionAgentIcon__wrapper ${isLive ? 'sessionAgentIcon__wrapper--live' : ''}`}>
              <img className="sessionAgentIcon__img" src={agentToolIcon} alt={agentTool || 'agent'} />
              {isLive && <span className="sessionAgentIcon__liveDot" />}
            </div>
          ) : hasAgentIcon && effect?.iconSrc ? (
            <div className={`sessionAgentIcon__wrapper ${isLive ? 'sessionAgentIcon__wrapper--live' : ''}`}>
              <img className="sessionAgentIcon__img" src={effect.iconSrc} alt={chipLabel || 'agent'} />
              {isLive && <span className="sessionAgentIcon__liveDot" />}
            </div>
          ) : (
            <div className="sessionAgentIcon__placeholder">
              {isSshType ? '⊕' : '>_'}
            </div>
          )}
        </div>

        <div className="sessionMeta">
          <div className="sessionName">
            {displayAvatar && (
              <span className="sessionItemAvatar" title={teamSnapshots.map(m => `${m.name} (${m.role})`).join(', ')}>
                {displayAvatar}
              </span>
            )}
            <span className="sessionNameText">{displayTitle}</span>
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
          {isActive && hasMaestroTeam && (
            <div className="sessionItemSecondary">{s.name}</div>
          )}
        </div>

        {!isActive && maestroSession && (
          <span className={`sessionStatusBadge sessionStatusBadge--${maestroSession.status}`}>
            {maestroSession.status === 'spawning' ? 'SPAWN' : maestroSession.status === 'stopped' ? 'STOP' : maestroSession.status.toUpperCase()}
          </span>
        )}
      </div>

      {isActive && (
        <>
          {maestroSession && (
            <div className="sessionItemStatusRow">
              <span className={`sessionStatusBadge sessionStatusBadge--${maestroSession.status} sessionStatusBadge--clickable`}
                onClick={(e) => { e.stopPropagation(); onOpenSessionModal(maestroSession.id); }}>
                {maestroSession.status === 'spawning' ? 'SPAWN' : maestroSession.status === 'stopped' ? 'STOP' : maestroSession.status.toUpperCase()}
              </span>
              {needsInput && (
                <span className="sessionStatusBadge sessionStatusBadge--needsInput">NEEDS INPUT</span>
              )}
            </div>
          )}

          {sessionTaskList.length > 0 && (
            <div className="sessionItemTaskChips">
              {sessionTaskList.slice(0, 4).map(task => (
                <span key={task.id} className={`sessionTaskChip sessionTaskChip--${task.status}`} title={`${task.title} (${task.status})`}>
                  <span className="sessionTaskChip__dot" />
                  <span className="sessionTaskChip__label">{task.title}</span>
                </span>
              ))}
              {sessionTaskList.length > 4 && (
                <span className="sessionTaskChip sessionTaskChip--more">+{sessionTaskList.length - 4}</span>
              )}
            </div>
          )}

          {isExpanded && maestroSession && (
            <MaestroSessionContent
              session={maestroSession}
              tasks={contentTasks}
              allTasks={maestroTasks}
              loading={isLoadingTasks}
            />
          )}
          {isExpanded && !maestroSession && isLoadingTasks && (
            <div className="terminalSubtasks" style={{ padding: '8px 24px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
                Loading session data...
              </div>
            </div>
          )}

          <div className="sessionItemBottomActions">
            {s.maestroSessionId && (
              <button type="button"
                className={`sessionItemBottomBtn ${isExpanded ? 'sessionItemBottomBtn--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleExpand(s.id, s.maestroSessionId); }}
                title="Expand session details"
              >
                <Icon name="layers" size={12} />
                <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
              </button>
            )}
            <button type="button"
              className="sessionItemBottomBtn"
              onClick={(e) => { e.stopPropagation(); onOpenLogModal(s.id); }}
              title="View session log"
            >
              <Icon name="log" size={12} />
              <span>Logs</span>
            </button>
            {maestroSession
              && (maestroSession.metadata?.agentTool || 'claude-code') === 'claude-code' && (
              <button type="button"
                className="sessionItemBottomBtn sessionItemBottomBtn--resume"
                disabled={isResuming}
                onClick={(e) => { e.stopPropagation(); onResume(maestroSession.id); }}
                title="Resume this Claude session"
              >
                <Icon name="refresh" size={12} />
                <span>{isResuming ? 'Resuming...' : 'Resume'}</span>
              </button>
            )}
            <button type="button"
              className="sessionItemBottomBtn sessionItemBottomBtn--danger"
              disabled={isClosing}
              onClick={(e) => { e.stopPropagation(); onRequestClose(s); }}
              title="Close session"
            >
              <span>Close</span>
            </button>
          </div>
        </>
      )}
    </div>
    </SortableSessionItem>
  );
});

// ==================== SESSION TREE RENDERER ====================
interface SessionNodeRendererProps {
  node: SessionTreeNode;
  depth: number;
  tab: SessionSubTab;
  collapsedSessions: Set<string>;
  maestroColorMap: Map<string, TeamColor>;
  linkMap: Map<string, SessionTileLinkInfo>;
  activeLocalSessionId: string | null;
  maestroTasks: Record<string, MaestroTask>;
  resumingSessionId: string | null;
  onToggleCollapse: (sessionId: string) => void;
  onOpenDetail: (sessionId: string) => void;
  onJumpToTerminal: (session: MaestroSession, link: SessionTileLinkInfo | null) => void;
  onStop: (session: MaestroSession, link: SessionTileLinkInfo | null) => void;
  onResume: (sessionId: string) => void;
  onRestore: (session: MaestroSession) => void;
  onToggleHumanComplete: (session: MaestroSession) => void;
  onOpenTeamView: (session: MaestroSession) => void;
}

const SessionNodeRenderer = React.memo(function SessionNodeRenderer({
  node,
  depth,
  tab,
  collapsedSessions,
  maestroColorMap,
  linkMap,
  activeLocalSessionId,
  maestroTasks,
  resumingSessionId,
  onToggleCollapse,
  onOpenDetail,
  onJumpToTerminal,
  onStop,
  onResume,
  onRestore,
  onToggleHumanComplete,
  onOpenTeamView,
}: SessionNodeRendererProps) {
  const isCollapsed = collapsedSessions.has(node.id);
  const link = linkMap.get(node.id) ?? null;
  const teamColor = maestroColorMap.get(node.id) ?? null;
  const isActiveTerminal = Boolean(link && link.localSessionId === activeLocalSessionId);

  return (
    <div
      className={`sessionTreeNode ${depth > 0 ? "sessionTreeNode--child" : ""}`}
      data-maestro-session-id={node.id}
    >
      <SessionListItem
        session={node}
        depth={depth}
        teamColor={teamColor}
        childCount={node.children.length}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => onToggleCollapse(node.id)}
        link={link}
        isActiveTerminal={isActiveTerminal}
        maestroTasks={maestroTasks}
        tab={tab}
        onOpenDetail={onOpenDetail}
        onJumpToTerminal={onJumpToTerminal}
        onStop={onStop}
        onResume={onResume}
        onRestore={onRestore}
        onToggleHumanComplete={onToggleHumanComplete}
        onOpenTeamView={onOpenTeamView}
        isResuming={resumingSessionId === node.id}
      />
      {!isCollapsed && node.children.length > 0 && (
        <div className="sessionTreeChildren">
          {node.children.map((child) => (
            <SessionNodeRenderer
              key={child.id}
              node={child}
              depth={depth + 1}
              tab={tab}
              collapsedSessions={collapsedSessions}
              maestroColorMap={maestroColorMap}
              linkMap={linkMap}
              activeLocalSessionId={activeLocalSessionId}
              maestroTasks={maestroTasks}
              resumingSessionId={resumingSessionId}
              onToggleCollapse={onToggleCollapse}
              onOpenDetail={onOpenDetail}
              onJumpToTerminal={onJumpToTerminal}
              onStop={onStop}
              onResume={onResume}
              onRestore={onRestore}
              onToggleHumanComplete={onToggleHumanComplete}
              onOpenTeamView={onOpenTeamView}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const SessionsSection = React.memo(function SessionsSection({
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
  onCreateWhiteboard,
  onCloseSpace,
}: SessionsSectionProps) {
  // ==================== SEGMENTED FILTER ====================
  type SessionFilter = 'terminals' | 'sessions' | 'documents';
  const [activeFilters, setActiveFilters] = useState<Set<SessionFilter>>(
    new Set<SessionFilter>(['terminals', 'sessions', 'documents'])
  );

  const toggleFilter = useCallback((filter: SessionFilter) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        // Don't allow deselecting all — keep at least one
        if (next.size > 1) next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  }, []);

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
  // Maestro spawn-tree close confirmation (cascades to all sub-sessions)
  const [treeToClose, setTreeToClose] = React.useState<MaestroSession | null>(null);

  // Maestro session expansion state
  const [expandedSessions, setExpandedSessions] = React.useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = React.useState<Set<string>>(new Set());
  const [resumingSessionId, setResumingSessionId] = React.useState<string | null>(null);

  // Use Zustand store - WebSocket updates are automatic
  const maestroTasks = useMaestroStore((s) => s.tasks);
  const maestroSessions = useMaestroStore((s) => s.sessions);
  const fetchSession = useMaestroStore((s) => s.fetchSession);
  const resumeSession = useMaestroStore((s) => s.resumeSession);
  const setSessionHumanComplete = useMaestroStore((s) => s.setSessionHumanComplete);
  const setSessionArchived = useMaestroStore((s) => s.setSessionArchived);
  const hardRefresh = useMaestroStore((s) => s.hardRefresh);

  // Teams from store
  const teamsMap = useMaestroStore((s) => s.teams);

  const teamGroupData = useMemo(() => {
    return buildTeamGroups(sessions, maestroSessions, teamsMap);
  }, [sessions, maestroSessions, teamsMap]);

  const [showHistory, setShowHistory] = React.useState(false);
  const showTaskDetails = useUIStore((s) => s.sessionShowTaskDetails);
  const toggleSessionShowTaskDetails = useUIStore((s) => s.toggleSessionShowTaskDetails);
  const historyBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [historyDropdownPos, setHistoryDropdownPos] = React.useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (showHistory) {
      setHistoryDropdownPos(computeDropdownPos(historyBtnRef));
    }
  }, [showHistory, computeDropdownPos]);

  // Past sessions available for resume. Resume is allowed from ANY status:
  // the server-side `status` is unreliable and frequently sticks at 'working'/
  // 'spawning' for sessions whose terminal has actually exited, so we never gate
  // the history list on it — every session in the project is resumable here.
  const historySessions = useMemo(() => {
    return Object.values(maestroSessions)
      .filter(s => s.projectId === activeProjectId)
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [maestroSessions, activeProjectId]);

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    if (!activeProjectId || refreshing) return;
    setRefreshing(true);
    try {
      await hardRefresh(activeProjectId);
    } catch (err) {
    } finally {
      setRefreshing(false);
    }
  }, [activeProjectId, refreshing, hardRefresh]);

  const handleShowBoard = React.useCallback(() => {
    useUIStore.getState().setShowBoardRequested(true);
  }, []);

  // Compute session tasks from global state
  const sessionTasks = React.useMemo(() => {
    const result: Record<string, MaestroTask[]> = {};

    for (const session of sessions) {
      if (session.maestroSessionId && expandedSessions.has(session.id)) {
        const maestroSession = maestroSessions[session.maestroSessionId];

        if (maestroSession) {
          const tasks = maestroSession.taskIds
            .map((taskId: string) => maestroTasks[taskId])
            .filter((task): task is MaestroTask => task !== undefined);

          result[session.id] = tasks;
        }
      }
    }

    return result;
  }, [maestroSessions, maestroTasks, sessions, expandedSessions]);

  // Fetch Maestro data for a session (using global context)
  const fetchMaestroData = useCallback(async (sessionId: string, maestroSessionId: string) => {
    setLoadingTasks(prev => new Set(prev).add(sessionId));
    try {
      await fetchSession(maestroSessionId);
    } catch (err) {
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }, [fetchSession]);

  // Function to toggle session expansion
  const toggleSession = useCallback((sessionId: string, maestroSessionId?: string | null) => {
    if (!maestroSessionId) return;

    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
        fetchMaestroData(sessionId, maestroSessionId);
      }
      return next;
    });
  }, [fetchMaestroData]);

  React.useEffect(() => {
    if (!settingsOpen && !showHistory) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSettingsOpen(false);
      setShowHistory(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen, showHistory]);

  // Non-session spaces (whiteboards, documents)
  const allSpaces = useSpacesStore((s) => s.spaces);
  const projectSpaces = useMemo(
    () => allSpaces.filter((s) => s.projectId === activeProjectId),
    [allSpaces, activeProjectId],
  );

  // Filter sessions based on active filters
  const showTerminals = activeFilters.has('terminals');
  const showSessions = activeFilters.has('sessions');
  const showDocuments = activeFilters.has('documents');

  // Plain local terminals only (maestro sessions render via the tree below).
  const filteredTerminalSessions = useMemo(() => {
    if (!showTerminals) return [];
    return sessions.filter((s) => !s.maestroSessionId);
  }, [sessions, showTerminals]);

  const filteredSpaces = useMemo(() => {
    return showDocuments ? projectSpaces : [];
  }, [projectSpaces, showDocuments]);

  // Grouped spaces in fixed display order: Drawings → Documents → Files
  const spaceGroups = useMemo(() => {
    const drawings = filteredSpaces.filter((s) => s.type === "whiteboard");
    const documents = filteredSpaces.filter((s) => s.type === "document");
    const files = filteredSpaces.filter((s) => s.type === "file");
    return [
      { key: "whiteboard" as const, label: "Drawings", items: drawings },
      { key: "document" as const, label: "Documents", items: documents },
      { key: "file" as const, label: "Files", items: files },
    ];
  }, [filteredSpaces]);

  // Phase 3: Memoize SortableContext items (plain terminals only)
  const sortableSessionIds = useMemo(
    () => filteredTerminalSessions.map((s) => s.id),
    [filteredTerminalSessions],
  );

  // Phase 5: Stable callbacks for SessionItem
  // Closing a session's terminal also archives its maestro session record
  // (moves it to the Archived tab). The record stays intact and resumable.
  const closeAndArchive = useCallback((session: Session) => {
    if (session.maestroSessionId) {
      void setSessionArchived(session.maestroSessionId, true);
    }
    onCloseSession(session.id);
  }, [onCloseSession, setSessionArchived]);

  const handleRequestClose = useCallback((session: Session) => {
    const isActiveSession = !session.exited && !session.closing;
    if (isActiveSession) {
      setSessionToClose(session);
    } else {
      closeAndArchive(session);
    }
  }, [closeAndArchive]);

  const handleResume = useCallback(async (maestroSessionId: string) => {
    setResumingSessionId(maestroSessionId);
    try {
      await resumeSession(maestroSessionId);
      // Resuming revives the session — pull it back out of the Archived tab.
      if (maestroSessions[maestroSessionId]?.archivedAt) {
        void setSessionArchived(maestroSessionId, false);
      }
    } catch (err) {
      console.error('Failed to resume session:', err);
      useUIStore.getState().reportError('Failed to resume session', err);
    } finally {
      setResumingSessionId(null);
    }
  }, [resumeSession, maestroSessions, setSessionArchived]);

  // ==================== MAESTRO SESSION TREE ====================
  const [collapsedSessions, setCollapsedSessions] = React.useState<Set<string>>(new Set());
  const [sessionSubTab, setSessionSubTab] = React.useState<SessionSubTab>('active');

  // All maestro sessions in this project (source of truth for the tree)
  const projectMaestroSessions = useMemo(() => {
    return Object.values(maestroSessions).filter((s) => s.projectId === activeProjectId);
  }, [maestroSessions, activeProjectId]);

  const { roots: sessionRoots } = useSessionTree(projectMaestroSessions);

  // Map maestroSessionId -> team color (independent of nesting)
  const maestroColorMap = useMemo(() => {
    const map = new Map<string, TeamColor>();
    for (const group of teamGroupData.groups) {
      map.set(group.coordinatorMaestroSessionId, group.color);
      for (const wId of group.workerMaestroSessionIds) {
        map.set(wId, group.color);
      }
    }
    return map;
  }, [teamGroupData.groups]);

  // Map maestroSessionId -> live local terminal info
  const linkMap = useMemo(() => {
    const map = new Map<string, SessionTileLinkInfo>();
    for (const s of sessions) {
      if (s.maestroSessionId) {
        map.set(s.maestroSessionId, { localSessionId: s.id, exited: Boolean(s.exited) });
      }
    }
    return map;
  }, [sessions]);

  // parentSessionId → child ids, for cascading lifecycle actions across a spawn tree.
  const childrenByParentId = useMemo(
    () => buildChildrenByParent(projectMaestroSessions),
    [projectMaestroSessions],
  );

  // All session ids in the spawn subtree rooted at rootId (inclusive).
  const collectSubtreeIds = useCallback(
    (rootId: string): string[] => collectSubtreeIdsUtil(rootId, childrenByParentId),
    [childrenByParentId],
  );

  // A root is "live" when it — or any session in its spawn subtree — has a live
  // (non-exited) local terminal. This is what makes a tree Active vs Inactive.
  const hasLiveTerminal = useCallback(
    (rootId: string): boolean =>
      collectSubtreeIds(rootId).some((id) => {
        const l = linkMap.get(id);
        return Boolean(l && !l.exited);
      }),
    [collectSubtreeIds, linkMap],
  );

  // Tab resolution is liveness-driven: Archived (archivedAt) always wins; otherwise
  // a root is Active when its subtree has a live terminal, else Inactive. The
  // humanCompletedAt timestamp is a marker only (✓ "done by you") — it does NOT
  // move a session between tabs. Children always render under their visible root.
  const visibleRoots = useMemo(() => {
    return sessionRoots.filter(
      (root) => resolveSessionTab(root, hasLiveTerminal(root.id)) === sessionSubTab,
    );
  }, [sessionRoots, sessionSubTab, hasLiveTerminal]);

  // Counts for the Active / Inactive / Archived sub-tabs (by root, matching each tab).
  const sessionTabCounts = useMemo(() => {
    const counts = { active: 0, inactive: 0, archived: 0 };
    for (const root of sessionRoots) counts[resolveSessionTab(root, hasLiveTerminal(root.id))]++;
    return counts;
  }, [sessionRoots, hasLiveTerminal]);

  // Sessions in this project with a live (non-exited) terminal — the "running live" count
  const liveCount = useMemo(() => {
    let n = 0;
    for (const s of projectMaestroSessions) {
      const link = linkMap.get(s.id);
      if (link && !link.exited) n++;
    }
    return n;
  }, [projectMaestroSessions, linkMap]);

  const handleToggleSessionCollapse = useCallback((sessionId: string) => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);

  const handleOpenSessionDetail = useCallback((maestroSessionId: string) => {
    useUIStore.getState().setSessionDetailOverlay({ sessionId: maestroSessionId, projectId: activeProjectId });
  }, [activeProjectId]);

  const handleJumpToTerminal = useCallback((session: MaestroSession, link: SessionTileLinkInfo | null) => {
    if (link && !link.exited) {
      onSelectSession(link.localSessionId);
    } else {
      void handleResume(session.id);
    }
  }, [onSelectSession, handleResume]);

  // Close a maestro session AND its entire spawn subtree as a unit: stop every
  // live descendant terminal and archive every node. This keeps a coordinator and
  // its workers in the same tab — no orphaned live children, no archived child
  // stranded under an active root.
  const closeAndArchiveTree = useCallback((root: MaestroSession) => {
    for (const id of collectSubtreeIds(root.id)) {
      const link = linkMap.get(id);
      if (link) onCloseSession(link.localSessionId); // stop terminal if one exists
      void setSessionArchived(id, true);
    }
  }, [collectSubtreeIds, linkMap, onCloseSession, setSessionArchived]);

  const handleRestoreTree = useCallback((root: MaestroSession) => {
    for (const id of collectSubtreeIds(root.id)) {
      void setSessionArchived(id, false);
    }
  }, [collectSubtreeIds, setSessionArchived]);

  const handleStopSession = useCallback((session: MaestroSession, _link: SessionTileLinkInfo | null) => {
    const hasLiveTerminal = collectSubtreeIds(session.id).some((id) => {
      const l = linkMap.get(id);
      return l && !l.exited;
    });
    if (hasLiveTerminal) {
      // Live terminal(s) somewhere in the subtree → confirm before stopping them.
      setTreeToClose(session);
    } else {
      // Nothing live to stop — archive the whole subtree immediately.
      closeAndArchiveTree(session);
    }
  }, [collectSubtreeIds, linkMap, closeAndArchiveTree]);

  // "Mark done" stamps humanCompletedAt (the ✓ "done by you" marker) AND stops the
  // session's own live terminal, so a marked-done session lands in Inactive. Toggling
  // it back off just clears the marker (the terminal is already stopped).
  const handleToggleHumanComplete = useCallback((session: MaestroSession) => {
    const markDone = !session.humanCompletedAt;
    void setSessionHumanComplete(session.id, markDone);
    if (markDone) {
      const link = linkMap.get(session.id);
      if (link && !link.exited) onCloseSession(link.localSessionId);
    }
  }, [setSessionHumanComplete, linkMap, onCloseSession]);

  const handleOpenTeamView = useCallback((session: MaestroSession) => {
    useUIStore.getState().setTeamViewRootId(session.id);
  }, []);

  // Helper to render a session item using the extracted SessionItem component
  const renderSessionItem = useCallback((s: Session, teamColor: TeamColor | null) => {
    const maestroSession = s.maestroSessionId ? maestroSessions[s.maestroSessionId] ?? null : null;
    return (
      <SessionItem
        key={s.id}
        session={s}
        teamColor={teamColor}
        isActive={s.id === activeSessionId}
        isExpanded={expandedSessions.has(s.id)}
        maestroSession={maestroSession}
        maestroTasks={maestroTasks}
        contentTasks={sessionTasks[s.id] || []}
        isLoadingTasks={loadingTasks.has(s.id)}
        isResuming={resumingSessionId === (maestroSession?.id ?? '')}
        onSelect={onSelectSession}
        onToggleExpand={toggleSession}
        onRequestClose={handleRequestClose}
        onOpenSessionModal={setSessionModalId}
        onOpenLogModal={setLogModalSessionId}
        onResume={handleResume}
      />
    );
  }, [activeSessionId, expandedSessions, maestroSessions, maestroTasks, sessionTasks, loadingTasks, resumingSessionId, onSelectSession, toggleSession, handleRequestClose, handleResume]);

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
          <button
            type="button"
            className={`btnSmall btnIcon ${showTaskDetails ? "btnIconActive" : ""}`}
            onClick={toggleSessionShowTaskDetails}
            title={showTaskDetails ? "Hide linked task details on session tiles" : "Show linked task details on session tiles"}
            aria-label="Toggle task details on session tiles"
            aria-pressed={showTaskDetails}
          >
            <Icon name="check-square" />
          </button>
          <button
            ref={historyBtnRef}
            type="button"
            className={`btnSmall btnIcon ${showHistory ? "btnIconActive" : ""}`}
            onClick={() => setShowHistory(prev => !prev)}
            disabled={!activeProjectId}
            title="Session history"
            aria-label="Session history"
          >
            <Icon name="clock" />
            {historySessions.length > 0 && (
              <span className="iconRailBadge iconRailBadge--history">{historySessions.length > 99 ? '99+' : historySessions.length}</span>
            )}
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

      {/* Session History Dropdown */}
      {showHistory && historyDropdownPos && createPortal(
        <>
          <div
            className="terminalInlineStatusOverlay"
            onClick={() => setShowHistory(false)}
          />
          <div
            className="sessionHistoryDropdown"
            style={{ position: 'fixed', top: historyDropdownPos.top, right: historyDropdownPos.right }}
          >
            <div className="sessionHistoryDropdown__header">
              <span>Session History</span>
              <span className="sessionHistoryDropdown__count">{historySessions.length}</span>
            </div>
            {historySessions.length === 0 ? (
              <div className="sessionHistoryDropdown__empty">No past sessions</div>
            ) : (
              <VirtualizedHistoryList
                historySessions={historySessions}
                resumingSessionId={resumingSessionId}
                setResumingSessionId={setResumingSessionId}
                resumeSession={resumeSession}
                setShowHistory={setShowHistory}
                maestroTasks={maestroTasks}
              />
            )}
          </div>
        </>,
        document.body
      )}

      <div className="agentShortcutRow" role="toolbar" aria-label="Quick launch">
        <button
          type="button"
          className="agentShortcutBtn agentShortcutBtn--icon agentShortcutBtn--terminal"
          onClick={onOpenNewSession}
          aria-label="New terminal"
          title="New terminal"
        >
          <span className="agentShortcutIconFallback" aria-hidden="true">
            {">_"}
          </span>
        </button>
        {agentShortcuts.map((effect) => (
          <button
            key={effect.id}
            type="button"
            className={`agentShortcutBtn agentShortcutBtn--icon agentShortcutBtn--${effect.id}`}
            onClick={() => onQuickStart(effect)}
            aria-label={`Start ${effect.label}`}
            title={`Start ${effect.label}`}
          >
            {effect.iconSrc ? (
              <img className="agentShortcutIcon" src={effect.iconSrc} alt="" aria-hidden="true" />
            ) : (
              <span className="agentShortcutIconFallback" aria-hidden="true">
                {"\u25B6"}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Segmented filter: Terminals / Sessions / Documents */}
      <div className="sessionsSegmentedFilter">
        {(['terminals', 'sessions', 'documents'] as SessionFilter[]).map(filter => (
          <button
            key={filter}
            type="button"
            className={`sessionsSegmentedFilter__btn ${activeFilters.has(filter) ? 'sessionsSegmentedFilter__btn--active' : ''}`}
            onClick={() => toggleFilter(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Sub-tabs for the maestro session tree */}
      {showSessions && (
        <div className="sessionSubTabs" role="tablist" aria-label="Session filter">
          {(['active', 'inactive', 'archived'] as SessionSubTab[]).map((tab) => {
            const count = sessionTabCounts[tab];
            const label = tab === 'active' ? 'Active' : tab === 'inactive' ? 'Inactive' : 'Archived';
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={sessionSubTab === tab}
                className={`sessionSubTabs__btn ${sessionSubTab === tab ? 'sessionSubTabs__btn--active' : ''}`}
                onClick={() => setSessionSubTab(tab)}
              >
                <span>{label}</span>
                {count > 0 && <span className="sessionSubTabs__count">{count}</span>}
              </button>
            );
          })}
          {liveCount > 0 && (
            <span className="sessionSubTabs__live" title={`${liveCount} running live`}>
              <span className="sessionSubTabs__liveDot" />
              <span className="sessionSubTabs__liveText">{liveCount} live</span>
            </span>
          )}
        </div>
      )}

      <div className="sessionList">
        {sessions.length === 0 && projectMaestroSessions.length === 0 ? (
          <div className="empty">No sessions in this project.</div>
        ) : (
          <>
            {/* Maestro session tree (spawn-chain hierarchy) */}
            {showSessions && (
              visibleRoots.length === 0 ? (
                <div className="sessionEmptyState">
                  <span className="sessionEmptyState__icon" aria-hidden="true">
                    {sessionSubTab === 'active' ? '◉' : sessionSubTab === 'inactive' ? '○' : '▫'}
                  </span>
                  <span className="sessionEmptyState__title">
                    {sessionSubTab === 'active'
                      ? 'No active sessions'
                      : sessionSubTab === 'inactive'
                        ? 'No inactive sessions'
                        : 'No archived sessions'}
                  </span>
                  <span className="sessionEmptyState__hint">
                    {sessionSubTab === 'active'
                      ? 'Spawn or resume a session to get started.'
                      : sessionSubTab === 'inactive'
                        ? 'Sessions whose terminal has stopped land here. Resume to reactivate.'
                        : 'Closing a session with ✕ moves it here.'}
                  </span>
                </div>
              ) : (
                <div className="sessionTree">
                  {visibleRoots.map((root) => (
                    <SessionNodeRenderer
                      key={root.id}
                      node={root}
                      depth={0}
                      tab={sessionSubTab}
                      collapsedSessions={collapsedSessions}
                      maestroColorMap={maestroColorMap}
                      linkMap={linkMap}
                      activeLocalSessionId={activeSessionId}
                      maestroTasks={maestroTasks}
                      resumingSessionId={resumingSessionId}
                      onToggleCollapse={handleToggleSessionCollapse}
                      onOpenDetail={handleOpenSessionDetail}
                      onJumpToTerminal={handleJumpToTerminal}
                      onStop={handleStopSession}
                      onResume={handleResume}
                      onRestore={handleRestoreTree}
                      onToggleHumanComplete={handleToggleHumanComplete}
                      onOpenTeamView={handleOpenTeamView}
                    />
                  ))}
                </div>
              )
            )}

            {/* Plain terminals (non-maestro) keep the sortable list */}
            {showTerminals && filteredTerminalSessions.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortableSessionIds}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredTerminalSessions.map((s) => renderSessionItem(s, null))}
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
      </div>

      {/* Spaces — grouped: Drawings → Documents → Files */}
      {showDocuments && (filteredSpaces.length > 0 || onCreateWhiteboard) && (
        <div className="spacesGroups">
          {spaceGroups.map((group) => {
            if (group.items.length === 0) return null;
            return (
              <div className="spacesGroup" key={group.key}>
                <div className="spacesGroup__header">
                  <span className="spacesGroup__label">{group.label}</span>
                  <span className="spacesGroup__count">{group.items.length}</span>
                  {group.key === "whiteboard" && onCreateWhiteboard && (
                    <button
                      type="button"
                      className="spacesGroup__add"
                      onClick={onCreateWhiteboard}
                      title="New Whiteboard"
                      aria-label="New Whiteboard"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12">
                        <line x1="8" y1="3" x2="8" y2="13" strokeLinecap="round" />
                        <line x1="3" y1="8" x2="13" y2="8" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="spacesGroup__list">
                  {group.items.map((space) => {
                    const isActive = space.id === activeSessionId;
                    let meta = "";
                    if (space.type === "whiteboard") {
                      meta = formatSpaceAgo(space.createdAt);
                    } else if (space.type === "document") {
                      const src = space.doc.sessionName ? `from ${space.doc.sessionName}` : "";
                      const when = formatSpaceAgo(space.doc.addedAt ?? space.createdAt);
                      meta = [src, when].filter(Boolean).join(" · ");
                    } else {
                      const ext = space.filePath.split(".").pop()?.toLowerCase() || "";
                      const loc = space.provider === "ssh" && space.sshTarget ? space.sshTarget : space.rootDir;
                      meta = [loc, ext].filter(Boolean).join(" · ");
                    }
                    return (
                      <div
                        key={space.id}
                        className={`spaceTile spaceTile--${space.type} ${isActive ? "spaceTile--active" : ""}`}
                        onClick={() => onSelectSession(space.id)}
                        title={space.name}
                      >
                        <span className="spaceTile__icon" aria-hidden="true">
                          {space.type === "whiteboard" ? (
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                              <path d="M3 17l3.5-3.5M6.5 13.5l-2-2L14 2l2 2L6.5 13.5z" strokeLinejoin="round" />
                              <path d="M12 4l2 2" strokeLinecap="round" />
                            </svg>
                          ) : space.type === "file" ? (
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                              <path d="M5 2h7l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" />
                              <path d="M12 2v4h4" />
                              <path d="M8 11l-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M12 11l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                              <path d="M5 2h7l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" />
                              <path d="M12 2v4h4" />
                              <path d="M7 10h6M7 13h4" strokeLinecap="round" />
                            </svg>
                          )}
                        </span>
                        <span className="spaceTile__body">
                          <span className="spaceTile__name">{space.name}</span>
                          {meta && <span className="spaceTile__meta">{meta}</span>}
                        </span>
                        {onCloseSpace && (
                          <button
                            type="button"
                            className="spaceTile__close"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseSpace(space.id);
                            }}
                            title={`Close ${space.type}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
        const logMaestroSession = logSession?.maestroSessionId ? maestroSessions[logSession.maestroSessionId] ?? null : null;
        const logSnapshots = logMaestroSession?.teamMemberSnapshots?.length
          ? logMaestroSession.teamMemberSnapshots
          : logMaestroSession?.teamMemberSnapshot
            ? [logMaestroSession.teamMemberSnapshot]
            : [];
        const logMetadataAgentTool = (logMaestroSession?.metadata as { agentTool?: string } | undefined)?.agentTool ?? null;
        const logAgentTool = logSnapshots[0]?.agentTool
          ?? logMetadataAgentTool
          ?? (logSession?.effectId === 'codex' ? 'codex' : null);
        return logSession?.cwd ? createPortal(
          <SessionLogModal
            sessionName={logSession.name}
            cwd={logSession.cwd}
            maestroSessionId={logSession.maestroSessionId}
            agentTool={logAgentTool}
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
            closeAndArchive(sessionToClose);
            setSessionToClose(null);
          }}
        />,
        document.body
      )}

      {treeToClose && (() => {
        const subtreeIds = collectSubtreeIds(treeToClose.id);
        const childCount = subtreeIds.length - 1;
        const liveCount = subtreeIds.filter((id) => {
          const l = linkMap.get(id);
          return l && !l.exited;
        }).length;
        const name = treeToClose.teamMemberSnapshot?.name || treeToClose.name || treeToClose.id.slice(0, 12);
        return createPortal(
          <ConfirmActionModal
            isOpen={true}
            title="[ CLOSE SESSION ]"
            message={
              <>
                Close <strong>{name}</strong>
                {childCount > 0 && <> and its {childCount} sub-session{childCount === 1 ? '' : 's'}</>}?
                {liveCount > 0 && (
                  <div style={{ marginTop: '8px', color: 'var(--warning)' }}>
                    {liveCount} live terminal{liveCount === 1 ? '' : 's'} will be stopped. The session record{childCount > 0 ? 's stay' : ' stays'} in Archived.
                  </div>
                )}
              </>
            }
            confirmLabel="Close Session"
            cancelLabel="Cancel"
            confirmDanger={true}
            onClose={() => setTreeToClose(null)}
            onConfirm={() => {
              closeAndArchiveTree(treeToClose);
              setTreeToClose(null);
            }}
          />,
          document.body
        );
      })()}

    </>
  );
});
