import React from "react";
import { TaskTreeNode, MaestroTask, TeamMember } from "../../app/types/maestro";

export type PrimaryTab = "tasks" | "team" | "skills";
export type TaskSubTab = "current" | "pinned" | "completed" | "archived";
export type SkillSubTab = "browse" | "installed" | "marketplace";
export type TeamSubTab = "members" | "pinned" | "archived";

type PanelIconBarProps = {
    primaryTab: PrimaryTab;
    onPrimaryTabChange: (tab: PrimaryTab) => void;
    taskSubTab: TaskSubTab;
    onTaskSubTabChange: (tab: TaskSubTab) => void;
    skillSubTab: SkillSubTab;
    onSkillSubTabChange: (tab: SkillSubTab) => void;
    teamSubTab: TeamSubTab;
    onTeamSubTabChange: (tab: TeamSubTab) => void;
    roots: TaskTreeNode[];
    teamMembers: TeamMember[];
    loading: boolean;
    projectId: string;
    onNewTask: () => void;
    onNewTeamMember: () => void;
};

export const PanelIconBar: React.FC<PanelIconBarProps> = ({
    primaryTab,
    onPrimaryTabChange,
    taskSubTab,
    onTaskSubTabChange,
    skillSubTab,
    onSkillSubTabChange,
    teamSubTab,
    onTeamSubTabChange,
    roots,
    teamMembers,
    loading,
    projectId,
    onNewTask,
    onNewTeamMember,
}) => {
    const activeCount = roots.filter(t => t.status !== 'completed' && t.status !== 'archived').length;
    const pinnedCount = roots.filter(t => t.pinned).length;
    const completedCount = roots.filter(t => t.status === 'completed').length;
    const archivedCount = roots.filter(t => t.status === 'archived').length;

    const pinnedTeamCount = 0;
    const archivedTeamCount = teamMembers.filter(t => t.status === 'archived').length;
    const activeTeamCount = teamMembers.filter(t => t.status !== 'archived').length;

    return (
        <div className="maestroPanelTabSystem">
            {/* Primary tab bar - at the very top */}
            <div className="maestroPanelPrimaryTabs">
                <button
                    className={`maestroPanelPrimaryTab ${primaryTab === "tasks" ? "maestroPanelPrimaryTabActive" : ""}`}
                    onClick={() => onPrimaryTabChange("tasks")}
                >
                    <svg className="maestroPanelTabIcon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="14" height="14" rx="2" />
                        <path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" />
                    </svg>
                    Tasks
                    <span className="maestroPanelTabBadge">{activeCount}</span>
                </button>
                <button
                    className={`maestroPanelPrimaryTab ${primaryTab === "team" ? "maestroPanelPrimaryTabActive" : ""}`}
                    onClick={() => onPrimaryTabChange("team")}
                >
                    <svg className="maestroPanelTabIcon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="7" cy="7" r="3" />
                        <circle cx="14" cy="7" r="2.5" />
                        <path d="M1 17c0-3 2.5-5 6-5s6 2 6 5" />
                        <path d="M13 12c2.5 0 5 1.5 5 4" strokeLinecap="round" />
                    </svg>
                    Team
                    <span className="maestroPanelTabBadge">{activeTeamCount}</span>
                </button>
                <button
                    className={`maestroPanelPrimaryTab ${primaryTab === "skills" ? "maestroPanelPrimaryTabActive" : ""}`}
                    onClick={() => onPrimaryTabChange("skills")}
                >
                    <svg className="maestroPanelTabIcon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M10 2L3 7l7 5 7-5-7-5z" strokeLinejoin="round" />
                        <path d="M3 13l7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3 10l7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Skills
                </button>
            </div>

            {/* Secondary sub-tab bar - contextual */}
            <div className="maestroPanelSubTabs">
                {primaryTab === "tasks" && (
                    <>
                        <button
                            className="maestroPanelSubTab maestroPanelSubTab--action"
                            onClick={onNewTask}
                        >
                            <span className="maestroPanelSubTabPlus">+</span>
                            New Task
                        </button>
                        <button
                            className={`maestroPanelSubTab ${taskSubTab === "current" ? "maestroPanelSubTabActive" : ""}`}
                            onClick={() => onTaskSubTabChange("current")}
                        >
                            Current
                            <span className="maestroPanelSubTabCount">{activeCount}</span>
                        </button>
                        <button
                            className={`maestroPanelSubTab ${taskSubTab === "pinned" ? "maestroPanelSubTabActive" : ""}`}
                            onClick={() => onTaskSubTabChange("pinned")}
                        >
                            Pinned
                            <span className="maestroPanelSubTabCount">{pinnedCount}</span>
                        </button>
                        <button
                            className={`maestroPanelSubTab ${taskSubTab === "completed" ? "maestroPanelSubTabActive" : ""}`}
                            onClick={() => onTaskSubTabChange("completed")}
                        >
                            Completed
                            <span className="maestroPanelSubTabCount">{completedCount}</span>
                        </button>
                        <button
                            className={`maestroPanelSubTab ${taskSubTab === "archived" ? "maestroPanelSubTabActive" : ""}`}
                            onClick={() => onTaskSubTabChange("archived")}
                        >
                            Archived
                            <span className="maestroPanelSubTabCount">{archivedCount}</span>
                        </button>
                    </>
                )}

                {primaryTab === "team" && (
                    <>
                        <button
                            className="maestroPanelSubTab maestroPanelSubTab--action"
                            onClick={onNewTeamMember}
                        >
                            <span className="maestroPanelSubTabPlus">+</span>
                            New Member
                        </button>
                        <button
                            className={`maestroPanelSubTab ${teamSubTab === "members" ? "maestroPanelSubTabActive" : ""}`}
                            onClick={() => onTeamSubTabChange("members")}
                        >
                            Members
                            <span className="maestroPanelSubTabCount">{activeTeamCount}</span>
                        </button>
                        <button
                            className={`maestroPanelSubTab ${teamSubTab === "pinned" ? "maestroPanelSubTabActive" : ""}`}
                            onClick={() => onTeamSubTabChange("pinned")}
                        >
                            Pinned
                            <span className="maestroPanelSubTabCount">{pinnedTeamCount}</span>
                        </button>
                        <button
                            className={`maestroPanelSubTab ${teamSubTab === "archived" ? "maestroPanelSubTabActive" : ""}`}
                            onClick={() => onTeamSubTabChange("archived")}
                        >
                            Archived
                            <span className="maestroPanelSubTabCount">{archivedTeamCount}</span>
                        </button>
                    </>
                )}

                {/* Skills has no sub-tabs */}
            </div>
        </div>
    );
};
