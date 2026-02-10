import React, { useState, useRef, useLayoutEffect } from "react";
import { Icon } from "./Icon";
import { MaestroProject } from "../app/types/maestro";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { SoundSettingsContent } from "./modals/SoundSettingsModal";
import { soundManager } from "../services/soundManager";

type ProjectTabBarProps = {
  projects: MaestroProject[];
  activeProjectId: string;
  sessionCountByProject: Map<string, number>;
  workingAgentCountByProject: Map<string, number>;
  needsInputByProject: Map<string, boolean>;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onMoveProject: (projectId: string, targetProjectId: string, position: 'before' | 'after') => void;
};

type SettingsDialogProps = {
  project: MaestroProject;
  sessionCount: number;
  onClose: () => void;
  onDelete: () => void;
};

type SettingsTab = 'theme' | 'sounds';

function AppSettingsDialog({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('theme');

  return (
    <div className="projectSettingsBackdrop" onClick={onClose}>
      <div className="appSettingsDialog" onClick={(e) => e.stopPropagation()}>
        <div className="projectSettingsHeader">
          <span className="projectSettingsTitle">[ SETTINGS ]</span>
          <button className="projectSettingsClose" onClick={onClose}>×</button>
        </div>

        <div className="appSettingsBody">
          <div className="appSettingsSidebar">
            <button
              type="button"
              className={`appSettingsTabBtn ${activeTab === 'theme' ? 'appSettingsTabBtnActive' : ''}`}
              onClick={() => setActiveTab('theme')}
            >
              THEME
            </button>
            <button
              type="button"
              className={`appSettingsTabBtn ${activeTab === 'sounds' ? 'appSettingsTabBtnActive' : ''}`}
              onClick={() => setActiveTab('sounds')}
            >
              SOUNDS
            </button>
          </div>

          <div className="appSettingsTabContent">
            {activeTab === 'theme' && (
              <div className="appSettingsContent">
                <ThemeSwitcher />
              </div>
            )}
            {activeTab === 'sounds' && (
              <SoundSettingsContent />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectSettingsDialog({ project, sessionCount, onClose, onDelete }: SettingsDialogProps) {
  return (
    <div className="projectSettingsBackdrop" onClick={onClose}>
      <div className="projectSettingsDialog" onClick={(e) => e.stopPropagation()}>
        <div className="projectSettingsHeader">
          <span className="projectSettingsTitle">[ PROJECT SETTINGS ]</span>
          <button className="projectSettingsClose" onClick={onClose}>×</button>
        </div>

        <div className="projectSettingsContent">
          <div className="projectSettingsRow">
            <span className="projectSettingsLabel">NAME:</span>
            <span className="projectSettingsValue">{project.name}</span>
          </div>

          {project.basePath && (
            <div className="projectSettingsRow">
              <span className="projectSettingsLabel">PATH:</span>
              <span className="projectSettingsValue projectSettingsPath">{project.basePath}</span>
            </div>
          )}

          <div className="projectSettingsRow">
            <span className="projectSettingsLabel">SESSIONS:</span>
            <span className="projectSettingsValue">{sessionCount}</span>
          </div>

          <div className="projectSettingsRow">
            <span className="projectSettingsLabel">CREATED:</span>
            <span className="projectSettingsValue">
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="projectSettingsDivider" />

        <button
          className="projectSettingsDeleteBtn"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Icon name="trash" size={14} />
          DELETE PROJECT
        </button>
      </div>
    </div>
  );
}

export function ProjectTabBar({
  projects,
  activeProjectId,
  sessionCountByProject,
  workingAgentCountByProject,
  needsInputByProject,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onMoveProject,
}: ProjectTabBarProps) {
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ projectId: string; position: 'before' | 'after' } | null>(null);

  const tabsRef = useRef<HTMLDivElement | null>(null);
  const previousItemRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const activeAnimationsRef = useRef<Map<string, Animation>>(new Map());

  const settingsProject = settingsProjectId
    ? projects.find((p) => p.id === settingsProjectId) ?? null
    : null;

  const handleDelete = () => {
    if (settingsProjectId) {
      onDeleteProject(settingsProjectId);
    }
  };

  const handleDragEnd = () => {
    setDraggingProjectId(null);
    setDropTarget(null);
  };

  // FLIP animation for smooth reorder
  useLayoutEffect(() => {
    const list = tabsRef.current;
    if (!list) return;

    const items = Array.from(list.querySelectorAll<HTMLElement>('.projectTab'));
    const nextRects = new Map<string, DOMRect>();
    for (const item of items) {
      const id = item.dataset.projectId;
      if (!id) continue;
      nextRects.set(id, item.getBoundingClientRect());
    }

    const prevRects = previousItemRectsRef.current;
    if (prevRects.size > 0) {
      for (const item of items) {
        const id = item.dataset.projectId;
        if (!id) continue;
        const prev = prevRects.get(id);
        const next = nextRects.get(id);
        if (!prev || !next) continue;
        if (id === draggingProjectId) continue;

        const dx = prev.left - next.left;
        if (Math.abs(dx) < 0.5) continue;

        activeAnimationsRef.current.get(id)?.cancel();
        const animation = item.animate(
          [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
          { duration: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
        activeAnimationsRef.current.set(id, animation);
        void animation.finished
          .then(() => {
            if (activeAnimationsRef.current.get(id) === animation) {
              activeAnimationsRef.current.delete(id);
            }
          })
          .catch(() => {});
      }
    }

    previousItemRectsRef.current = nextRects;
  }, [projects, draggingProjectId]);

  const handleTabPointerDown = (e: React.PointerEvent, project: MaestroProject) => {
    if (projects.length <= 1) return;
    if (e.button !== 0) return;

    const pointerId = e.pointerId;
    const target = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;

    let dragging = false;
    let lastTargetId: string | null = null;
    let lastPosition: 'before' | 'after' | null = null;
    let latestPointer: { x: number; y: number } | null = null;
    let raf: number | null = null;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;

    const getDropPosition = (clientX: number, rect: DOMRect, targetId: string): 'before' | 'after' => {
      const mid = rect.left + rect.width / 2;
      const delta = clientX - mid;
      const deadZonePx = 6;
      if (delta > deadZonePx) return 'after';
      if (delta < -deadZonePx) return 'before';
      if (lastTargetId === targetId && lastPosition) return lastPosition;
      return delta >= 0 ? 'after' : 'before';
    };

    const stop = () => {
      if (raf !== null) {
        window.cancelAnimationFrame(raf);
        raf = null;
      }
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      try { target.releasePointerCapture(pointerId); } catch { /* ignore */ }
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      handleDragEnd();
    };

    const processPointer = () => {
      raf = null;
      if (!latestPointer) return;
      const { x, y } = latestPointer;

      if (!dragging) {
        const distance = Math.hypot(x - startX, y - startY);
        if (distance < 6) return;
        dragging = true;
        setDraggingProjectId(project.id);
        setDropTarget(null);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }

      const list = tabsRef.current;
      if (!list) return;

      // Auto-scroll left/right at edges
      const listRect = list.getBoundingClientRect();
      const edgeZone = 22;
      if (x < listRect.left + edgeZone) {
        const ratio = (listRect.left + edgeZone - x) / edgeZone;
        list.scrollBy({ left: -Math.ceil(10 * ratio), behavior: 'auto' });
      } else if (x > listRect.right - edgeZone) {
        const ratio = (x - (listRect.right - edgeZone)) / edgeZone;
        list.scrollBy({ left: Math.ceil(10 * ratio), behavior: 'auto' });
      }

      const element = document.elementFromPoint(x, y) as HTMLElement | null;
      const item = element?.closest<HTMLElement>('.projectTab') ?? null;
      if (!item || !list.contains(item)) {
        setDropTarget(null);
        return;
      }

      const targetId = item.dataset.projectId ?? null;
      if (!targetId || targetId === project.id) {
        setDropTarget(null);
        return;
      }

      const rect = item.getBoundingClientRect();
      const position = getDropPosition(x, rect, targetId);
      setDropTarget((prev) => {
        if (prev?.projectId === targetId && prev.position === position) return prev;
        return { projectId: targetId, position };
      });

      if (lastTargetId === targetId && lastPosition === position) return;
      lastTargetId = targetId;
      lastPosition = position;
      onMoveProject(project.id, targetId, position);
    };

    const scheduleProcess = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(processPointer);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      latestPointer = { x: ev.clientX, y: ev.clientY };
      scheduleProcess();
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      stop();
    };

    e.preventDefault();
    e.stopPropagation();

    try { target.setPointerCapture(pointerId); } catch { /* ignore */ }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      <div className="projectTabBar">
        <div className="projectTabs" ref={tabsRef}>
          {projects.map((p) => {
            const isActive = p.id === activeProjectId;
            const count = sessionCountByProject.get(p.id) ?? 0;
            const workingCount = workingAgentCountByProject.get(p.id) ?? 0;
            const isDragging = p.id === draggingProjectId;
            const isDropBefore = dropTarget?.projectId === p.id && dropTarget.position === 'before';
            const isDropAfter = dropTarget?.projectId === p.id && dropTarget.position === 'after';
            const hasNeedsInput = needsInputByProject.get(p.id) ?? false;

            return (
              <div
                key={p.id}
                data-project-id={p.id}
                className={`projectTab ${isActive ? "projectTabActive" : ""} ${isDragging ? "projectTabDragging" : ""} ${isDropBefore ? "projectTabDropBefore" : ""} ${isDropAfter ? "projectTabDropAfter" : ""} ${hasNeedsInput ? "projectTabNeedsInput" : ""}`}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleTabPointerDown(e, p)}
              >
                <button
                  type="button"
                  className="projectTabMain"
                  onClick={() => onSelectProject(p.id)}
                  title={p.basePath || p.name}
                >
                  <span className="projectTabName">{p.name}</span>
                  {workingCount > 0 && (
                    <span className="projectTabWorking">
                      <span className="projectTabWorkingDot" />
                      {workingCount}
                    </span>
                  )}
                  {count > 0 && <span className="projectTabCount">{count}</span>}
                </button>
                {isActive && (
                  <button
                    type="button"
                    className="projectTabSettingsBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSettingsProjectId(p.id);
                    }}
                    title="Project settings"
                  >
                    <Icon name="settings" size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="projectTabBarActions">
          <button
            type="button"
            className="projectTabBarBtn"
            onClick={onNewProject}
            title="New project"
          >
            <Icon name="plus" size={14} />
          </button>
          <button
            type="button"
            className="projectTabBarBtn"
            onClick={() => setAppSettingsOpen(true)}
            title="Settings"
          >
            <Icon name="settings" size={14} />
          </button>
          <button
            type="button"
            className="projectTabBarBtn globalSoundToggle"
            onClick={() => {
              const next = !soundEnabled;
              soundManager.setEnabled(next);
              setSoundEnabled(next);
            }}
            title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
          >
            <Icon name={soundEnabled ? "volume" : "volume-off"} size={14} />
          </button>
        </div>
      </div>

      {settingsProject && (
        <ProjectSettingsDialog
          project={settingsProject}
          sessionCount={sessionCountByProject.get(settingsProject.id) ?? 0}
          onClose={() => setSettingsProjectId(null)}
          onDelete={handleDelete}
        />
      )}

      {appSettingsOpen && (
        <AppSettingsDialog onClose={() => setAppSettingsOpen(false)} />
      )}
    </>
  );
}
