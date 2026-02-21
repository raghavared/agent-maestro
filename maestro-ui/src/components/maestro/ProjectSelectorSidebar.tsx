import React from "react";
import { MaestroProject } from "../../app/types/maestro";

type ProjectSelectorSidebarProps = {
    projects: MaestroProject[];
    selectedProjectIds: Set<string>;
    projectColors: Map<string, string>;
    taskCountByProject: Map<string, number>;
    sessionCountByProject: Map<string, number>;
    collapsed: boolean;
    onToggleCollapse: () => void;
    onToggleProject: (projectId: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
};

export const ProjectSelectorSidebar = React.memo(function ProjectSelectorSidebar({
    projects,
    selectedProjectIds,
    projectColors,
    taskCountByProject,
    sessionCountByProject,
    collapsed,
    onToggleCollapse,
    onToggleProject,
    onSelectAll,
    onDeselectAll,
}: ProjectSelectorSidebarProps) {
    const allSelected = projects.length > 0 && selectedProjectIds.size === projects.length;

    if (collapsed) {
        return (
            <div className="mpbSidebar mpbSidebar--collapsed">
                <button
                    className="mpbSidebarToggle"
                    onClick={onToggleCollapse}
                    title="Expand project selector"
                >
                    ▶
                </button>
                <div className="mpbSidebarCollapsedDots">
                    {projects.map((p) => (
                        <span
                            key={p.id}
                            className={`mpbSidebarDot ${selectedProjectIds.has(p.id) ? "mpbSidebarDot--selected" : ""}`}
                            style={{ background: selectedProjectIds.has(p.id) ? projectColors.get(p.id) : undefined }}
                            title={p.name}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="mpbSidebar">
            <div className="mpbSidebarHeader">
                <span className="mpbSidebarTitle">Projects</span>
                <button
                    className="mpbSidebarToggle"
                    onClick={onToggleCollapse}
                    title="Collapse sidebar"
                >
                    ◀
                </button>
            </div>

            <div className="mpbSidebarSelectAll">
                <label className="mpbCheckboxLabel">
                    <input
                        type="checkbox"
                        className="mpbCheckbox"
                        checked={allSelected}
                        onChange={() => (allSelected ? onDeselectAll() : onSelectAll())}
                    />
                    <span className="mpbCheckboxCustom" />
                    <span className="mpbSelectAllText">
                        {allSelected ? "Deselect All" : "Select All"}
                    </span>
                </label>
            </div>

            <div className="mpbSidebarDivider" />

            <div className="mpbSidebarList">
                {projects.map((project) => {
                    const isSelected = selectedProjectIds.has(project.id);
                    const color = projectColors.get(project.id) ?? "#00d9ff";
                    const taskCount = taskCountByProject.get(project.id) ?? 0;
                    const sessionCount = sessionCountByProject.get(project.id) ?? 0;

                    return (
                        <label
                            key={project.id}
                            className={`mpbProjectItem ${isSelected ? "mpbProjectItem--selected" : ""}`}
                        >
                            <input
                                type="checkbox"
                                className="mpbCheckbox"
                                checked={isSelected}
                                onChange={() => onToggleProject(project.id)}
                            />
                            <span
                                className="mpbProjectColor"
                                style={{ background: color }}
                            />
                            <span className="mpbProjectName" title={project.name}>
                                {project.isMaster && (
                                    <span className="mpbProjectMasterIcon" title="Master Project">★</span>
                                )}
                                {project.name}
                            </span>
                            <span className="mpbProjectStats">
                                {taskCount > 0 && (
                                    <span className="mpbProjectStatItem">{taskCount} tasks</span>
                                )}
                                {sessionCount > 0 && (
                                    <span className="mpbProjectStatItem">{sessionCount} sess</span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
});
