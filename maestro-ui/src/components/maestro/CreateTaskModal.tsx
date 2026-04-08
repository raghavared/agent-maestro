import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { MaestroTask, MaestroProject, TeamMember, MemberLaunchOverride } from "../../app/types/maestro";
import { ClaudeCodeSkillsSelector } from "./ClaudeCodeSkillsSelector";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useTaskForm } from "../../hooks/useTaskForm";
import { useReferenceTaskPicker } from "../../hooks/useReferenceTaskPicker";
import { useFileAutocomplete } from "../../hooks/useFileAutocomplete";
import { useSkillAutocomplete } from "../../hooks/useSkillAutocomplete";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useDraftTaskLifecycle } from "../../hooks/useDraftTaskLifecycle";

// Sub-components
import { TaskFormHeader } from "./task-modal/TaskFormHeader";
import { TaskDescriptionField } from "./task-modal/TaskDescriptionField";
import { ReferenceTaskPicker } from "./task-modal/ReferenceTaskPicker";
import { TaskModalFooter } from "./task-modal/TaskModalFooter";
import { TaskTabBar } from "./task-modal/TaskTabBar";
import { ConfirmDiscardDialog } from "./task-modal/ConfirmDiscardDialog";
import { LaunchConfigPanel } from "./task-modal/LaunchConfigPanel";

// Tab content components
import { SubtasksTab } from "./task-modal/SubtasksTab";
import { SessionsTab } from "./task-modal/SessionsTab";
import { GeneratedDocsTab } from "./task-modal/GeneratedDocsTab";
import { TimelineTab } from "./task-modal/TimelineTab";
import { DetailsTab } from "./task-modal/DetailsTab";
import { RefDocsTab } from "./task-modal/RefDocsTab";
import { ImagesTab } from "./task-modal/ImagesTab";

type CreateTaskModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (task: {
        title: string;
        description: string;
        priority: string;
        startImmediately?: boolean;
        skillIds?: string[];
        referenceTaskIds?: string[];
        parentId?: string;
        teamMemberId?: string;
        teamMemberIds?: string[];
        memberOverrides?: Record<string, MemberLaunchOverride>;
    }) => Promise<void> | void;
    onStartTask?: (taskId: string) => Promise<void> | void;
    project: MaestroProject;
    parentId?: string;
    parentTitle?: string;
    mode?: "create" | "edit";
    task?: MaestroTask;
    onUpdateTask?: (taskId: string, updates: Partial<MaestroTask>) => void;
    onAddSubtask?: (title: string) => void;
    onToggleSubtask?: (subtaskId: string) => void;
    onDeleteSubtask?: (subtaskId: string) => void;
    onWorkOn?: () => void;
    onNavigateToTask?: (taskId: string) => void;
    onJumpToSession?: (sessionId: string) => void;
    onWorkOnSubtask?: (subtask: MaestroTask) => void;
    selectedAgentId?: string;
    onAgentSelect?: (agentId: string) => void;
    variant?: "modal" | "overlay";
};

