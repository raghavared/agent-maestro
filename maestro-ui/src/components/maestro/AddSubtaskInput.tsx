import React, { useState, useRef, useEffect } from "react";

interface AddSubtaskInputProps {
    parentTaskId: string;
    onAddSubtask: (parentId: string, title: string) => Promise<void>;
    depth?: number;
}

export function AddSubtaskInput({ parentTaskId, onAddSubtask, depth = 0 }: AddSubtaskInputProps) {
    const [title, setTitle] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Auto-focus when mounted
        const timer = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(timer);
    }, []);

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && title.trim()) {
            e.preventDefault();
            await handleAddSubtask();
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
        }
    };

    const handleAddSubtask = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle || isAdding) return;

        setIsAdding(true);
        try {
            await onAddSubtask(parentTaskId, trimmedTitle);
            setTitle(""); // Clear input after successful creation
            inputRef.current?.focus(); // Keep focus for adding more
        } catch (error) {
        } finally {
            setIsAdding(false);
        }
    };

    const handleCancel = () => {
        setTitle("");
        inputRef.current?.blur();
    };

    const handleBlur = () => {
        // Only clear if not in the middle of adding
        if (!isAdding) {
            setTitle("");
        }
    };

    const indentStyle = depth > 0 ? { paddingLeft: `${depth * 24}px` } : undefined;

    return (
        <div className="terminalAddSubtaskRow" style={indentStyle} onClick={(e) => e.stopPropagation()}>
            <div className="terminalAddSubtaskMain">
                <div className="terminalAddSubtaskInput">
                    <span className="terminalAddSubtaskPrefix">+</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder="Add subtask..."
                        className="terminalAddSubtaskField"
                        disabled={isAdding}
                    />
                    {isAdding && (
                        <span className="terminalAddSubtaskSpinner">⟳</span>
                    )}
                </div>
                {title.trim() && (
                    <div className="terminalAddSubtaskHint">
                        Press <kbd>Enter</kbd> to add, <kbd>Esc</kbd> to cancel
                    </div>
                )}
            </div>
        </div>
    );
}
