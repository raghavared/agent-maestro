import React from "react";
import { MaestroTask } from "../../../app/types/maestro";
import { useSubtaskProgress } from "../../../hooks/useSubtaskProgress";
import { useTaskSessions } from "../../../hooks/useTaskSessions";

type TaskTabBarProps = {
    activeTab: string | null;
    onToggleTab: (tab: string) => void;
    onCloseTab: () => void;
    isEditMode: boolean;
    taskId?: string;
    selectedSkillsCount: number;
    selectedRefTasksCount: number;
    taskDocsCount: number;
};

export function TaskTabBar({
    activeTab,
    onToggleTab,
    onCloseTab,
    isEditMode,
    taskId,
    selectedSkillsCount,
    selectedRefTasksCount,
    taskDocsCount,
}: TaskTabBarProps) {
    const subtaskProgress = useSubtaskProgress(isEditMode ? taskId ?? null : null);
    const { sessions } = useTaskSessions(isEditMode ? taskId ?? null : null);

    return (
        <div className="themedModalTabBar" style={{ borderTop: '1px solid var(--theme-border)', marginTop: 'auto' }}>
            {isEditMode && (
                <button
                    type="button"
                    className={`themedModalTab ${activeTab === 'subtasks' ? 'themedModalTab--active' : ''}`}
                    onClick={() => onToggleTab('subtasks')}
                >
                    Subtasks
                    {subtaskProgress.total > 0 && (
                        <span className="themedModalTabBadge">
                            {subtaskProgress.completed}/{subtaskProgress.total}
                        </span>
                    )}
                </button>
            )}
            <button
                type="button"
                className={`themedModalTab ${activeTab === 'skills' ? 'themedModalTab--active' : ''}`}
                onClick={() => onToggleTab('skills')}
            >
                Skills
                {selectedSkillsCount > 0 && (
                    <span className="themedModalTabBadge">{selectedSkillsCount}</span>
                )}
            </button>
            {isEditMode && sessions.length > 0 && (
                <button
                    type="button"
                    className={`themedModalTab ${activeTab === 'sessions' ? 'themedModalTab--active' : ''}`}
                    onClick={() => onToggleTab('sessions')}
                >
                    Sessions
                    <span className="themedModalTabBadge">{sessions.length}</span>
                </button>
            )}
            <button
                type="button"
                className={`themedModalTab ${activeTab === 'ref-docs' ? 'themedModalTab--active' : ''}`}
                onClick={() => onToggleTab('ref-docs')}
            >
                Ref Tasks
                {selectedRefTasksCount > 0 && (
                    <span className="themedModalTabBadge">{selectedRefTasksCount}</span>
                )}
            </button>
            {isEditMode && (
                <button
                    type="button"
                    className={`themedModalTab ${activeTab === 'gen-docs' ? 'themedModalTab--active' : ''}`}
                    onClick={() => onToggleTab('gen-docs')}
                >
                    Gen Docs
                    {taskDocsCount > 0 && (
                        <span className="themedModalTabBadge">{taskDocsCount}</span>
                    )}
                </button>
            )}
            {isEditMode && (
                <button
                    type="button"
                    className={`themedModalTab ${activeTab === 'timeline' ? 'themedModalTab--active' : ''}`}
                    onClick={() => onToggleTab('timeline')}
                >
                    Timeline
                </button>
            )}
            <button
                type="button"
                className={`themedModalTab ${activeTab === 'details' ? 'themedModalTab--active' : ''}`}
                onClick={() => onToggleTab('details')}
            >
                Details
            </button>
            {activeTab && (
                <button
                    type="button"
                    className="themedModalTab themedModalTabClose"
                    onClick={onCloseTab}
                    title="Collapse tab panel"
                >
                    ×
                </button>
            )}
        </div>
    );
}
