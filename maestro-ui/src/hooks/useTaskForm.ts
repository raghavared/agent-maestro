import { useState, useEffect, useMemo, useCallback } from "react";
import { TaskPriority, MaestroTask, MemberLaunchOverride, TeamMember, TaskImage } from "../app/types/maestro";
import { maestroClient } from "../utils/MaestroClient";
import { MemberConfig, buildDefaultMemberConfig, buildOverridesFromConfigs } from "../components/maestro/task-modal/LaunchConfigPanel";

export function useTaskForm(mode: "create" | "edit", isOpen: boolean, task?: MaestroTask) {
    const isEditMode = mode === "edit" && !!task;

    const [title, setTitle] = useState("");
    const [prompt, setPrompt] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("medium");
    const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [dueDate, setDueDate] = useState<string>("");

    // Subtask state
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [showSubtaskInput, setShowSubtaskInput] = useState(false);

    // Task docs (edit mode)
    const [taskDocs, setTaskDocs] = useState<any[]>([]);

    // Task images (edit mode)
    const [taskImages, setTaskImages] = useState<TaskImage[]>([]);

    // Launch config state
    const [showLaunchConfig, setShowLaunchConfig] = useState(false);
    const [memberConfigs, setMemberConfigs] = useState<Record<string, MemberConfig>>({});

    // Pre-fill form when task changes in edit mode
    useEffect(() => {
        if (isEditMode && task) {
            setTitle(task.title);
            setPrompt(task.description || "");
            setPriority(task.priority);
            setSelectedTeamMemberIds(
                task.teamMemberIds && task.teamMemberIds.length > 0
                    ? task.teamMemberIds
                    : task.teamMemberId ? [task.teamMemberId] : []
            );
            setSelectedSkills(task.skillIds || []);
            setDueDate(task.dueDate || "");
        }
    }, [isEditMode, isOpen, task?.id, task?.title, task?.description, task?.priority, task?.teamMemberId, JSON.stringify(task?.teamMemberIds), JSON.stringify(task?.referenceTaskIds), task?.dueDate]);

    // Fetch task docs in edit mode
    useEffect(() => {
        if (isEditMode && task?.id) {
            maestroClient.getTaskDocs(task.id).then(setTaskDocs).catch(() => setTaskDocs([]));
        } else {
            setTaskDocs([]);
        }
    }, [isEditMode, task?.id]);

    // Load images in edit mode
    useEffect(() => {
        if (isEditMode && task) {
            setTaskImages(task.images || []);
        } else {
            setTaskImages([]);
        }
    }, [isEditMode, task?.id, JSON.stringify(task?.images)]);

    // Reset form when switching to create mode
    useEffect(() => {
        if (mode === "create" && isOpen) {
            setTitle("");
            setPrompt("");
            setPriority("medium");
            setSelectedTeamMemberIds([]);
            setSelectedSkills([]);
            setDueDate("");
            setActiveTab(null);
        }
    }, [mode, isOpen]);

    const hasUnsavedContent = useMemo(() => {
        if (mode === "create") {
            return title.trim() !== "" || prompt.trim() !== "" || dueDate !== "";
        }
        if (isEditMode && task) {
            return (
                title !== task.title ||
                prompt !== (task.description || "") ||
                priority !== task.priority ||
                dueDate !== (task.dueDate || "") ||
                JSON.stringify(selectedTeamMemberIds) !== JSON.stringify(task.teamMemberIds || (task.teamMemberId ? [task.teamMemberId] : []))
            );
        }
        return false;
    }, [mode, isEditMode, task, title, prompt, priority, dueDate, selectedTeamMemberIds]);

    const isValid = title.trim() !== "" && prompt.trim() !== "";

    const toggleTab = (tab: string) => {
        setActiveTab(prev => prev === tab ? null : tab);
    };

    // Launch config helpers
    const initMemberConfig = useCallback((memberId: string, teamMembers: TeamMember[]) => {
        setMemberConfigs(prev => {
            if (prev[memberId]) return prev; // already initialized
            const member = teamMembers.find(m => m.id === memberId);
            if (!member) return prev;
            return { ...prev, [memberId]: buildDefaultMemberConfig(member) };
        });
    }, []);

    const updateMemberConfig = useCallback((memberId: string, patch: Partial<MemberConfig>) => {
        setMemberConfigs(prev => ({
            ...prev,
            [memberId]: { ...prev[memberId], ...patch },
        }));
    }, []);

    const removeMemberConfig = useCallback((memberId: string) => {
        setMemberConfigs(prev => {
            const next = { ...prev };
            delete next[memberId];
            return next;
        });
    }, []);

    const getMemberOverrides = useCallback((teamMembers: TeamMember[]): Record<string, MemberLaunchOverride> | undefined => {
        const overrides = buildOverridesFromConfigs(memberConfigs, teamMembers);
        return Object.keys(overrides).length > 0 ? overrides : undefined;
    }, [memberConfigs]);

    const resetForm = () => {
        setTitle("");
        setPrompt("");
        setPriority("medium");
        setSelectedTeamMemberIds([]);
        setActiveTab(null);
        setSelectedSkills([]);
        setShowConfirmDialog(false);
        setNewSubtaskTitle("");
        setShowSubtaskInput(false);
        setDueDate("");
        setShowLaunchConfig(false);
        setMemberConfigs({});
        setTaskImages([]);
    };

    const getCreatePayload = (startImmediately: boolean, referenceTaskIds?: string[], parentId?: string) => ({
        title: title.trim(),
        description: prompt,
        priority,
        startImmediately,
        dueDate: dueDate || undefined,
        skillIds: selectedSkills.length > 0 ? selectedSkills : undefined,
        referenceTaskIds: referenceTaskIds && referenceTaskIds.length > 0 ? referenceTaskIds : undefined,
        parentId,
        teamMemberId: selectedTeamMemberIds.length === 1 ? selectedTeamMemberIds[0] : undefined,
        teamMemberIds: selectedTeamMemberIds.length > 0 ? selectedTeamMemberIds : undefined,
    });

    const getUpdateDiff = (referenceTaskIds: string[]): Partial<MaestroTask> | null => {
        if (!isEditMode || !task) return null;
        const updates: Partial<MaestroTask> = {};
        if (title.trim() && title !== task.title) updates.title = title.trim();
        if (prompt !== (task.description || "")) updates.description = prompt;
        if (priority !== task.priority) updates.priority = priority;
        const currentIds = task.teamMemberIds || (task.teamMemberId ? [task.teamMemberId] : []);
        if (JSON.stringify(selectedTeamMemberIds) !== JSON.stringify(currentIds)) {
            updates.teamMemberIds = selectedTeamMemberIds.length > 0 ? selectedTeamMemberIds : undefined;
            updates.teamMemberId = selectedTeamMemberIds.length === 1 ? selectedTeamMemberIds[0] : undefined;
        }
        const currentDueDate = task.dueDate || "";
        if (dueDate !== currentDueDate) updates.dueDate = dueDate || null;
        if (JSON.stringify(selectedSkills) !== JSON.stringify(task.skillIds || [])) updates.skillIds = selectedSkills;
        if (JSON.stringify(referenceTaskIds) !== JSON.stringify(task.referenceTaskIds || [])) updates.referenceTaskIds = referenceTaskIds;
        return Object.keys(updates).length > 0 ? updates : null;
    };

    return {
        title, setTitle,
        prompt, setPrompt,
        priority, setPriority,
        dueDate, setDueDate,
        selectedTeamMemberIds, setSelectedTeamMemberIds,
        selectedSkills, setSelectedSkills,
        activeTab, setActiveTab, toggleTab,
        showConfirmDialog, setShowConfirmDialog,
        newSubtaskTitle, setNewSubtaskTitle,
        showSubtaskInput, setShowSubtaskInput,
        taskDocs,
        taskImages, setTaskImages,
        hasUnsavedContent,
        isValid,
        resetForm,
        getCreatePayload,
        getUpdateDiff,
        // Launch config
        showLaunchConfig, setShowLaunchConfig,
        memberConfigs,
        initMemberConfig,
        updateMemberConfig,
        removeMemberConfig,
        getMemberOverrides,
    };
}
