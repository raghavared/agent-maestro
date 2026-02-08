import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MentionsInput, Mention } from 'react-mentions';
import { TaskPriority, AgentSkill, MaestroProject, ModelType } from "../../app/types/maestro";
import { maestroClient } from "../../utils/MaestroClient";
import { Icon } from "../Icon";

type CreateTaskModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (task: {
        title: string;
        description: string;
        priority: TaskPriority;
        initialPrompt: string;
        startImmediately?: boolean;
        skillIds?: string[];
        parentId?: string;
        model?: ModelType;
    }) => void;
    project: MaestroProject;
    parentId?: string;
    parentTitle?: string;
};

export function CreateTaskModal({ isOpen, onClose, onCreate, project, parentId, parentTitle }: CreateTaskModalProps) {
    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("medium");
    const [model, setModel] = useState<ModelType>("sonnet");
    const [prompt, setPrompt] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [files, setFiles] = useState<{ id: string, display: string }[]>([]);
    const [skills, setSkills] = useState<AgentSkill[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [loadingSkills, setLoadingSkills] = useState(false);
    const [skillsError, setSkillsError] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const titleInputRef = useRef<HTMLInputElement>(null);

    const hasUnsavedContent = title.trim() !== "" || prompt.trim() !== "";

    const handleClose = () => {
        if (hasUnsavedContent) {
            setShowConfirmDialog(true);
        } else {
            onClose();
        }
    };

    const handleConfirmDiscard = () => {
        setShowConfirmDialog(false);
        setTitle("");
        setPrompt("");
        setPriority("medium");
        setModel("sonnet");
        setShowAdvanced(false);
        setSelectedSkills([]);
        onClose();
    };

    const handleCancelDiscard = () => {
        setShowConfirmDialog(false);
    };

    useEffect(() => {
        if (isOpen && titleInputRef.current) {
            setTimeout(() => titleInputRef.current?.focus(), 100);
        }

        // Load files for autocomplete
        if (isOpen && project?.basePath) {
            invoke<string[]>("list_project_files", { root: project?.basePath })
                .then(fileList => {
                    const formattedFiles = fileList.map(f => ({ id: f, display: f }));
                    setFiles(formattedFiles);
                })
                .catch(err => console.error("Failed to list project files:", err));
        }

        // Load skills
        if (isOpen) {
            setLoadingSkills(true);
            setSkillsError(null);
            maestroClient.getSkills()
                .then(skillsList => {
                    setSkills(skillsList);
                })
                .catch(err => {
                    console.error("Failed to load skills:", err);
                    setSkillsError("Failed to load skills");
                })
                .finally(() => {
                    setLoadingSkills(false);
                });
        }
    }, [isOpen, project?.basePath]);

    if (!isOpen) return null;

    const handleSubmit = (startImmediately: boolean) => {
        if (!title.trim() || !prompt.trim()) return;

        onCreate({
            title: title.trim(),
            description: prompt,  // Use prompt as description for manifest generation
            priority,
            initialPrompt: prompt,
            startImmediately,
            skillIds: selectedSkills.length > 0 ? selectedSkills : undefined,
            parentId,
            model,
        });

        // Reset form
        setTitle("");
        setPrompt("");
        setPriority("medium");
        setModel("sonnet");
        setShowAdvanced(false);
        setSelectedSkills([]);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Cmd/Ctrl + Enter to submit
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(false);
        }
    };

    // Style for react-mentions
    const mentionsStyle = {
        control: {
            backgroundColor: 'transparent',
            fontSize: '14px',
            fontWeight: 'normal',
            lineHeight: '1.5',
            minHeight: '150px',
        },
        '&multiLine': {
            control: {
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                minHeight: '150px',
            },
            highlighter: {
                padding: '12px',
                border: '1px solid transparent',
            },
            input: {
                padding: '12px',
                border: '1px solid transparent', // match border width
                outline: 'none',
                color: '#e0e0e0',
                backgroundColor: 'transparent',
            },
        },
        suggestions: {
            list: {
                backgroundColor: '#1a1a1a',
                border: '1px solid #444',
                fontSize: '13px',
                maxHeight: '200px',
                overflowY: 'auto' as const,
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                borderRadius: '4px',
                zIndex: 9999, // Ensure it sits above everything
            },
            item: {
                padding: '8px 12px',
                borderBottom: '1px solid #333',
                color: '#ccc',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                '&focused': {
                    backgroundColor: '#2a4a3a',
                    color: '#fff',
                },
            },
        },
    };

    return (
        <div className="maestroModalOverlay terminalModal">
            <div className="createTaskModal terminalTheme">
                <div className="createTaskModalHeader">
                    <div className="createTaskModalHeaderContent">
                        <div className="createTaskModalIcon">
                            <Icon name="terminal" />
                        </div>
                        <div>
                            <h2 className="createTaskModalTitle">{parentId ? 'New Subtask' : 'New Agent Task'}</h2>
                            <p className="createTaskModalSubtitle">
                                {parentId && parentTitle
                                    ? `Creating subtask of: ${parentTitle}`
                                    : 'Give your task a title and describe what you want Claude to build'}
                            </p>
                        </div>
                    </div>
                    <button className="createTaskModalClose" onClick={handleClose}>
                        <Icon name="close" />
                    </button>
                </div>

                <div className="createTaskModalBody">
                    {/* Title Input */}
                    <div className="createTaskTitleContainer">
                        <label className="createTaskLabel">Task Title</label>
                        <input
                            ref={titleInputRef}
                            type="text"
                            className="createTaskTitleInput"
                            placeholder="e.g., Build user authentication system"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {/* Prompt/Description Textarea */}
                    <div className="createTaskPromptContainer">
                        <label className="createTaskLabel">Task Description</label>
                        <div className="createTaskPromptWrapper mentionsWrapper">
                            <MentionsInput
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                style={mentionsStyle}
                                placeholder="Describe the requirements... Use @ to tag files"
                                className="mentionsInput"
                                onKeyDown={handleKeyDown}
                                classNames={{
                                    mentions__input: 'createTaskPromptArea',
                                }}
                            >
                                <Mention
                                    trigger="@"
                                    data={files}
                                    style={{
                                        backgroundColor: "rgba(0, 255, 0, 0.2)",
                                        color: "#00ff00",
                                        fontWeight: "bold",
                                        zIndex: 1,
                                        position: 'relative',
                                        pointerEvents: 'none', // Allow clicking through to text
                                    }}
                                    renderSuggestion={(entry, search, highlightedDisplay, index, focused) => (
                                        <div className={`suggestionItem ${focused ? 'focused' : ''}`}>
                                            {entry.display}
                                        </div>
                                    )}
                                />
                            </MentionsInput>
                            <div className="createTaskPromptGlow"></div>
                        </div>
                        <div className="createTaskPromptHint">
                            <Icon name="message" />
                            <span>Tip: Be specific about requirements. Use <strong>@</strong> to tag files.</span>
                        </div>
                    </div>

                    <div className="createTaskOptions">
                        <div className="createTaskOptionRow">
                            <span className="createTaskOptionLabel">Priority</span>
                            <div className="createTaskPrioritySelector">
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${priority === "low" ? "active" : ""}`}
                                    onClick={() => setPriority("low")}
                                >
                                    Low
                                </button>
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${priority === "medium" ? "active" : ""}`}
                                    onClick={() => setPriority("medium")}
                                >
                                    Medium
                                </button>
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${priority === "high" ? "active" : ""}`}
                                    onClick={() => setPriority("high")}
                                >
                                    High
                                </button>
                            </div>
                        </div>

                        <div className="createTaskOptionRow">
                            <span className="createTaskOptionLabel">Model</span>
                            <div className="createTaskPrioritySelector">
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${model === "haiku" ? "active" : ""}`}
                                    onClick={() => setModel("haiku")}
                                >
                                    Haiku
                                </button>
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${model === "sonnet" ? "active" : ""}`}
                                    onClick={() => setModel("sonnet")}
                                >
                                    Sonnet
                                </button>
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${model === "opus" ? "active" : ""}`}
                                    onClick={() => setModel("opus")}
                                >
                                    Opus
                                </button>
                            </div>
                        </div>

                        {/* Placeholder for future options */}
                        <button
                            type="button"
                            className="createTaskAdvancedToggle"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            Advanced options
                            <span className={`createTaskAdvancedChevron ${showAdvanced ? "open" : ""}`}>›</span>
                        </button>

                        {showAdvanced && (
                            <div className="createTaskAdvancedOptions">
                                <div className="createTaskAdvancedSection">
                                    <label className="createTaskAdvancedLabel">Skills</label>

                                    {loadingSkills && (
                                        <div className="createTaskSkillsLoading">
                                            <span className="createTaskSkillsSpinner">⟳</span> Loading skills...
                                        </div>
                                    )}

                                    {skillsError && (
                                        <div className="createTaskSkillsError">
                                            {skillsError}
                                        </div>
                                    )}

                                    {!loadingSkills && skills.length === 0 && !skillsError && (
                                        <div className="createTaskSkillsEmpty">
                                            No skills installed. Add skills to <code>~/.agents-ui/maestro-skills</code> to see them here.
                                        </div>
                                    )}

                                    {!loadingSkills && skills.length > 0 && (
                                        <div className="createTaskSkillsGrid">
                                            {skills.map((skill) => (
                                                <label key={skill.id} className="createTaskSkillCheckbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSkills.includes(skill.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedSkills([...selectedSkills, skill.id]);
                                                            } else {
                                                                setSelectedSkills(selectedSkills.filter(id => id !== skill.id));
                                                            }
                                                        }}
                                                    />
                                                    <div className="createTaskSkillInfo">
                                                        <div className="createTaskSkillName">{skill.name}</div>
                                                        <div className="createTaskSkillDescription">{skill.description}</div>
                                                        <div className="createTaskSkillType">{skill.type}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="createTaskModalFooter">
                    <div className="createTaskModalFooterLeft">
                        <span className="createTaskModalKeyboardHint">
                            ⌘↵ to create
                        </span>
                    </div>
                    <div className="createTaskModalFooterRight">
                        <button
                            type="button"
                            className="createTaskBtn createTaskBtnSecondary"
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="createTaskBtn createTaskBtnPrimary"
                            onClick={() => handleSubmit(false)}
                            disabled={!title.trim() || !prompt.trim()}
                        >
                            <Icon name="plus" />
                            Create Task
                        </button>
                        <button
                            type="button"
                            className="createTaskBtn createTaskBtnSuccess"
                            onClick={() => handleSubmit(true)}
                            disabled={!title.trim() || !prompt.trim()}
                        >
                            <Icon name="play" />
                            Create & Run
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="maestroModalOverlay confirmDialogOverlay" onClick={handleCancelDiscard}>
                    <div className="confirmDialog terminalTheme" onClick={(e) => e.stopPropagation()}>
                        <div className="confirmDialogHeader">
                            <span className="confirmDialogIcon">⚠</span>
                            <span>Unsaved Changes</span>
                        </div>
                        <div className="confirmDialogBody">
                            You have unsaved task details. Are you sure you want to discard them?
                        </div>
                        <div className="confirmDialogFooter">
                            <button
                                type="button"
                                className="createTaskBtn createTaskBtnSecondary"
                                onClick={handleCancelDiscard}
                            >
                                Keep Editing
                            </button>
                            <button
                                type="button"
                                className="createTaskBtn createTaskBtnDanger"
                                onClick={handleConfirmDiscard}
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
