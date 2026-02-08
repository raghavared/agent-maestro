import React from "react";
import { MaestroPanel } from "../maestro/MaestroPanel";
import { FileExplorerPanel } from "../FileExplorerPanel";
import type { Task } from "../../utils/MaestroClient";
import { MaestroProject, MaestroTask } from "../../app/types/maestro";
import { TerminalSession } from "../../app/types/session";

type RightPanelProps = {
  activeRightPanel: "none" | "maestro" | "files";
  rightPanelWidth: number;
  activeProject: MaestroProject | null;
  activeProjectId: string;
  activeIsSsh: boolean;
  activeSshTarget: string | null;
  active: TerminalSession | null;
  activeWorkspaceView: {
    codeEditorActiveFilePath: string | null;
  } | null;
  homeDirRef: React.RefObject<string>;
  onClose: () => void;
  onCreateMaestroSession: (input: {
    task?: MaestroTask;
    tasks?: MaestroTask[];
    project: MaestroProject;
    skillIds?: string[];
  }) => Promise<any>;
  onJumpToSession: (maestroSessionId: string) => void;
  onAddTaskToSession: (taskId: string) => void;
  onSelectFile: (path: string) => void;
};

export function RightPanel({
  activeRightPanel,
  rightPanelWidth,
  activeProject,
  activeProjectId,
  activeIsSsh,
  activeSshTarget,
  active,
  activeWorkspaceView,
  homeDirRef,
  onClose,
  onCreateMaestroSession,
  onJumpToSession,
  onAddTaskToSession,
  onSelectFile,
}: RightPanelProps) {
  if (activeRightPanel === "none") {
    return null;
  }

  return (
    <aside className="rightPanel" style={{ width: `${rightPanelWidth}px`, flexShrink: 0 }}>
      {activeRightPanel === "maestro" && (
        activeProject && (
        <MaestroPanel
          isOpen={true}
          onClose={onClose}
          projectId={activeProjectId}
          project={activeProject}
          onCreateMaestroSession={onCreateMaestroSession}
          onJumpToSession={onJumpToSession}
          onAddTaskToSession={onAddTaskToSession}
        />
      ))}
      {activeRightPanel === "files" && (
        <FileExplorerPanel
          isOpen={true}
          provider={activeIsSsh ? "ssh" : "local"}
          sshTarget={activeIsSsh ? activeSshTarget : null}
          rootDir={activeProject?.basePath ?? active?.cwd ?? homeDirRef.current ?? ""}
          activeFilePath={activeWorkspaceView?.codeEditorActiveFilePath ?? null}
          onSelectFile={onSelectFile}
          onClose={onClose}
        />
      )}
    </aside>
  );
}
