import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ClaudeCodeSkill } from "../../app/types/maestro";
import { Icon } from "../Icon";

interface ClaudeCodeSkillsSelectorProps {
    selectedSkills: string[];
    onSelectionChange: (skillIds: string[]) => void;
}

export function ClaudeCodeSkillsSelector({ selectedSkills, onSelectionChange }: ClaudeCodeSkillsSelectorProps) {
    const [skills, setSkills] = useState<ClaudeCodeSkill[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

    useEffect(() => {
        loadSkills();
    }, []);

    const loadSkills = async () => {
        setLoading(true);
        setError(null);
        try {
            const skillsList = await invoke<ClaudeCodeSkill[]>("list_claude_code_skills");
            setSkills(skillsList);
        } catch (err) {
            console.error("Failed to load Claude Code skills:", err);
            setError(err instanceof Error ? err.message : "Failed to load skills");
        } finally {
            setLoading(false);
        }
    };

    const filteredSkills = useMemo(() => {
        return skills.filter(skill => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = skill.name.toLowerCase().includes(query);
                const matchesDescription = skill.description.toLowerCase().includes(query);
                const matchesTriggers = skill.triggers?.some(t => t.toLowerCase().includes(query));
                const matchesTags = skill.tags?.some(t => t.toLowerCase().includes(query));
                if (!matchesName && !matchesDescription && !matchesTriggers && !matchesTags) {
                    return false;
                }
            }
            return true;
        });
    }, [skills, searchQuery]);

    const handleToggleSkill = (skillId: string) => {
        if (selectedSkills.includes(skillId)) {
            onSelectionChange(selectedSkills.filter(id => id !== skillId));
        } else {
            onSelectionChange([...selectedSkills, skillId]);
        }
    };

    if (loading) {
        return (
            <div className="claudeCodeSkillsLoading">
                <span className="claudeCodeSkillsSpinner">&#x27F3;</span> Loading Claude Code skills...
            </div>
        );
    }

    if (error) {
        return (
            <div className="claudeCodeSkillsError">
                <div>{error}</div>
                <button onClick={loadSkills} className="claudeCodeSkillsRetry">
                    Retry
                </button>
            </div>
        );
    }

    if (skills.length === 0) {
        return (
            <div className="claudeCodeSkillsEmpty">
                No Claude Code skills found. Expected at <code>~/.agents/skills/</code>
            </div>
        );
    }

    return (
        <div className="claudeCodeSkillsSelector">
            {/* Header line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
                <span style={{ color: 'rgba(var(--theme-primary-rgb), 0.5)', fontSize: '10px' }}>
                    {expanded ? "\u25BC" : "\u25B6"}
                </span>
                <span className="themedFormLabel" style={{ marginBottom: 0 }}>Skills</span>
                <span className="claudeCodeSkillsCount" style={{ flex: 1 }}>
                    ({selectedSkills.length > 0 ? `${selectedSkills.length} selected / ` : ""}{skills.length} available)
                </span>
            </div>

            {expanded && (
                <>
                    {/* Search */}
                    <div className="claudeCodeSkillsToolbar">
                        <div className="claudeCodeSkillsSearch">
                            <Icon name="search" />
                            <input
                                type="text"
                                placeholder="Search skills..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="claudeCodeSkillsSearchInput"
                            />
                            {searchQuery && (
                                <button
                                    className="claudeCodeSkillsSearchClear"
                                    onClick={() => setSearchQuery("")}
                                    title="Clear search"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Skills grid */}
                    <div className="claudeCodeSkillsGrid">
                        {filteredSkills.length === 0 ? (
                            <div className="claudeCodeSkillsNoResults">
                                No skills match your search.
                            </div>
                        ) : (
                            filteredSkills.map((skill) => {
                                const isSelected = selectedSkills.includes(skill.id);
                                const isExpanded = expandedSkillId === skill.id;

                                return (
                                    <div
                                        key={skill.id}
                                        className={`claudeCodeSkillCard ${isSelected ? "selected" : ""}`}
                                        onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                                    >
                                        <div className="claudeCodeSkillCardHeader">
                                            <span
                                                className="claudeCodeSkillCheckbox"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleSkill(skill.id);
                                                }}
                                            >
                                                {isSelected ? "[\u2713]" : "[ ]"}
                                            </span>
                                            <span className="claudeCodeSkillName">{skill.name}</span>
                                        </div>

                                        {isExpanded && (
                                            <div className="claudeCodeSkillDetails">
                                                <div className="claudeCodeSkillDescription">
                                                    {skill.description}
                                                </div>

                                                {skill.triggers && skill.triggers.length > 0 && (
                                                    <div className="claudeCodeSkillTriggers">
                                                        <strong>Triggers:</strong>{" "}
                                                        {skill.triggers.join(", ")}
                                                    </div>
                                                )}

                                                {skill.tags && skill.tags.length > 0 && (
                                                    <div className="claudeCodeSkillTags">
                                                        <strong>Tags:</strong>{" "}
                                                        {skill.tags.join(", ")}
                                                    </div>
                                                )}

                                                {skill.hasReferences && (
                                                    <div className="claudeCodeSkillReferences">
                                                        <Icon name="file" />{" "}
                                                        {skill.referenceCount} reference file{skill.referenceCount !== 1 ? "s" : ""}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
