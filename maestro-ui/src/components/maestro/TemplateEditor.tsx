import React, { useState, useEffect, useCallback } from "react";
import { MaestroTemplate, TemplateRole } from "../../app/types/maestro";
import { maestroClient } from "../../utils/MaestroClient";
import { Icon } from "../Icon";

// Available template variables with descriptions
const TEMPLATE_VARIABLES = [
    { name: "TASK_ID", description: "Unique task identifier" },
    { name: "TASK_TITLE", description: "Human-readable task title" },
    { name: "TASK_DESCRIPTION", description: "Detailed task description" },
    { name: "TASK_PRIORITY", description: "Task priority level (low/medium/high/critical)" },
    { name: "ACCEPTANCE_CRITERIA", description: "Formatted acceptance criteria list" },
    { name: "CODEBASE_CONTEXT", description: "Code context section (optional)" },
    { name: "RELATED_TASKS", description: "Related tasks information (optional)" },
    { name: "PROJECT_STANDARDS", description: "Project guidelines and standards (optional)" },
    { name: "ALL_TASKS", description: "All tasks in session (for multi-task sessions)" },
    { name: "TASK_COUNT", description: "Number of tasks in session" },
];

type TemplateEditorProps = {
    template: MaestroTemplate;
    onSave: (template: MaestroTemplate) => void;
    onCancel: () => void;
};

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
    const [name, setName] = useState(template.name);
    const [content, setContent] = useState(template.content);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [showVariables, setShowVariables] = useState(false);

    useEffect(() => {
        setHasChanges(name !== template.name || content !== template.content);
    }, [name, content, template.name, template.content]);

    const handleSave = useCallback(async () => {
        if (!hasChanges) return;

        setIsSaving(true);
        setError(null);

        try {
            const updates: { name?: string; content?: string } = {};
            if (name !== template.name) updates.name = name;
            if (content !== template.content) updates.content = content;

            const updated = await maestroClient.updateTemplate(template.id, updates);
            onSave(updated);
        } catch (err: any) {
            setError(err.message || "Failed to save template");
        } finally {
            setIsSaving(false);
        }
    }, [hasChanges, name, content, template, onSave]);

    const handleReset = useCallback(async () => {
        if (!confirm("Reset this template to its default content? This cannot be undone.")) {
            return;
        }

        setIsResetting(true);
        setError(null);

        try {
            const reset = await maestroClient.resetTemplate(template.id);
            setName(reset.name);
            setContent(reset.content);
            onSave(reset);
        } catch (err: any) {
            setError(err.message || "Failed to reset template");
        } finally {
            setIsResetting(false);
        }
    }, [template.id, onSave]);

    const insertVariable = useCallback((variableName: string) => {
        const textarea = document.getElementById("template-content") as HTMLTextAreaElement;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newContent = content.slice(0, start) + `\${${variableName}}` + content.slice(end);
            setContent(newContent);
            // Focus and set cursor position after insert
            setTimeout(() => {
                textarea.focus();
                const newPos = start + variableName.length + 3;
                textarea.setSelectionRange(newPos, newPos);
            }, 0);
        } else {
            setContent(content + `\${${variableName}}`);
        }
    }, [content]);

    return (
        <div className="templateEditor">
            <div className="templateEditorHeader">
                <div className="templateEditorTitle">
                    <Icon name="code" size={16} />
                    <span>Edit Template: {template.role}</span>
                </div>
                <div className="templateEditorActions">
                    <button
                        className="terminalBtn terminalBtnSmall"
                        onClick={() => setShowVariables(!showVariables)}
                    >
                        <Icon name="settings" size={14} />
                        {showVariables ? "Hide" : "Show"} Variables
                    </button>
                </div>
            </div>

            {error && (
                <div className="templateEditorError">
                    {error}
                </div>
            )}

            <div className="templateEditorBody">
                <div className={`templateEditorMain ${showVariables ? "withSidebar" : ""}`}>
                    <div className="templateEditorField">
                        <label className="templateEditorLabel">Template Name</label>
                        <input
                            type="text"
                            className="templateEditorInput"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Template name..."
                        />
                    </div>

                    <div className="templateEditorField templateEditorFieldContent">
                        <label className="templateEditorLabel">
                            Template Content
                            <span className="templateEditorLabelHint">
                                Use {"${VARIABLE_NAME}"} to insert variables
                            </span>
                        </label>
                        <textarea
                            id="template-content"
                            className="templateEditorTextarea"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Enter template content..."
                            spellCheck={false}
                        />
                    </div>
                </div>

                {showVariables && (
                    <div className="templateEditorSidebar">
                        <div className="templateVariablesHeader">
                            <Icon name="code" size={14} />
                            Available Variables
                        </div>
                        <div className="templateVariablesList">
                            {TEMPLATE_VARIABLES.map((v) => (
                                <button
                                    key={v.name}
                                    className="templateVariableItem"
                                    onClick={() => insertVariable(v.name)}
                                    title={`Insert \${${v.name}}`}
                                >
                                    <code className="templateVariableName">${"{" + v.name + "}"}</code>
                                    <span className="templateVariableDesc">{v.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="templateEditorFooter">
                <div className="templateEditorFooterLeft">
                    <button
                        className="terminalBtn terminalBtnDanger"
                        onClick={handleReset}
                        disabled={isResetting || isSaving}
                    >
                        {isResetting ? "Resetting..." : "Reset to Default"}
                    </button>
                </div>
                <div className="templateEditorFooterRight">
                    <button
                        className="terminalBtn"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        className="terminalBtn terminalBtnPrimary"
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                    >
                        {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}
