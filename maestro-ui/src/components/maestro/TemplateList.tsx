import React, { useState, useEffect, useCallback } from "react";
import { MaestroTemplate } from "../../app/types/maestro";
import { maestroClient } from "../../utils/MaestroClient";
import { Icon } from "../Icon";
import { TemplateEditor } from "./TemplateEditor";

export function TemplateList() {
    const [templates, setTemplates] = useState<MaestroTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<MaestroTemplate | null>(null);

    const loadTemplates = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await maestroClient.getTemplates();
            setTemplates(data);
        } catch (err: any) {
            setError(err.message || "Failed to load templates");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const handleSave = useCallback((updated: MaestroTemplate) => {
        setTemplates((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
        );
        setEditingTemplate(null);
    }, []);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    const getRoleIcon = (role: string): "layers" | "terminal" => {
        return role === "orchestrator" ? "layers" : "terminal";
    };

    const getRoleColor = (role: string) => {
        return role === "orchestrator" ? "var(--color-accent-purple)" : "var(--color-accent-blue)";
    };

    if (editingTemplate) {
        return (
            <TemplateEditor
                template={editingTemplate}
                onSave={handleSave}
                onCancel={() => setEditingTemplate(null)}
            />
        );
    }

    return (
        <div className="templateList">
            <div className="templateListHeader">
                <div className="templateListTitle">
                    <Icon name="code" size={18} />
                    <span>Agent Templates</span>
                </div>
                <button
                    className="terminalBtn terminalBtnSmall"
                    onClick={loadTemplates}
                    disabled={isLoading}
                >
                    <Icon name="refresh" size={14} />
                    Refresh
                </button>
            </div>

            <p className="templateListDescription">
                Templates define the system prompt for worker and orchestrator agents.
                Edit templates to customize agent behavior.
            </p>

            {error && (
                <div className="templateListError">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="templateListLoading">
                    Loading templates...
                </div>
            ) : (
                <div className="templateListItems">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="templateListItem"
                            onClick={() => setEditingTemplate(template)}
                        >
                            <div className="templateListItemIcon" style={{ color: getRoleColor(template.role) }}>
                                <Icon name={getRoleIcon(template.role)} size={20} />
                            </div>
                            <div className="templateListItemContent">
                                <div className="templateListItemHeader">
                                    <span className="templateListItemName">{template.name}</span>
                                    <span className="templateListItemRole" style={{ color: getRoleColor(template.role) }}>
                                        {template.role}
                                    </span>
                                </div>
                                <div className="templateListItemMeta">
                                    <span className="templateListItemId">
                                        {template.id}
                                    </span>
                                    <span className="templateListItemDate">
                                        <Icon name="clock" size={12} />
                                        Updated {formatDate(template.updatedAt)}
                                    </span>
                                    {template.isDefault && (
                                        <span className="templateListItemBadge">default</span>
                                    )}
                                </div>
                            </div>
                            <div className="templateListItemAction">
                                <Icon name="edit" size={16} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && templates.length === 0 && !error && (
                <div className="templateListEmpty">
                    <Icon name="file" size={24} />
                    <span>No templates found. Templates will be created automatically when the server starts.</span>
                </div>
            )}
        </div>
    );
}
