import React from "react";
import { ProjectsSection } from "../ProjectsSection";
import { QuickPromptsSection } from "../QuickPromptsSection";
import { SessionsSection } from "../SessionsSection";
import type { ProcessEffect } from "../../processEffects";
import { EnvironmentConfig, Prompt } from "../../app/types/app";
import * as DEFAULTS from "../../app/constants/defaults";
import { MaestroProject } from "../../app/types/maestro";
import { TerminalSession } from "../../app/types/session";


export type { ProcessEffect as AgentShortcut } from "../../processEffects";
export type QuickStartPreset = ProcessEffect;

type SidebarProps = {
  sidebarWidth: number;
  projectsListMaxHeight: number;
  projects: MaestroProject[];
  activeProjectId: string;
  activeProject: MaestroProject | null;
  environments: EnvironmentConfig[];
  sessionCountByProject: Map<string, number>;
  workingAgentCountByProject: Map<string, number>;
  prompts: Prompt[];
  activeSessionId: string | null;
  agentShortcuts: ProcessEffect[];
  projectSessions: TerminalSession[];
  projectName: string | null;
  projectBasePath: string | null;
  sidebarRef: React.RefObject<HTMLElement>;
  onNewProject: () => void;
  onProjectSettings: () => void;
  onDeleteProject: () => void;
  onSelectProject: (id: string) => void;
  onOpenProjectSettings: () => void;
  onMoveProject: (projectId: string, targetProjectId: string, position: "before" | "after") => void;
  onSendPrompt: (prompt: Prompt) => void;
  onEditPrompt: (prompt: Prompt) => void;
  onOpenPromptsPanel: () => void;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onReorderSessions: (draggedPersistId: string, targetPersistId: string) => void;
  onQuickStart: (effect: ProcessEffect) => void;
  onOpenNewSession: () => void;
  onOpenPersistentSessions: () => void;
  onOpenSshManager: () => void;
  onOpenAgentShortcuts: () => void;
  onOpenManageTerminals: () => void;
  onResetProjectsListMaxHeight: () => void;
  onProjectsDividerKeyDown: (e: React.KeyboardEvent) => void;
  onProjectsDividerPointerDown: (e: React.PointerEvent) => void;
};

export function Sidebar({
  sidebarWidth,
  projectsListMaxHeight,
  projects,
  activeProjectId,
  activeProject,
  environments,
  sessionCountByProject,
  workingAgentCountByProject,
  prompts,
  activeSessionId,
  agentShortcuts,
  projectSessions,
  projectName,
  projectBasePath,
  sidebarRef,
  onNewProject,
  onProjectSettings,
  onDeleteProject,
  onSelectProject,
  onOpenProjectSettings,
  onMoveProject,
  onSendPrompt,
  onEditPrompt,
  onOpenPromptsPanel,
  onSelectSession,
  onCloseSession,
  onReorderSessions,
  onQuickStart,
  onOpenNewSession,
  onOpenPersistentSessions,
  onOpenSshManager,
  onOpenAgentShortcuts,
  onOpenManageTerminals,
  onResetProjectsListMaxHeight,
  onProjectsDividerKeyDown,
  onProjectsDividerPointerDown,
}: SidebarProps) {
  return (
    <aside
      className="sidebar"
      ref={sidebarRef}
      style={
        {
          width: `${sidebarWidth}px`,
          ["--projectsListMaxHeight" as any]: `${projectsListMaxHeight}px`,
        } as React.CSSProperties
      }
    >
      <ProjectsSection
        projects={projects}
        activeProjectId={activeProjectId}
        activeProject={activeProject}
        environments={environments}
        sessionCountByProject={sessionCountByProject}
        workingAgentCountByProject={workingAgentCountByProject}
        onNewProject={onNewProject}
        onProjectSettings={onProjectSettings}
        onDeleteProject={onDeleteProject}
        onSelectProject={onSelectProject}
        onOpenProjectSettings={onOpenProjectSettings}
        onMoveProject={onMoveProject}
      />

      <QuickPromptsSection
        prompts={prompts}
        activeSessionId={activeSessionId}
        onSendPrompt={onSendPrompt}
        onEditPrompt={onEditPrompt}
        onOpenPromptsPanel={onOpenPromptsPanel}
      />

      <div
        className="sidebarResizeHandle"
        role="separator"
        aria-label="Resize Projects and Sessions"
        aria-orientation="horizontal"
        aria-valuemin={DEFAULTS.MIN_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT}
        aria-valuemax={DEFAULTS.MAX_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT}
        aria-valuenow={Math.round(projectsListMaxHeight)}
        tabIndex={0}
        onDoubleClick={onResetProjectsListMaxHeight}
        onKeyDown={onProjectsDividerKeyDown}
        onPointerDown={onProjectsDividerPointerDown}
        title="Drag to resize • Double-click to auto-fit"
      />

      <SessionsSection
        agentShortcuts={agentShortcuts}
        sessions={projectSessions}
        activeSessionId={activeSessionId}
        activeProjectId={activeProjectId}
        projectName={projectName}
        projectBasePath={projectBasePath}
        onSelectSession={onSelectSession}
        onCloseSession={onCloseSession}
        onReorderSessions={onReorderSessions}
        onQuickStart={onQuickStart}
        onOpenNewSession={onOpenNewSession}
        onOpenPersistentSessions={onOpenPersistentSessions}
        onOpenSshManager={onOpenSshManager}
        onOpenAgentShortcuts={onOpenAgentShortcuts}
        onOpenManageTerminals={onOpenManageTerminals}
      />
    </aside>
  );
}
