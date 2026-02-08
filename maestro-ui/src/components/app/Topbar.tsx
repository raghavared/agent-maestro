import React from "react";
import { Icon } from "../Icon";
import { WorkspaceView } from "../../app/types/workspace";
import { MaestroProject } from "../../app/types/maestro";
import { TerminalSession } from "../../app/types/session";

type TopbarProps = {
  activeProject: MaestroProject | null;
  active: TerminalSession | null;
  activeIsSsh: boolean;
  persistenceDisabledReason: string | null;
  secureStorageMode: "keychain" | "plaintext" | null;
  secureStorageRetrying: boolean;
  error: string | null;
  notice: string | null;
  activeWorkspaceView: WorkspaceView | null;
  activeSshTarget: string | null;
  activeRightPanel: "none" | "maestro" | "files";
  onRetrySecureStorage: () => void;
  onDismissPersistenceError: () => void;
  onDismissError: () => void;
  onToggleFileExplorer: () => void;
  onToggleMaestro: () => void;
  onOpenInFinder: () => void;
  onOpenInVSCode: () => void;
  isFileExplorerDisabled: boolean;
  fileExplorerTitle: string;
};

export function Topbar({
  activeProject,
  active,
  activeIsSsh,
  persistenceDisabledReason,
  secureStorageMode,
  secureStorageRetrying,
  error,
  notice,
  activeWorkspaceView,
  activeSshTarget,
  activeRightPanel,
  onRetrySecureStorage,
  onDismissPersistenceError,
  onDismissError,
  onToggleFileExplorer,
  onToggleMaestro,
  onOpenInFinder,
  onOpenInVSCode,
  isFileExplorerDisabled,
  fileExplorerTitle,
}: TopbarProps) {
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
            {secureStorageMode === "keychain" && /keychain|keyring/i.test(persistenceDisabledReason) ? (
              <button
                type="button"
                className="errorClose"
                onClick={onRetrySecureStorage}
                disabled={secureStorageRetrying}
                title="Retry Keychain access"
              >
                {secureStorageRetrying ? "Retrying…" : "Retry"}
              </button>
            ) : (
              <button className="errorClose" onClick={onDismissPersistenceError} title="Dismiss">
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
            <button className="errorClose" onClick={onDismissError} title="Dismiss">
              ×
            </button>
          </div>
        )}

        {notice && (
          <div className="noticeBanner" role="status">
            <div className="noticeText" title={notice}>
              {notice}
            </div>
          </div>
        )}

        {active && (
          <>
            <div className="topbarButtonGroup">
              <button
                className="iconBtn iconBtnText"
                onClick={onOpenInFinder}
                disabled={!active.cwd}
                title={active.cwd ? `Open in Finder — ${active.cwd}` : "Open in Finder"}
              >
                Open in Finder
              </button>

              <button
                className="iconBtn iconBtnText"
                onClick={onOpenInVSCode}
                disabled={!active.cwd}
                title={active.cwd ? `Open in VS Code — ${active.cwd}` : "Open in VS Code"}
              >
                Open in VS Code
              </button>
            </div>
          </>
        )}

        <button
          className={`iconBtn ${activeWorkspaceView?.fileExplorerOpen ? "iconBtnActive" : ""}`}
          onClick={onToggleFileExplorer}
          disabled={isFileExplorerDisabled}
          title={fileExplorerTitle}
        >
          <Icon name="folder" />
        </button>

        <button
          className={`iconBtn ${activeRightPanel === "maestro" ? "iconBtnActive" : ""}`}
          onClick={onToggleMaestro}
          title={activeRightPanel === "maestro" ? "Close Maestro" : "Open Maestro - Task Management"}
        >
          <Icon name="check-square" />
        </button>
      </div>
    </div>
  );
}
