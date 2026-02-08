import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../../stores/useSessionStore";
import { useProjectStore } from "../../stores/useProjectStore";
import { useUIStore } from "../../stores/useUIStore";
import { useSecureStorageStore } from "../../stores/useSecureStorageStore";
import { useWorkspaceStore, getActiveWorkspaceView } from "../../stores/useWorkspaceStore";
import { useRecordingStore } from "../../stores/useRecordingStore";
import { isSshCommandLine, sshTargetFromCommandLine } from "../../app/utils/ssh";
import { Icon } from "../Icon";

export function AppTopbar() {
  // --- Session store ---
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
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

  // --- UI store ---
  const error = useUIStore((s) => s.error);
  const setError = useUIStore((s) => s.setError);
  const notice = useUIStore((s) => s.notice);
  const dismissNotice = useUIStore((s) => s.dismissNotice);
  const activeRightPanel = useUIStore((s) => s.activeRightPanel);
  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);
  const slidePanelOpen = useUIStore((s) => s.slidePanelOpen);
  const setSlidePanelOpen = useUIStore((s) => s.setSlidePanelOpen);
  const reportError = useUIStore((s) => s.reportError);

  // --- Secure storage store ---
  const persistenceDisabledReason = useSecureStorageStore((s) => s.persistenceDisabledReason);
  const setPersistenceDisabledReason = useSecureStorageStore((s) => s.setPersistenceDisabledReason);
  const secureStorageMode = useSecureStorageStore((s) => s.secureStorageMode);
  const secureStorageRetrying = useSecureStorageStore((s) => s.secureStorageRetrying);
  const retrySecureStorage = useSecureStorageStore((s) => s.retrySecureStorage);

  // --- Workspace store ---
  const activeWorkspaceView = getActiveWorkspaceView();
  const updateActiveWorkspaceView = useWorkspaceStore((s) => s.updateActiveWorkspaceView);

  // --- Recording store ---
  const stopRecording = useRecordingStore((s) => s.stopRecording);
  const openRecordPrompt = useRecordingStore((s) => s.openRecordPrompt);
  const refreshRecordings = useRecordingStore((s) => s.refreshRecordings);
  const openReplayForActive = useRecordingStore((s) => s.openReplayForActive);

  return (
    <div className="topbar">
      <div className="activeTitle">
        <span>{activeProject ? `Project: ${activeProject.name}` : "Project: —"}</span>
        <span>{active ? ` • ${active.name}` : " • No session"}</span>
        {activeIsSsh ? (
          <>
            {" "}
            <span className="chip chip-ssh" title="SSH">
              <span className="chipLabel">ssh</span>
            </span>
          </>
        ) : null}
      </div>
      <div className="topbarRight">
        {persistenceDisabledReason && (
          <div className="errorBanner" role="alert">
            <div className="errorText" title={persistenceDisabledReason}>
              {persistenceDisabledReason}
            </div>
            {secureStorageMode === "keychain" &&
              /keychain|keyring/i.test(persistenceDisabledReason) ? (
              <button
                type="button"
                className="errorClose"
                onClick={() => void retrySecureStorage()}
                disabled={secureStorageRetrying}
                title="Retry Keychain access"
              >
                {secureStorageRetrying ? "Retrying…" : "Retry"}
              </button>
            ) : (
              <button
                className="errorClose"
                onClick={() => setPersistenceDisabledReason(null)}
                title="Dismiss"
              >
                ×
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="errorBanner" role="alert">
            <div className="errorText" title={error}>
              {error}
            </div>
            <button className="errorClose" onClick={() => setError(null)} title="Dismiss">
              ×
            </button>
          </div>
        )}

        {notice && (
          <div className="noticeBanner" role="status" aria-live="polite">
            <div className="noticeText" title={notice}>
              {notice}
            </div>
            <button className="errorClose" onClick={dismissNotice} title="Dismiss">
              ×
            </button>
          </div>
        )}

        {!error && !notice && (
          <div className="shortcutHint">
            <kbd>{"\u2318"}K</kbd> Quick Access
          </div>
        )}

        {/* Recording Timer */}
        {active?.recordingActive && (
          <div className="recordingTimer">
            <span className="recordingTimerDot" />
            <span>REC</span>
          </div>
        )}

        {active && (
          <>
            {!activeIsSsh ? (
              <>
                <div className="topbarExternalActions">
                  <button
                    className="iconBtn iconBtnText"
                    onClick={() => {
                      const cwd = active.cwd?.trim() ?? "";
                      if (!cwd) return;
                      void invoke("open_path_in_file_manager", { path: cwd }).catch((err) =>
                        reportError("Failed to open folder in Finder", err),
                      );
                    }}
                    disabled={!active.cwd}
                    title={active.cwd ? `Open in Finder — ${active.cwd}` : "Open in Finder"}
                  >
                    Open in Finder
                  </button>

                  <button
                    className="iconBtn iconBtnText"
                    onClick={() => {
                      const cwd = active.cwd?.trim() ?? "";
                      if (!cwd) return;
                      void invoke("open_path_in_vscode", { path: cwd }).catch((err) =>
                        reportError("Failed to open VS Code", err),
                      );
                    }}
                    disabled={!active.cwd}
                    title={active.cwd ? `Open in VS Code — ${active.cwd}` : "Open in VS Code"}
                  >
                    Open in VS Code
                  </button>
                </div>
              </>
            ) : null}

            <button
              className={`iconBtn ${activeWorkspaceView.fileExplorerOpen ? "iconBtnActive" : ""}`}
              onClick={() => {
                updateActiveWorkspaceView((prev) => {
                  if (prev.fileExplorerOpen) {
                    return { ...prev, fileExplorerOpen: false };
                  }
                  if (activeIsSsh) {
                    return { ...prev, fileExplorerOpen: true };
                  }
                  const root = (
                    prev.fileExplorerRootDir ??
                    prev.codeEditorRootDir ??
                    activeProject?.basePath ??
                    active?.cwd ??
                    ""
                  ).trim();
                  if (!root) return prev;
                  return {
                    ...prev,
                    fileExplorerOpen: true,
                    fileExplorerRootDir: prev.fileExplorerRootDir ?? root,
                  };
                });
              }}
              disabled={
                activeIsSsh
                  ? !activeWorkspaceView.fileExplorerOpen && !activeSshTarget
                  : !activeWorkspaceView.fileExplorerOpen &&
                  !(
                    activeWorkspaceView.fileExplorerRootDir ??
                    activeWorkspaceView.codeEditorRootDir ??
                    activeProject?.basePath ??
                    active?.cwd ??
                    ""
                  ).trim()
              }
              title={
                activeWorkspaceView.fileExplorerOpen
                  ? activeIsSsh
                    ? "Close remote file tree"
                    : "Close file tree"
                  : activeIsSsh
                    ? `Open remote file tree — ${activeSshTarget ?? "ssh"}`
                    : `Open file tree — ${(
                      activeWorkspaceView.fileExplorerRootDir ??
                      activeWorkspaceView.codeEditorRootDir ??
                      activeProject?.basePath ??
                      active?.cwd ??
                      ""
                    ).trim() || "—"
                    }`
              }
            >
              <Icon name="folder" />
            </button>

            {/* Maestro Button */}
            <button
              className={`iconBtn ${activeRightPanel === "maestro" ? "iconBtnActive" : ""}`}
              onClick={() =>
                setActiveRightPanel(activeRightPanel === "maestro" ? "none" : "maestro")
              }
              title={activeRightPanel === "maestro" ? "Close Maestro" : "Open Maestro - Task Management"}
            >
              <Icon name="check-square" />
            </button>

            {/* Files Button */}
            <button
              className={`iconBtn ${activeRightPanel === "files" ? "iconBtnActive" : ""}`}
              onClick={() =>
                setActiveRightPanel(activeRightPanel === "files" ? "none" : "files")
              }
              title={activeRightPanel === "files" ? "Close Files" : "Open Files"}
            >
              <Icon name="files" />
            </button>

            {/* Record Button */}
            <button
              className={`iconBtn ${active.recordingActive ? "iconBtnRecording" : ""}`}
              onClick={() =>
                active.recordingActive ? void stopRecording(active.id) : openRecordPrompt(active.id)
              }
              disabled={Boolean(active.exited || active.closing)}
              title={active.recordingActive ? "Stop recording (active)" : "Start recording"}
            >
              <Icon name={active.recordingActive ? "stop" : "record"} />
            </button>

            {/* Panels Button */}
            <button
              className={`iconBtn ${slidePanelOpen ? "iconBtnActive" : ""}`}
              onClick={() => {
                if (slidePanelOpen) {
                  setSlidePanelOpen(false);
                } else {
                  void refreshRecordings();
                  setSlidePanelOpen(true);
                }
              }}
              title={`${slidePanelOpen ? "Close" : "Open"} panels (\u2318\u21E7P / \u2318\u21E7R / \u2318\u21E7A)`}
            >
              <Icon name="panel" />
            </button>

            {/* Replay Button */}
            <button
              className="iconBtn"
              onClick={() => void openReplayForActive()}
              disabled={!active.lastRecordingId}
              title={active.lastRecordingId ? "Replay last recording" : "No recording yet"}
            >
              <Icon name="play" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
