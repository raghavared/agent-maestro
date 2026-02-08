import React, { MutableRefObject, useRef } from "react";
import SessionTerminal, { TerminalRegistry } from "../../SessionTerminal";
import { PendingDataBuffer } from "../../app/types/app-state";
import { FileExplorerPanel } from "../FileExplorerPanel";
import { Icon } from "../Icon";
import { useSessionStore } from "../../stores/useSessionStore";
import { useProjectStore } from "../../stores/useProjectStore";
import {
  useWorkspaceStore,
  getActiveWorkspaceKey,
  getActiveWorkspaceView,
} from "../../stores/useWorkspaceStore";
import { isSshCommandLine, sshTargetFromCommandLine } from "../../app/utils/ssh";

const LazyCodeEditorPanel = React.lazy(() => import("../CodeEditorPanel"));

export interface AppWorkspaceProps {
  registry: MutableRefObject<TerminalRegistry>;
  pendingData: MutableRefObject<PendingDataBuffer>;
}

export const AppWorkspace = React.memo(function AppWorkspace(props: AppWorkspaceProps) {
  const { registry, pendingData } = props;
  const workspaceRowRef = useRef<HTMLDivElement | null>(null);

  // --- Session store ---
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const onCwdChange = useSessionStore((s) => s.onCwdChange);
  const onCommandChange = useSessionStore((s) => s.onCommandChange);
  const onSessionResize = useSessionStore((s) => s.onSessionResize);
  const handleOpenTerminalAtPath = useSessionStore((s) => s.handleOpenTerminalAtPath);
  const active = sessions.find((s) => s.id === activeId) ?? null;

  // --- Project store ---
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  // --- Derived SSH ---
  const activeIsSsh = active
    ? isSshCommandLine(active.launchCommand ?? active.restoreCommand ?? null)
    : false;
  const activeSshTarget = (() => {
    if (!active) return null;
    if (!activeIsSsh) return null;
    const stored = active.sshTarget?.trim() ?? "";
    if (stored) return stored;
    return sshTargetFromCommandLine(active.launchCommand ?? active.restoreCommand ?? null);
  })();

  // --- Workspace store ---
  const activeWorkspaceKey = getActiveWorkspaceKey();
  const activeWorkspaceView = getActiveWorkspaceView();
  const workspaceResizeMode = useWorkspaceStore((s) => s.workspaceResizeMode);
  const updateWorkspaceViewForKey = useWorkspaceStore((s) => s.updateWorkspaceViewForKey);
  const closeCodeEditor = useWorkspaceStore((s) => s.closeCodeEditor);
  const handleRenameWorkspacePath = useWorkspaceStore((s) => s.handleRenameWorkspacePath);
  const handleDeleteWorkspacePath = useWorkspaceStore((s) => s.handleDeleteWorkspacePath);
  const handleSelectWorkspaceFile = useWorkspaceStore((s) => s.handleSelectWorkspaceFile);
  const beginWorkspaceResize = useWorkspaceStore((s) => s.beginWorkspaceResize);

  return (
    <div
      ref={workspaceRowRef}
      className={`workspaceRow ${workspaceResizeMode ? "workspaceResizing" : ""}`}
      style={
        {
          "--workspaceEditorWidthPx": `${activeWorkspaceView.editorWidth}px`,
          "--workspaceFileTreeWidthPx": `${activeWorkspaceView.treeWidth}px`,
        } as React.CSSProperties
      }
    >
      <div className="terminalPane" aria-label="Terminal">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`terminalContainer ${s.id === activeId ? "" : "terminalHidden"}`}
          >
            <SessionTerminal
              id={s.id}
              active={s.id === activeId}
              readOnly={Boolean(s.exited || s.closing)}
              persistent={s.persistent}
              onCwdChange={onCwdChange}
              onCommandChange={onCommandChange}
              onResize={onSessionResize}
              registry={registry}
              pendingData={pendingData}
            />
          </div>
        ))}
      </div>

      {activeWorkspaceView.codeEditorOpen &&
        (
          activeWorkspaceView.codeEditorRootDir ??
          activeWorkspaceView.fileExplorerRootDir ??
          (!activeIsSsh ? activeProject?.basePath ?? active?.cwd ?? "" : "")
        ).trim() ? (
        <>
          <div
            className="workspaceResize"
            onMouseDown={beginWorkspaceResize("editor")}
            aria-hidden="true"
          />
          <React.Suspense
            fallback={
              <section className="codeEditorPanel" aria-label="Editor">
                <div className="empty">Loading editor…</div>
              </section>
            }
          >
            <LazyCodeEditorPanel
              key={`code-editor:${activeWorkspaceKey}`}
              provider={activeIsSsh ? "ssh" : "local"}
              sshTarget={activeIsSsh ? activeSshTarget : null}
              rootDir={
                (
                  activeWorkspaceView.codeEditorRootDir ??
                  activeWorkspaceView.fileExplorerRootDir ??
                  (!activeIsSsh ? activeProject?.basePath ?? active?.cwd ?? "" : "")
                ).trim()
              }
              openFileRequest={activeWorkspaceView.openFileRequest}
              persistedState={activeWorkspaceView.codeEditorPersistedState}
              fsEvent={activeWorkspaceView.codeEditorFsEvent}
              onPersistState={(state) =>
                updateWorkspaceViewForKey(activeWorkspaceKey, activeProjectId, (prev) => ({
                  ...prev,
                  codeEditorPersistedState: state,
                }))
              }
              onConsumeOpenFileRequest={() =>
                updateWorkspaceViewForKey(activeWorkspaceKey, activeProjectId, (prev) => ({
                  ...prev,
                  openFileRequest: null,
                }))
              }
              onActiveFilePathChange={(path) =>
                updateWorkspaceViewForKey(activeWorkspaceKey, activeProjectId, (prev) => {
                  if (prev.codeEditorActiveFilePath === path) return prev;
                  return { ...prev, codeEditorActiveFilePath: path };
                })
              }
              onCloseEditor={closeCodeEditor}
            />
          </React.Suspense>
        </>
      ) : null}

      {/* COMMENTED OUT: File Explorer Component */}
      {/* {activeWorkspaceView.fileExplorerOpen &&
        (
          activeWorkspaceView.fileExplorerRootDir ??
          activeWorkspaceView.codeEditorRootDir ??
          (!activeIsSsh ? activeProject?.basePath ?? active?.cwd ?? "" : "")
        ).trim() ? (
        <>
          <div
            className="workspaceResize"
            onMouseDown={beginWorkspaceResize("tree")}
            aria-hidden="true"
          />
          <FileExplorerPanel
            key={`file-tree:${activeWorkspaceKey}`}
            isOpen
            provider={activeIsSsh ? "ssh" : "local"}
            sshTarget={activeIsSsh ? activeSshTarget : null}
            rootDir={
              (
                activeWorkspaceView.fileExplorerRootDir ??
                activeWorkspaceView.codeEditorRootDir ??
                (!activeIsSsh ? activeProject?.basePath ?? active?.cwd ?? "" : "")
              ).trim()
            }
            persistedState={activeWorkspaceView.fileExplorerPersistedState}
            activeFilePath={activeWorkspaceView.codeEditorActiveFilePath}
            onSelectFile={handleSelectWorkspaceFile}
            onOpenTerminalAtPath={handleOpenTerminalAtPath}
            onPersistState={(state) =>
              updateWorkspaceViewForKey(activeWorkspaceKey, activeProjectId, (prev) => ({
                ...prev,
                fileExplorerPersistedState: state,
              }))
            }
            onPathRenamed={handleRenameWorkspacePath}
            onPathDeleted={handleDeleteWorkspacePath}
            onClose={() =>
              updateWorkspaceViewForKey(activeWorkspaceKey, activeProjectId, (prev) => ({
                ...prev,
                fileExplorerOpen: false,
              }))
            }
          />
        </>
      ) : activeWorkspaceView.fileExplorerOpen && activeIsSsh ? (
        <>
          <div
            className="workspaceResize"
            onMouseDown={beginWorkspaceResize("tree")}
            aria-hidden="true"
          />
          <aside className="fileExplorerPanel" aria-label="Files">
            <div className="fileExplorerHeader">
              <div className="fileExplorerTitle">
                <span>Files</span>
                <span className="fileExplorerPath">remote</span>
              </div>
              <div className="fileExplorerActions">
                <button
                  type="button"
                  className="btnSmall btnIcon"
                  onClick={() =>
                    updateWorkspaceViewForKey(activeWorkspaceKey, activeProjectId, (prev) => ({
                      ...prev,
                      fileExplorerOpen: false,
                    }))
                  }
                  title="Close"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
            <div className="fileExplorerList" role="tree">
              <div className="fileExplorerRow fileExplorerMeta">
                {activeSshTarget ? "Loading remote files…" : "Missing SSH target."}
              </div>
            </div>
          </aside>
        </>
      ) : null} */}
    </div>
  );
});
