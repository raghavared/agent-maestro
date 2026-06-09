import React from "react";
import { MaestroProject } from "../../app/types/maestro";
import { Icon } from "./redesign/kit";

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
            <div className="pn-psb pn-psb--collapsed">
                <button type="button"
                    className="pn-ib"
                    onClick={onToggleCollapse}
                    title="Expand project selector"
                >
                    <Icon name="chevronR" />
                </button>
                <div className="pn-psb__dots">
                    {projects.map((p) => (
                        <span
                            key={p.id}
                            className="pn-dot"
                            style={{ background: selectedProjectIds.has(p.id) ? projectColors.get(p.id) : undefined }}
                            title={p.name}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="pn-psb">
            <div className="pn-psb__hd">
                <span className="pn-eyebrow">Projects</span>
                <button type="button"
                    className="pn-ib"
                    onClick={onToggleCollapse}
                    title="Collapse sidebar"
                >
                    <Icon name="chevronL" />
                </button>
            </div>

            <div className="pn-psb__selectall">
                <label className="pn-psb__checklabel">
                    <input
                        type="checkbox"
                        className="pn-psb__checkbox"
                        checked={allSelected}
                        onChange={() => (allSelected ? onDeselectAll() : onSelectAll())}
                    />
                    <span className="pn-psb__checkbox-custom" />
                    <span className="pn-psb__selectall-text">
                        {allSelected ? "Deselect All" : "Select All"}
                    </span>
                </label>
            </div>

            <div className="pn-psb__divider" />

            <div className="pn-psb__list">
                {projects.map((project) => {
                    const isSelected = selectedProjectIds.has(project.id);
                    const color = projectColors.get(project.id) ?? "#00d9ff";
                    const taskCount = taskCountByProject.get(project.id) ?? 0;
                    const sessionCount = sessionCountByProject.get(project.id) ?? 0;

                    return (
                        <label
                            key={project.id}
                            className={`pn-psb__item ${isSelected ? "pn-psb__item--sel" : ""}`}
                        >
                            <input
                                type="checkbox"
                                className="pn-psb__checkbox"
                                checked={isSelected}
                                onChange={() => onToggleProject(project.id)}
                            />
                            <span
                                className="pn-psb__swatch"
                                style={{ background: color }}
                            />
                            <span className="pn-psb__name" title={project.name}>
                                {project.isMaster && (
                                    <span className="pn-psb__master" title="Master Project">★</span>
                                )}
                                {project.name}
                            </span>
                            <span className="pn-psb__stats">
                                {taskCount > 0 && (
                                    <span className="pn-psb__stat">{taskCount} tasks</span>
                                )}
                                {sessionCount > 0 && (
                                    <span className="pn-psb__stat">{sessionCount} sess</span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
});
