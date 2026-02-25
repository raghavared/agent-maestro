import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TeamGroup } from '../../utils/teamGrouping';
import type { TerminalRegistry } from '../../SessionTerminal';
import { useMaestroStore } from '../../stores/useMaestroStore';
import { useSessionStore } from '../../stores/useSessionStore';

interface TeamViewProps {
  group: TeamGroup;
  registry: React.MutableRefObject<TerminalRegistry>;
  onClose: () => void;
  onSelectSession: (id: string) => void;
}

interface SlotInfo {
  localSessionId: string;
  maestroSessionId: string;
  label: string;
  avatar: string;
  status: string;
  isCoordinator: boolean;
}

/**
 * TeamView renders a full-screen overlay with terminal slots.
 * Terminals are reparented (DOM appendChild) into slot host divs
 * so they escape stacking contexts. On unmount, terminals are
 * moved back to their original parent.
 */
export const TeamView = React.memo(function TeamView({
  group,
  registry,
  onClose,
  onSelectSession,
}: TeamViewProps) {
  const maestroSessions = useMaestroStore((s) => s.sessions);
  const setActiveId = useSessionStore((s) => s.setActiveId);

  // Stable ref for the registry
  const registryRef = useRef(registry);
  registryRef.current = registry;
  // Overlay body ref for ResizeObserver
  const bodyRef = useRef<HTMLDivElement>(null);

  // --- Resizable split state ---
  const [coordFraction, setCoordFraction] = useState(0.5);
  const resizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartFractionRef = useRef(0.5);

  // Build slot info for coordinator + workers
  const slots: SlotInfo[] = useMemo(() => {
    const result: SlotInfo[] = [];

    const coordMs = maestroSessions.get(group.coordinatorMaestroSessionId);
    const coordSnap = coordMs?.teamMemberSnapshots?.[0] || (coordMs as any)?.teamMemberSnapshot;
    if (group.coordinatorLocalSessionId) {
      result.push({
        localSessionId: group.coordinatorLocalSessionId,
        maestroSessionId: group.coordinatorMaestroSessionId,
        label: coordSnap?.name || coordMs?.name || 'Coordinator',
        avatar: coordSnap?.avatar || '\u{1F451}',
        status: coordMs?.status || 'idle',
        isCoordinator: true,
      });
    }

    for (let i = 0; i < group.workerMaestroSessionIds.length; i++) {
      const msId = group.workerMaestroSessionIds[i];
      const localId = group.workerLocalSessionIds[i];
      if (!localId) continue;

      const ms = maestroSessions.get(msId);
      const snap = ms?.teamMemberSnapshots?.[0] || (ms as any)?.teamMemberSnapshot;
      result.push({
        localSessionId: localId,
        maestroSessionId: msId,
        label: snap?.name || ms?.name || 'Worker',
        avatar: snap?.avatar || '\u26A1',
        status: ms?.status || 'idle',
        isCoordinator: false,
      });
    }

    return result;
  }, [group, maestroSessions]);

  const coordinatorSlot = slots.find((s) => s.isCoordinator) || null;
  const workerSlots = slots.filter((s) => !s.isCoordinator);
  const hasCoordinator = coordinatorSlot !== null;
  const hasWorkers = workerSlots.length > 0;

  // --- Close on Escape ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // --- Resize handle drag logic ---
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      resizeStartXRef.current = e.clientX;
      resizeStartFractionRef.current = coordFraction;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [coordFraction],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current || !bodyRef.current) return;
      const bodyRect = bodyRef.current.getBoundingClientRect();
      const dx = e.clientX - resizeStartXRef.current;
      const newFraction = resizeStartFractionRef.current + dx / bodyRect.width;
      setCoordFraction(Math.max(0.2, Math.min(0.8, newFraction)));
    };

    const handleMouseUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // --- Click/double-click on slot ---
  const handleSlotDoubleClick = useCallback(
    (localSessionId: string) => {
      setActiveId(localSessionId);
      onSelectSession(localSessionId);
      onClose();
    },
    [setActiveId, onSelectSession, onClose],
  );

  // --- Team label ---
  const teamLabel = useMemo(() => {
    if (group.teamName) return `${group.teamAvatar || '\u{1F46A}'} ${group.teamName}`;
    const coordMs = maestroSessions.get(group.coordinatorMaestroSessionId);
    const coordSnap = coordMs?.teamMemberSnapshots?.[0] || (coordMs as any)?.teamMemberSnapshot;
    if (coordSnap) return `${coordSnap.avatar} ${coordSnap.name}`;
    return coordMs?.name || 'Team';
  }, [group, maestroSessions]);

  const statusLabel =
    group.status === 'active' ? 'Active' : group.status === 'done' ? 'Done' : 'Idle';

  // Compute flex styles for the split
  const coordStyle = hasCoordinator && hasWorkers
    ? { flex: `0 0 calc(${coordFraction * 100}% - 3px)` }
    : undefined;
  const workersStyle = hasCoordinator && hasWorkers
    ? { flex: `0 0 calc(${(1 - coordFraction) * 100}% - 3px)` }
    : undefined;

  return createPortal(
    <div className="teamViewOverlay">
      <div className="teamViewContainer">
        {/* Header */}
        <div className="teamViewHeader">
          <div className="teamViewHeaderLeft">
            <span className="teamViewHeaderLabel">{teamLabel}</span>
            <span
              className={`teamViewHeaderStatus teamViewHeaderStatus--${group.status}`}
            >
              {statusLabel}
            </span>
            <span className="teamViewHeaderCount">
              {slots.length} {slots.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <div className="teamViewHeaderRight">
            <span className="teamViewHeaderHint">double-click to open / Esc to close</span>
            <button className="teamViewCloseBtn" onClick={onClose} title="Close team view (Esc)">
              {'\u2715'}
            </button>
          </div>
        </div>

        {/* Body: coordinator left, workers right */}
        <div className="teamViewBody" ref={bodyRef}>
          {/* Coordinator panel - left side, full height */}
          {coordinatorSlot && (
            <div
              className="teamViewCoordinator"
              data-maestro-session-id={coordinatorSlot.maestroSessionId}
              style={{
                '--team-color': group.color.primary,
                '--team-color-dim': group.color.dim,
                '--team-color-border': group.color.border,
                ...(coordStyle || {}),
              } as React.CSSProperties}
            >
              <div className="teamViewSlotHeader">
                <span className="teamViewSlotAvatar">{coordinatorSlot.avatar}</span>
                <span className="teamViewSlotName">{coordinatorSlot.label}</span>
                <span className="teamViewSlotRole">coordinator</span>
                <span
                  className={`teamViewSlotStatus teamViewSlotStatus--${coordinatorSlot.status}`}
                >
                  {coordinatorSlot.status}
                </span>
              </div>
              <TeamViewTerminalSlot
                sessionId={coordinatorSlot.localSessionId}
                registry={registry}
                onDoubleClick={() => handleSlotDoubleClick(coordinatorSlot.localSessionId)}
              />
            </div>
          )}

          {/* Resize handle between coordinator and workers */}
          {hasCoordinator && hasWorkers && (
            <div
              className="teamViewResizeHandle"
              onMouseDown={handleResizeStart}
            />
          )}

          {/* Workers panel - right side, split horizontally */}
          {workerSlots.length > 0 && (
            <div className="teamViewWorkers" style={workersStyle as React.CSSProperties}>
              {workerSlots.map((worker) => (
                <div
                  key={worker.localSessionId}
                  className="teamViewWorkerSlot"
                  data-maestro-session-id={worker.maestroSessionId}
                  style={{
                    '--team-color': group.color.primary,
                    '--team-color-dim': group.color.dim,
                    '--team-color-border': group.color.border,
                  } as React.CSSProperties}
                >
                  <div className="teamViewSlotHeader">
                    <span className="teamViewSlotAvatar">{worker.avatar}</span>
                    <span className="teamViewSlotName">{worker.label}</span>
                    <span
                      className={`teamViewSlotStatus teamViewSlotStatus--${worker.status}`}
                    >
                      {worker.status}
                    </span>
                  </div>
                  <TeamViewTerminalSlot
                    sessionId={worker.localSessionId}
                    registry={registry}
                    onDoubleClick={() => handleSlotDoubleClick(worker.localSessionId)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
});

/**
 * Reparents a terminal DOM element into this slot's host div.
 * On unmount, moves it back to its original parent.
 * Same pattern as Board's ResizableSessionColumn.
 */
const TeamViewTerminalSlot = React.memo(function TeamViewTerminalSlot({
  sessionId,
  registry,
  onDoubleClick,
}: {
  sessionId: string;
  registry: React.MutableRefObject<TerminalRegistry>;
  onDoubleClick: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const terminalEl = document.querySelector(
      `[data-terminal-id="${sessionId}"]`,
    ) as HTMLElement | null;
    if (!terminalEl) return;

    const originalParent = terminalEl.parentElement;
    const wasHidden = terminalEl.classList.contains('terminalHidden');

    // Move terminal into our host div (escapes stacking context)
    host.appendChild(terminalEl);
    terminalEl.classList.remove('terminalHidden');
    terminalEl.classList.add('terminalInTeamView');

    // Fit terminal to new container size
    const reg = registry.current;
    const entry = reg.get(sessionId);
    const fitTerminal = () => {
      if (entry) {
        try {
          entry.fit.fit();
          entry.term.scrollToBottom();
        } catch { /* ignore */ }
      }
    };
    // Double RAF to ensure layout is settled
    requestAnimationFrame(() => requestAnimationFrame(fitTerminal));

    // Auto-scroll to bottom on new output
    let scrollDisposable: { dispose: () => void } | null = null;
    if (entry) {
      scrollDisposable = entry.term.onWriteParsed(() => {
        try { entry.term.scrollToBottom(); } catch { /* ignore */ }
      });
    }

    return () => {
      scrollDisposable?.dispose();
      // Move terminal back to original parent
      terminalEl.classList.remove('terminalInTeamView');
      if (originalParent) {
        originalParent.appendChild(terminalEl);
      }
      if (wasHidden) {
        terminalEl.classList.add('terminalHidden');
      } else {
        // Restore visibility based on current active session
        const activeId = useSessionStore.getState().activeId;
        if (sessionId !== activeId) {
          terminalEl.classList.add('terminalHidden');
        }
      }
      // Re-fit after moving back
      if (entry) {
        requestAnimationFrame(() => {
          try { entry.fit.fit(); } catch { /* ignore */ }
        });
      }
    };
  }, [sessionId, registry]);

  return (
    <div
      className="teamViewSlotTerminal teamViewSlotTerminal--host"
      ref={hostRef}
      onDoubleClick={onDoubleClick}
    />
  );
});
