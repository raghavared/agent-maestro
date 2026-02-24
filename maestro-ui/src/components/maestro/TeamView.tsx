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
 * TeamView renders a full-screen overlay that visually positions
 * existing terminal containers over placeholder slots using CSS
 * `position: fixed`. Terminals are NEVER moved in the DOM — they
 * remain children of AppWorkspace's terminalPane so React can
 * freely mount/unmount them without crashing.
 */
export const TeamView = React.memo(function TeamView({
  group,
  registry,
  onClose,
  onSelectSession,
}: TeamViewProps) {
  const maestroSessions = useMaestroStore((s) => s.sessions);
  const setActiveId = useSessionStore((s) => s.setActiveId);

  // Slot placeholder refs (used to measure positions)
  const slotsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // Track which terminals we've styled so cleanup is safe
  const styledSessionsRef = useRef<Set<string>>(new Set());
  // Stable ref for the registry (never changes)
  const registryRef = useRef(registry);
  registryRef.current = registry;
  // Overlay body ref for ResizeObserver
  const bodyRef = useRef<HTMLDivElement>(null);

  // --- Resizable split state ---
  // coordinatorFraction: 0..1 — fraction of body width for coordinator panel
  const [coordFraction, setCoordFraction] = useState(0.5);
  const resizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartFractionRef = useRef(0.5);

  // Build slot info for coordinator + workers
  const slots: SlotInfo[] = useMemo(() => {
    const result: SlotInfo[] = [];

    console.log('[TeamView] Building slots from group:', {
      coordinatorMaestroSessionId: group.coordinatorMaestroSessionId,
      coordinatorLocalSessionId: group.coordinatorLocalSessionId,
      workerMaestroSessionIds: group.workerMaestroSessionIds,
      workerLocalSessionIds: group.workerLocalSessionIds,
      teamSessionId: group.teamSessionId,
    });

    const coordMs = maestroSessions.get(group.coordinatorMaestroSessionId);
    const coordSnap = coordMs?.teamMemberSnapshots?.[0] || (coordMs as any)?.teamMemberSnapshot;
    console.log('[TeamView] Coordinator maestro session:', coordMs ? { id: coordMs.id, status: coordMs.status, name: coordMs.name } : 'NOT FOUND');

    if (group.coordinatorLocalSessionId) {
      result.push({
        localSessionId: group.coordinatorLocalSessionId,
        maestroSessionId: group.coordinatorMaestroSessionId,
        label: coordSnap?.name || coordMs?.name || 'Coordinator',
        avatar: coordSnap?.avatar || '\u{1F451}',
        status: coordMs?.status || 'idle',
        isCoordinator: true,
      });
    } else {
      console.warn('[TeamView] No coordinatorLocalSessionId — coordinator terminal won\'t appear');
    }

    for (let i = 0; i < group.workerMaestroSessionIds.length; i++) {
      const msId = group.workerMaestroSessionIds[i];
      const localId = group.workerLocalSessionIds[i];
      if (!localId) {
        console.warn(`[TeamView] Worker ${i} (maestro=${msId}) has no localId — skipping`);
        continue;
      }

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

    console.log('[TeamView] Final slots:', result.map(s => ({ local: s.localSessionId, maestro: s.maestroSessionId, label: s.label, isCoord: s.isCoordinator })));
    return result;
  }, [group, maestroSessions]);

  const coordinatorSlot = slots.find((s) => s.isCoordinator) || null;
  const workerSlots = slots.filter((s) => !s.isCoordinator);
  const hasCoordinator = coordinatorSlot !== null;
  const hasWorkers = workerSlots.length > 0;

  // Stable string key of session IDs — only changes when members join/leave
  const slotIdsKey = useMemo(() => {
    const ids: string[] = [];
    if (group.coordinatorLocalSessionId) ids.push(group.coordinatorLocalSessionId);
    for (const id of group.workerLocalSessionIds) {
      if (id) ids.push(id);
    }
    return ids.join(',');
  }, [group.coordinatorLocalSessionId, group.workerLocalSessionIds]);

  // --- Core positioning logic (runs via RAF, reads refs) ---

  const positionAll = useCallback(() => {
    const styled = styledSessionsRef.current;
    const ids = slotIdsKey.split(',').filter(Boolean);
    const reg = registryRef.current.current;

    console.log('[TeamView] positionAll called. Session IDs:', ids);
    console.log('[TeamView] Registry has entries:', Array.from(reg.keys()));
    console.log('[TeamView] Slot refs registered:', Array.from(slotsRef.current.keys()));

    // Debug: list all data-terminal-id elements in DOM
    const allTerminals = document.querySelectorAll('[data-terminal-id]');
    console.log('[TeamView] All terminal elements in DOM:', Array.from(allTerminals).map(el => ({
      id: el.getAttribute('data-terminal-id'),
      classes: el.className,
      parentTag: el.parentElement?.className?.slice(0, 40),
      rect: el.getBoundingClientRect(),
    })));

    for (const sessionId of ids) {
      const slotEl = slotsRef.current.get(sessionId);
      const termContainer = document.querySelector(
        `[data-terminal-id="${sessionId}"]`,
      ) as HTMLElement | null;

      console.log(`[TeamView] Session ${sessionId}: slotEl=${!!slotEl}, termContainer=${!!termContainer}`);

      if (!slotEl || !termContainer) {
        console.warn(`[TeamView] SKIP ${sessionId}: missing ${!slotEl ? 'slotEl' : 'termContainer'}`);
        continue;
      }

      const rect = slotEl.getBoundingClientRect();
      console.log(`[TeamView] Slot rect for ${sessionId}:`, { top: rect.top, left: rect.left, width: rect.width, height: rect.height });

      if (rect.width === 0 || rect.height === 0) {
        console.warn(`[TeamView] SKIP ${sessionId}: slot has zero dimensions`);
        continue;
      }

      termContainer.classList.remove('terminalHidden');
      termContainer.classList.add('terminalInTeamView');
      termContainer.style.position = 'fixed';
      termContainer.style.zIndex = '10001';
      termContainer.style.top = `${rect.top}px`;
      termContainer.style.left = `${rect.left}px`;
      termContainer.style.width = `${rect.width}px`;
      termContainer.style.height = `${rect.height}px`;
      styled.add(sessionId);

      console.log(`[TeamView] Positioned ${sessionId} at`, { top: rect.top, left: rect.left, width: rect.width, height: rect.height });

      // Check computed style of termContainer to verify it's actually visible
      const computed = window.getComputedStyle(termContainer);
      console.log(`[TeamView] Computed style for ${sessionId}:`, {
        position: computed.position,
        visibility: computed.visibility,
        display: computed.display,
        zIndex: computed.zIndex,
        opacity: computed.opacity,
        transform: computed.transform,
      });

      // Also check the terminalPane parent
      const terminalPane = document.querySelector('.terminalPane');
      if (terminalPane) {
        const paneComputed = window.getComputedStyle(terminalPane);
        console.log(`[TeamView] terminalPane computed:`, {
          contain: paneComputed.contain,
          transform: paneComputed.transform,
          overflow: paneComputed.overflow,
          zoom: paneComputed.zoom,
        });
      }

      const entry = reg.get(sessionId);
      if (entry) {
        console.log(`[TeamView] Fitting terminal for ${sessionId}`);
        try {
          entry.fit.fit();
          entry.term.refresh(0, entry.term.rows - 1);
        } catch (err) {
          console.error(`[TeamView] Fit/refresh error for ${sessionId}:`, err);
        }
      } else {
        console.warn(`[TeamView] No registry entry for ${sessionId}`);
      }
    }
  }, [slotIdsKey]);

  const scrollAllToBottom = useCallback(() => {
    const ids = slotIdsKey.split(',').filter(Boolean);
    const reg = registryRef.current.current;

    for (const sessionId of ids) {
      const entry = reg.get(sessionId);
      if (entry) {
        try {
          entry.term.scrollToBottom();
        } catch { /* ignore */ }
      }
    }
  }, [slotIdsKey]);

  const restoreAll = useCallback(() => {
    const styled = styledSessionsRef.current;
    const activeId = useSessionStore.getState().activeId;
    const reg = registryRef.current.current;

    for (const sessionId of styled) {
      const termContainer = document.querySelector(
        `[data-terminal-id="${sessionId}"]`,
      ) as HTMLElement | null;
      if (!termContainer) continue;

      termContainer.classList.remove('terminalInTeamView');
      termContainer.style.position = '';
      termContainer.style.zIndex = '';
      termContainer.style.top = '';
      termContainer.style.left = '';
      termContainer.style.width = '';
      termContainer.style.height = '';

      if (sessionId !== activeId) {
        termContainer.classList.add('terminalHidden');
      }

      const entry = reg.get(sessionId);
      if (entry) {
        requestAnimationFrame(() => {
          try { entry.fit.fit(); } catch { /* ignore */ }
        });
      }
    }
    styled.clear();
  }, []);

  // --- Main effect: position on mount, observe resize, restore on unmount ---
  useEffect(() => {
    let rafId = requestAnimationFrame(() => {
      positionAll();
      // Scroll all terminals to bottom after initial positioning
      requestAnimationFrame(() => scrollAllToBottom());
    });

    const handleReposition = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => positionAll());
    };

    const observer = new ResizeObserver(handleReposition);
    if (bodyRef.current) observer.observe(bodyRef.current);

    window.addEventListener('resize', handleReposition);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', handleReposition);
      restoreAll();
    };
  }, [slotIdsKey, positionAll, restoreAll, scrollAllToBottom]);

  // --- Reposition when coordFraction changes (resize handle drag) ---
  useEffect(() => {
    const rafId = requestAnimationFrame(() => positionAll());
    return () => cancelAnimationFrame(rafId);
  }, [coordFraction, positionAll]);

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
      // Clamp between 20% and 80%
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

  // --- Click/double-click on slot → focus/open ---
  const handleSlotClick = useCallback(
    (localSessionId: string) => {
      setActiveId(localSessionId);
      onSelectSession(localSessionId);
    },
    [setActiveId, onSelectSession],
  );

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

  const registerSlotRef = useCallback((sessionId: string, el: HTMLDivElement | null) => {
    if (el) {
      slotsRef.current.set(sessionId, el);
    } else {
      slotsRef.current.delete(sessionId);
    }
  }, []);

  // Compute flex styles for the split — only relevant when both panels exist
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
              {/* Placeholder slot — terminal floats over this via position:fixed */}
              <div
                className="teamViewSlotTerminal"
                ref={(el) => registerSlotRef(coordinatorSlot.localSessionId, el)}
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
                  <div
                    className="teamViewSlotTerminal"
                    ref={(el) => registerSlotRef(worker.localSessionId, el)}
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