export function CreateTaskModal({
    isOpen,
    onClose,
    onCreate,
    onStartTask,
    project,
    parentId,
    parentTitle,
    mode = "create",
    task,
    onUpdateTask,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
    onWorkOn,
    onNavigateToTask,
    onJumpToSession,
    onWorkOnSubtask,
    variant = "modal",
}: CreateTaskModalProps) {
    const isEditMode = mode === "edit" && !!task;
    const isOverlay = variant === "overlay";

    // ==================== HOOKS ====================

    const refPicker = useReferenceTaskPicker(project?.id);
    const files = useFileAutocomplete(project?.basePath, isOpen);
    const skills = useSkillAutocomplete(project?.basePath, isOpen);
    const stagedFileInputRef = useRef<HTMLInputElement>(null);
    const tasks = useMaestroStore(s => s.tasks);
    const teamMembersMap = useMaestroStore(s => s.teamMembers);
    const teamMembers = useMemo(() =>
        Object.values(teamMembersMap).filter((m: TeamMember) => m.status === 'active' && m.projectId === project?.id),
        [teamMembersMap, project?.id]
    );

    // ==================== DRAFT LIFECYCLE ====================

    const getAutoTitle = useCallback(() => {
        const storeTasks = useMaestroStore.getState().tasks;
        const projectTasks = Object.values(storeTasks).filter(
            (t: MaestroTask) => t.projectId === project?.id
        );
        let n = 1;
        const existingTitles = new Set(projectTasks.map((t: MaestroTask) => t.title));
        while (existingTitles.has(`Untitled ${n}`)) n++;
        return `Untitled ${n}`;
    }, [project?.id]);

    // We need a ref to read form state at create time (avoids stale closures)
    const formStateRef = useRef({
        title: "", prompt: "", priority: "medium" as string,
        selectedTeamMemberIds: [] as string[], selectedSkills: [] as string[],
        selectedReferenceTasks: [] as MaestroTask[],
    });

    const draft = useDraftTaskLifecycle({
        projectId: project?.id,
        parentId,
        enabled: mode === "create" && isOpen,
        getFormData: () => ({
            title: formStateRef.current.title.trim() || getAutoTitle(),
            description: formStateRef.current.prompt,
            priority: formStateRef.current.priority as any,
            skillIds: formStateRef.current.selectedSkills.length > 0 ? formStateRef.current.selectedSkills : undefined,
            referenceTaskIds: formStateRef.current.selectedReferenceTasks.length > 0
                ? formStateRef.current.selectedReferenceTasks.map(t => t.id) : undefined,
            teamMemberId: formStateRef.current.selectedTeamMemberIds.length === 1 ? formStateRef.current.selectedTeamMemberIds[0] : undefined,
            teamMemberIds: formStateRef.current.selectedTeamMemberIds.length > 0 ? formStateRef.current.selectedTeamMemberIds : undefined,
        }),
    }) as ReturnType<typeof useDraftTaskLifecycle> & { _triggerAutoCreate: () => void; _uploadStagedImages: (taskId: string, files: File[]) => Promise<void> };

    const form = useTaskForm(mode, isOpen, task, draft.draftTask);

    // Keep formStateRef in sync (read at create time, not in a stale closure)
    formStateRef.current = {
        title: form.title,
        prompt: form.prompt,
        priority: form.priority,
        selectedTeamMemberIds: form.selectedTeamMemberIds,
        selectedSkills: form.selectedSkills,
        selectedReferenceTasks: refPicker.selectedReferenceTasks,
    };

    const effectiveEditMode = isEditMode || draft.phase === "created";
    const effectiveTask = isEditMode ? task : draft.draftTask;

    // Trigger auto-create when user starts typing in create mode
    useEffect(() => {
        if (mode !== "create" || draft.phase !== "idle") return;
        const hasContent = form.title.trim() !== "" || form.prompt.trim() !== "";
        if (hasContent) {
            draft._triggerAutoCreate();
        }
    }, [mode, draft.phase, form.title, form.prompt]);

    // Upload staged images after draft creation
    useEffect(() => {
        if (draft.phase === "created" && draft.draftTaskId && form.stagedImageFiles.length > 0) {
            draft._uploadStagedImages(draft.draftTaskId, form.stagedImageFiles);
        }
    }, [draft.phase, draft.draftTaskId]);

    // ==================== AUTO-SAVE ====================

    const autoSaveFn = useCallback(async () => {
        const targetTask = effectiveTask;
        if (!targetTask) return;

        const refIds = refPicker.selectedReferenceTasks.map(t => t.id);
        const updates = form.getUpdateDiff(refIds, teamMembers);
        if (!updates) return;

        if (isEditMode && onUpdateTask) {
            await onUpdateTask(targetTask.id, updates);
        } else {
            await useMaestroStore.getState().updateTask(targetTask.id, updates);
        }
    }, [effectiveTask, isEditMode, onUpdateTask, form, refPicker.selectedReferenceTasks, teamMembers]);

    const { status: autoSaveStatus, saveNow } = useAutoSave({
        changeVersion: form.changeVersion,
        hasChanges: effectiveEditMode ? form.hasUnsavedContent : false,
        saveFn: autoSaveFn,
        debounceMs: 1000,
        enabled: effectiveEditMode,
    });

    // Load reference tasks for edit mode
    useEffect(() => {
        if (isEditMode && task?.referenceTaskIds && task.referenceTaskIds.length > 0) {
            (async () => {
                const refTasks: MaestroTask[] = [];
                for (const refId of task.referenceTaskIds!) {
                    try {
                        const { default: maestroClient } = await import("../../utils/MaestroClient").then(m => ({ default: m.maestroClient }));
                        const t = await maestroClient.getTask(refId);
                        refTasks.push(t);
                    } catch { /* skip if task not found */ }
                }
                refPicker.setSelectedReferenceTasks(refTasks);
            })();
        } else if (isEditMode) {
            refPicker.setSelectedReferenceTasks([]);
        }
    }, [isEditMode, isOpen, task?.id, JSON.stringify(task?.referenceTaskIds)]);

    // Reset reference picker when switching to create mode
    useEffect(() => {
        if (mode === "create" && isOpen) {
            refPicker.reset();
        }
    }, [mode, isOpen]);

    // ==================== HANDLERS ====================

    const handleClose = async () => {
        if (effectiveEditMode) {
            // Auto-save any pending changes before closing
            if (form.hasUnsavedContent) {
                await saveNow();
            }
            onClose();
        } else if (form.hasUnsavedContent || draft.phase !== "idle") {
            // Has content but no draft yet, or draft is creating — ask to discard
            form.setShowConfirmDialog(true);
        } else {
            onClose();
        }
    };

    const handleConfirmDiscard = async () => {
        await draft.discard();
        form.resetForm();
        refPicker.reset();
        onClose();
    };

    const handleToggleLaunchConfig = () => {
        if (!form.showLaunchConfig) {
            const savedOverrides = isEditMode ? task?.memberOverrides : undefined;
            for (const id of form.selectedTeamMemberIds) {
                form.initMemberConfig(id, teamMembers, savedOverrides);
            }
            form.setActiveTab(null);
        }
        form.setShowLaunchConfig(!form.showLaunchConfig);
    };

    const handleSubmit = async (startImmediately: boolean) => {
        // Draft path: task already exists (or will be created) on server
        if (draft.phase !== "idle") {
            const taskId = await draft.ensureCreated();
            if (!taskId) return; // creation failed

            // Save any pending changes
            if (form.hasUnsavedContent) {
                await saveNow();
            }

            if (startImmediately && onStartTask) {
                await onStartTask(taskId);
            }

            form.resetForm();
            refPicker.reset();
            onClose();
            return;
        }

        // Normal create flow (user submitted before auto-create fired — rare but possible)
        if (!form.title.trim() && !form.prompt.trim()) return;

        const payload = form.getCreatePayload(
            startImmediately,
            refPicker.selectedReferenceTasks.map(t => t.id),
            parentId,
        );

        const overrides = form.getMemberOverrides(teamMembers);
        if (overrides) {
            (payload as any).memberOverrides = overrides;
        }

        await onCreate(payload);
        form.resetForm();
        refPicker.reset();
        onClose();
    };

    const handleSave = () => {
        if (!effectiveEditMode) return;
        saveNow();
    };

    const handleAddSubtask = () => {
        if (form.newSubtaskTitle.trim()) {
            onAddSubtask?.(form.newSubtaskTitle);
            form.setNewSubtaskTitle("");
            form.setShowSubtaskInput(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (effectiveEditMode) saveNow();
            else handleSubmit(false);
        }
    };

    // ==================== EARLY RETURNS ====================

    if (!isOpen) return null;

    const subtasks = effectiveEditMode && effectiveTask ? (effectiveTask.subtasks || []) : [];

    // ==================== RENDER ====================

    const modalContent = (
        <>
            <div className={`themedModal themedModal--wide ${isOverlay ? 'themedModal--overlay' : ''}`} onClick={(e) => e.stopPropagation()}>
                <TaskFormHeader
                    title={form.title}
                    onTitleChange={form.setTitle}
                    onKeyDown={handleKeyDown}
                    isEditMode={effectiveEditMode}
                    task={effectiveTask || undefined}
                    isOverlay={isOverlay}
                    onClose={handleClose}
                    parentId={parentId}
                    parentTitle={parentTitle}
                    onNavigateToTask={onNavigateToTask}
                    autoFocus={!isEditMode}
                />

                {form.showLaunchConfig ? (
                    /* Launch config panel replaces description + tabs */
                    <div className="themedModalContent">
                        <LaunchConfigPanel
                            selectedTeamMemberIds={form.selectedTeamMemberIds}
                            teamMembers={teamMembers}
                            memberConfigs={form.memberConfigs}
                            onUpdateConfig={form.updateMemberConfig}
                            onClose={() => form.setShowLaunchConfig(false)}
                        />
                    </div>
                ) : (
                    /* Normal description + tabs view */
                    <>
                        <div className={isOverlay ? 'themedModalDescriptionArea' : ''}>
                            <div className="themedModalContent">
                                <TaskDescriptionField
                                    prompt={form.prompt}
                                    onPromptChange={form.setPrompt}
                                    onKeyDown={handleKeyDown}
                                    files={files}
                                    skills={skills}
                                    isOverlay={isOverlay}
                                >
                                    {effectiveEditMode && effectiveTask ? (
                                        <ImagesTab
                                            variant="bar"
                                            taskId={effectiveTask.id}
                                            images={form.taskImages}
                                            onImagesChange={form.setTaskImages}
                                        />
                                    ) : (
                                        <>
                                            {form.stagedImagePreviews.map((preview, i) => (
                                                <span
                                                    key={i}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '2px 6px 2px 3px',
                                                        fontSize: '10px',
                                                        border: '1px solid var(--theme-border)',
                                                        borderRadius: '3px',
                                                        backgroundColor: 'rgba(var(--theme-primary-rgb), 0.05)',
                                                        color: 'var(--theme-text-secondary)',
                                                        maxWidth: '120px',
                                                    }}
                                                    title={form.stagedImageFiles[i]?.name}
                                                >
                                                    <img
                                                        src={preview}
                                                        alt={form.stagedImageFiles[i]?.name}
                                                        style={{ width: '16px', height: '16px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                                                    />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70px' }}>
                                                        {form.stagedImageFiles[i]?.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => form.removeStagedFile(i)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-secondary)', padding: '0', fontSize: '12px', lineHeight: 1, flexShrink: 0, opacity: 0.6 }}
                                                    >×</button>
                                                </span>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => stagedFileInputRef.current?.click()}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', fontSize: '10px', border: '1px solid var(--theme-border)', borderRadius: '3px', background: 'transparent', color: 'var(--theme-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
                                                title="Attach image"
                                            >+ img</button>
                                            <input
                                                ref={stagedFileInputRef}
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                style={{ display: 'none' }}
                                                onChange={(e) => { if (e.target.files) { form.addStagedFiles(e.target.files); e.target.value = ''; } }}
                                            />
                                        </>
                                    )}
                                    <ReferenceTaskPicker
                                        selectedReferenceTasks={refPicker.selectedReferenceTasks}
                                        showPicker={refPicker.showPicker}
                                        candidates={refPicker.candidates}
                                        loading={refPicker.loading}
                                        displayCount={refPicker.displayCount}
                                        onTogglePicker={refPicker.togglePicker}
                                        onClosePicker={refPicker.closePicker}
                                        onToggleSelection={refPicker.toggleSelection}
                                        onRemoveTask={refPicker.removeTask}
                                        onLoadMore={refPicker.loadMore}
                                    />
                                </TaskDescriptionField>
                            </div>

                            {/* Tab Content */}
                            {form.activeTab && (
                            <div className={`themedModalTabContent${isOverlay ? ' themedModalTabContent--overlay' : ''}`} style={!isOverlay ? { maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid var(--theme-border)' } : undefined}>
                                {form.activeTab === 'subtasks' && effectiveEditMode && effectiveTask && (
                                    <SubtasksTab
                                        taskId={effectiveTask.id}
                                        subtasks={subtasks}
                                        newSubtaskTitle={form.newSubtaskTitle}
                                        onNewSubtaskTitleChange={form.setNewSubtaskTitle}
                                        showSubtaskInput={form.showSubtaskInput}
                                        onToggleSubtaskInput={form.setShowSubtaskInput}
                                        onAddSubtask={handleAddSubtask}
                                        onToggleSubtask={onToggleSubtask}
                                        onDeleteSubtask={onDeleteSubtask}
                                        onNavigateToTask={onNavigateToTask}
                                        onWorkOnSubtask={onWorkOnSubtask}
                                    />
                                )}
                                {form.activeTab === 'skills' && (
                                    <ClaudeCodeSkillsSelector
                                        selectedSkills={form.selectedSkills}
                                        onSelectionChange={form.setSelectedSkills}
                                        projectPath={project?.basePath || project?.workingDir || undefined}
                                    />
                                )}
                                {form.activeTab === 'sessions' && effectiveEditMode && effectiveTask && (
                                    <SessionsTab
                                        taskId={effectiveTask.id}
                                        tasks={tasks}
                                        onJumpToSession={onJumpToSession}
                                    />
                                )}
                                {form.activeTab === 'ref-docs' && (
                                    <RefDocsTab
                                        selectedReferenceTasks={refPicker.selectedReferenceTasks}
                                        onRemoveTask={refPicker.removeTask}
                                    />
                                )}
                                {form.activeTab === 'gen-docs' && effectiveEditMode && (
                                    <GeneratedDocsTab taskDocs={form.taskDocs} />
                                )}
                                {form.activeTab === 'timeline' && effectiveEditMode && effectiveTask && (
                                    <TimelineTab taskId={effectiveTask.id} />
                                )}
                                {form.activeTab === 'details' && (
                                    <DetailsTab
                                        priority={form.priority}
                                        onPriorityChange={form.setPriority}
                                        dueDate={form.dueDate}
                                        onDueDateChange={form.setDueDate}
                                        isEditMode={effectiveEditMode}
                                        task={effectiveTask || undefined}
                                    />
                                )}
                            </div>
                            )}
                        </div>

                        <TaskTabBar
                            activeTab={form.activeTab}
                            onToggleTab={form.toggleTab}
                            onCloseTab={() => form.setActiveTab(null)}
                            isEditMode={effectiveEditMode}
                            taskId={effectiveTask?.id}
                            selectedSkillsCount={form.selectedSkills.length}
                            selectedRefTasksCount={refPicker.selectedReferenceTasks.length}
                            taskDocsCount={form.taskDocs.length}
                        />
                    </>
                )}

                <TaskModalFooter
                    isEditMode={isEditMode}
                    isValid={form.isValid}
                    selectedTeamMemberIds={form.selectedTeamMemberIds}
                    onTeamMemberSelectionChange={form.setSelectedTeamMemberIds}
                    teamMembers={teamMembers}
                    onClose={handleClose}
                    onSave={handleSave}
                    onSubmit={handleSubmit}
                    onWorkOn={onWorkOn}
                    showLaunchConfig={form.showLaunchConfig}
                    onToggleLaunchConfig={handleToggleLaunchConfig}
                    autoSaveStatus={effectiveEditMode ? autoSaveStatus : undefined}
                    isDraft={draft.phase === "created"}
                />
            </div>

            <ConfirmDiscardDialog
                isOpen={form.showConfirmDialog}
                onConfirm={handleConfirmDiscard}
                onCancel={() => form.setShowConfirmDialog(false)}
            />
        </>
    );

    if (variant === 'overlay') {
        return modalContent;
    }

    return createPortal(
        <div className="themedModalBackdrop" onClick={handleClose}>
            {modalContent}
        </div>,
        document.body
    );
}
