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
    const [roleFilter, setRoleFilter] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
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

    // Get unique roles and categories
    const { roles, categories } = useMemo(() => {
        const rolesSet = new Set<string>();
        const categoriesSet = new Set<string>();

        skills.forEach(skill => {
            if (skill.role) rolesSet.add(skill.role);
            if (skill.category) categoriesSet.add(skill.category);
        });

        return {
            roles: Array.from(rolesSet).sort(),
            categories: Array.from(categoriesSet).sort(),
        };
    }, [skills]);

    // Filter skills
    const filteredSkills = useMemo(() => {
        return skills.filter(skill => {
            // Search filter
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

            // Role filter
            if (roleFilter && skill.role !== roleFilter) {
                return false;
            }

            // Category filter
            if (categoryFilter && skill.category !== categoryFilter) {
                return false;
            }

            return true;
        });
    }, [skills, searchQuery, roleFilter, categoryFilter]);

    const handleToggleSkill = (skillId: string) => {
        if (selectedSkills.includes(skillId)) {
            onSelectionChange(selectedSkills.filter(id => id !== skillId));
        } else {
            onSelectionChange([...selectedSkills, skillId]);
        }
    };

    const handleClearFilters = () => {
        setSearchQuery("");
        setRoleFilter(null);
        setCategoryFilter(null);
    };

    if (loading) {
        return (
            <div className="claudeCodeSkillsLoading">
                <span className="claudeCodeSkillsSpinner">⟳</span> Loading Claude Code skills...
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
            {/* Search and filters */}
            <div className="claudeCodeSkillsToolbar">
                <div className="claudeCodeSkillsSearch">
                    <Icon name="search" />
                    <input
                        type="text"
                        placeholder="Search skills, triggers, tags..."
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
                            ×
                        </button>
                    )}
                </div>

                <div className="claudeCodeSkillsFilters">
                    <select
                        value={roleFilter || ""}
                        onChange={(e) => setRoleFilter(e.target.value || null)}
                        className="claudeCodeSkillsFilterSelect"
                    >
                        <option value="">All Roles</option>
                        {roles.map(role => (
                            <option key={role} value={role}>
                                {role}
                            </option>
                        ))}
                    </select>

                    <select
                        value={categoryFilter || ""}
                        onChange={(e) => setCategoryFilter(e.target.value || null)}
                        className="claudeCodeSkillsFilterSelect"
                    >
                        <option value="">All Categories</option>
                        {categories.map(category => (
                            <option key={category} value={category}>
                                {category}
                            </option>
                        ))}
                    </select>

                    {(searchQuery || roleFilter || categoryFilter) && (
                        <button
                            className="claudeCodeSkillsClearFilters"
                            onClick={handleClearFilters}
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            </div>

            {/* Results count */}
            <div className="claudeCodeSkillsCount">
                {selectedSkills.length > 0 && (
                    <span className="claudeCodeSkillsSelected">
                        {selectedSkills.length} selected •{" "}
                    </span>
                )}
                {filteredSkills.length} of {skills.length} skills
            </div>

            {/* Skills grid */}
            <div className="claudeCodeSkillsGrid">
                {filteredSkills.length === 0 ? (
                    <div className="claudeCodeSkillsNoResults">
                        No skills match your filters. Try adjusting your search.
                    </div>
                ) : (
                    filteredSkills.map((skill) => {
                        const isSelected = selectedSkills.includes(skill.id);
                        const isExpanded = expandedSkillId === skill.id;

                        return (
                            <div
                                key={skill.id}
                                className={`claudeCodeSkillCard ${isSelected ? "selected" : ""}`}
                            >
                                <label className="claudeCodeSkillCardHeader">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleSkill(skill.id)}
                                        className="claudeCodeSkillCheckbox"
                                    />
                                    <div className="claudeCodeSkillInfo">
                                        <div className="claudeCodeSkillName">{skill.name}</div>
                                        <div className="claudeCodeSkillDescription">
                                            {skill.description}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="claudeCodeSkillExpand"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setExpandedSkillId(isExpanded ? null : skill.id);
                                        }}
                                        title={isExpanded ? "Show less" : "Show more"}
                                    >
                                        {isExpanded ? "−" : "+"}
                                    </button>
                                </label>

                                {isExpanded && (
                                    <div className="claudeCodeSkillDetails">
                                        <div className="claudeCodeSkillMeta">
                                            {skill.role && (
                                                <span className="claudeCodeSkillBadge claudeCodeSkillBadgeRole">
                                                    {skill.role}
                                                </span>
                                            )}
                                            {skill.scope && (
                                                <span className="claudeCodeSkillBadge claudeCodeSkillBadgeScope">
                                                    {skill.scope}
                                                </span>
                                            )}
                                            {skill.category && (
                                                <span className="claudeCodeSkillBadge claudeCodeSkillBadgeCategory">
                                                    {skill.category}
                                                </span>
                                            )}
                                            {skill.language && (
                                                <span className="claudeCodeSkillBadge claudeCodeSkillBadgeLang">
                                                    {skill.language}
                                                </span>
                                            )}
                                            {skill.framework && (
                                                <span className="claudeCodeSkillBadge claudeCodeSkillBadgeFramework">
                                                    {skill.framework}
                                                </span>
                                            )}
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
        </div>
    );
}
