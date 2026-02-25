import React from "react";
import { MentionsInput, Mention } from 'react-mentions';

type TaskDescriptionFieldProps = {
    prompt: string;
    onPromptChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    files: { id: string; display: string }[];
    isOverlay: boolean;
    children?: React.ReactNode; // For reference task chips/button rendered above textarea
};

export function TaskDescriptionField({
    prompt,
    onPromptChange,
    onKeyDown,
    files,
    isOverlay,
    children,
}: TaskDescriptionFieldProps) {
    const mentionsStyle = {
        control: {
            backgroundColor: 'transparent',
            fontSize: '12px',
            fontWeight: 'normal' as const,
            lineHeight: '1.5',
            ...(isOverlay
                ? { height: '100%', minHeight: 0 }
                : { minHeight: '250px', maxHeight: '400px' }),
        },
        '&multiLine': {
            control: {
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                ...(isOverlay
                    ? { height: '100%', minHeight: 0 }
                    : { minHeight: '250px', maxHeight: '400px' }),
            },
            highlighter: {
                padding: '8px 10px',
                border: '1px solid transparent',
                color: 'transparent',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                pointerEvents: 'none' as const,
                overflow: 'hidden' as const,
            },
            input: {
                padding: '8px 10px',
                border: '1px solid transparent',
                outline: 'none',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                ...(isOverlay ? {} : { maxHeight: '400px' }),
                overflow: 'auto' as const,
            },
        },
        suggestions: {
            list: {
                zIndex: 9999,
                width: '100%',
                maxWidth: '100%',
                left: 0,
                right: 0,
                boxSizing: 'border-box' as const,
            },
            item: {
                boxSizing: 'border-box' as const,
            },
        },
    };

    return (
        <div className="themedFormRow" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="themedFormLabel" style={{ marginBottom: 0 }}>Description</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {children}
                </div>
            </div>

            <div className="mentionsWrapper" style={{ flex: 1, minHeight: 0 }}>
                <MentionsInput
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    style={mentionsStyle}
                    placeholder="Describe the requirements... Use @ to tag files"
                    className="mentionsInput"
                    onKeyDown={onKeyDown}
                >
                    <Mention
                        trigger="@"
                        data={files}
                        renderSuggestion={(entry, _search, _highlightedDisplay, _index, focused) => (
                            <div className={`suggestionItem ${focused ? 'focused' : ''}`}>
                                {entry.display}
                            </div>
                        )}
                    />
                </MentionsInput>
            </div>
        </div>
    );
}
