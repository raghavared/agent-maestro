import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ClaudeCodeSkill, MaestroProject } from "../../app/types/maestro";
import { Icon } from "../Icon";
import { maestroClient } from "../../utils/MaestroClient";

interface SkillsPanelProps {
    project: MaestroProject;
}

type SkillsView = 'installed' | 'marketplace';

interface MarketplaceSkill {
    name: string;
    description: string;
    repo: string;
    installs?: number;
    tags?: string[];
}

export function SkillsPanel({ project }: SkillsPanelProps) {
    const [skills, setSkills] = useState<ClaudeCodeSkill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
    const [view, setView] = useState<SkillsView>('installed');
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [marketplaceQuery, setMarketplaceQuery] = useState("");
    const [marketplaceSkills, setMarketplaceSkills] = useState<MarketplaceSkill[]>([]);
    const [marketplaceLoading, setMarketplaceLoading] = useState(false);

    const projectPath = project?.basePath || project?.workingDir;

    const loadSkills = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const skillsList = await maestroClient.getSkills(projectPath || undefined);
            setSkills(skillsList);
        } catch (err) {
            console.error("Failed to load skills:", err);
            setError(err instanceof Error ? err.message : "Failed to load skills");
        } finally {
            setLoading(false);
        }
    }, [projectPath]);

    useEffect(() => {
        loadSkills();
    }, [loadSkills]);

    // Group skills by scope
    const { projectSkills, globalSkills } = useMemo(() => {
        const filtered = skills.filter(skill => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                skill.name.toLowerCase().includes(q) ||
                skill.description.toLowerCase().includes(q) ||
                skill.triggers?.some(t => t.toLowerCase().includes(q)) ||
                skill.tags?.some(t => t.toLowerCase().includes(q))
            );
        });

        return {
            projectSkills: filtered.filter(s => s.skillScope === 'project'),
            globalSkills: filtered.filter(s => s.skillScope !== 'project'),
        };
    }, [skills, searchQuery]);

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    };

    const renderSkillCard = (skill: ClaudeCodeSkill) => {
        const isExpanded = expandedSkillId === skill.id;
        return (
            <div
                key={skill.id}
                className="skillsPanelCard"
                data-expanded={isExpanded}
                onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
            >
                <div className="skillsPanelCardHeader">
                    <span className="skillsPanelCardName">{skill.name}</span>
                    <div className="skillsPanelCardBadges">
                        {skill.skillSource && (
                            <span className="skillsPanelBadge" data-type="source">
                                {skill.skillSource === 'claude' ? '.claude' : '.agents'}
                            </span>
                        )}
                        {skill.version && (
                            <span className="skillsPanelBadge" data-type="version">
                                v{skill.version}
                            </span>
                        )}
                    </div>
                </div>
                <div className="skillsPanelCardDesc">
                    {skill.description || 'No description'}
                </div>

                {isExpanded && (
                    <div className="skillsPanelCardDetails">
                        {skill.triggers && skill.triggers.length > 0 && (
                            <div className="skillsPanelDetailRow">
                                <span className="skillsPanelDetailLabel">triggers:</span>
                                <span>{skill.triggers.join(', ')}</span>
                            </div>
                        )}
                        {skill.tags && skill.tags.length > 0 && (
                            <div className="skillsPanelDetailRow">
                                <span className="skillsPanelDetailLabel">tags:</span>
                                <span className="skillsPanelTags">
                                    {skill.tags.map(tag => (
                                        <span key={tag} className="skillsPanelTag">{tag}</span>
                                    ))}
                                </span>
                            </div>
                        )}
                        {skill.role && (
                            <div className="skillsPanelDetailRow">
                                <span className="skillsPanelDetailLabel">role:</span>
                                <span>{skill.role}</span>
                            </div>
                        )}
                        {skill.language && (
                            <div className="skillsPanelDetailRow">
                                <span className="skillsPanelDetailLabel">language:</span>
                                <span>{skill.language}</span>
                            </div>
                        )}
                        {skill.framework && (
                            <div className="skillsPanelDetailRow">
                                <span className="skillsPanelDetailLabel">framework:</span>
                                <span>{skill.framework}</span>
                            </div>
                        )}
                        {skill.hasReferences && (
                            <div className="skillsPanelDetailRow">
                                <span className="skillsPanelDetailLabel">references:</span>
                                <span>{skill.referenceCount} file{skill.referenceCount !== 1 ? 's' : ''}</span>
                            </div>
                        )}
                        {skill.skillPath && (
                            <div className="skillsPanelDetailRow">
                                <span className="skillsPanelDetailLabel">path:</span>
                                <span className="skillsPanelPath">{skill.skillPath}</span>
                            </div>
                        )}
                        {skill.content && (
                            <div className="skillsPanelContentPreview">
                                <span className="skillsPanelDetailLabel">content:</span>
                                <pre className="skillsPanelContentPre">
                                    {skill.content.length > 500
                                        ? skill.content.slice(0, 500) + '...'
                                        : skill.content}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderSection = (title: string, sectionKey: string, sectionSkills: ClaudeCodeSkill[], icon: string) => {
        const isCollapsed = collapsedSections.has(sectionKey);
        return (
            <div className="skillsPanelSection" key={sectionKey}>
                <div
                    className="skillsPanelSectionHeader"
                    onClick={() => toggleSection(sectionKey)}
                >
                    <span className="skillsPanelSectionToggle">
                        {isCollapsed ? '\u25B6' : '\u25BC'}
                    </span>
                    <span className="skillsPanelSectionIcon">{icon}</span>
                    <span className="skillsPanelSectionTitle">{title}</span>
                    <span className="skillsPanelSectionCount">({sectionSkills.length})</span>
                </div>
                {!isCollapsed && (
                    <div className="skillsPanelSectionContent">
                        {sectionSkills.length === 0 ? (
                            <div className="skillsPanelEmpty">
                                No {title.toLowerCase()} found
                            </div>
                        ) : (
                            sectionSkills.map(renderSkillCard)
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="terminalContent">
                <div className="skillsPanelLoading">
                    <span className="skillsPanelSpinner">&#x27F3;</span> Loading skills...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="terminalContent">
                <div className="skillsPanelError">
                    <div>Error: {error}</div>
                    <button onClick={loadSkills} className="themedBtn" style={{ marginTop: '8px' }}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="terminalContent skillsPanel">
            {/* View toggle + search bar */}
            <div className="skillsPanelToolbar">
                <div className="skillsPanelViewToggle">
                    <button
                        className={`skillsPanelViewBtn ${view === 'installed' ? 'active' : ''}`}
                        onClick={() => setView('installed')}
                    >
                        Installed
                        <span className="skillsPanelViewCount">{skills.length}</span>
                    </button>
                    <button
                        className={`skillsPanelViewBtn ${view === 'marketplace' ? 'active' : ''}`}
                        onClick={() => setView('marketplace')}
                    >
                        Marketplace
                    </button>
                </div>
                <div className="skillsPanelSearchWrapper">
                    <Icon name="search" />
                    <input
                        type="text"
                        placeholder={view === 'installed' ? "Filter skills..." : "Search skills.sh..."}
                        value={view === 'installed' ? searchQuery : marketplaceQuery}
                        onChange={(e) => view === 'installed' ? setSearchQuery(e.target.value) : setMarketplaceQuery(e.target.value)}
                        className="skillsPanelSearchInput"
                    />
                    {(view === 'installed' ? searchQuery : marketplaceQuery) && (
                        <button
                            className="skillsPanelSearchClear"
                            onClick={() => view === 'installed' ? setSearchQuery("") : setMarketplaceQuery("")}
                        >
                            &times;
                        </button>
                    )}
                </div>
                <button
                    className="themedBtn skillsPanelRefreshBtn"
                    onClick={loadSkills}
                    title="Refresh skills"
                >
                    &#x27F3;
                </button>
            </div>

            {/* Installed view */}
            {view === 'installed' && (
                <div className="skillsPanelContent">
                    {skills.length === 0 ? (
                        <div className="skillsPanelEmptyState">
                            <pre className="skillsPanelAscii">{`
  No skills found.

  Skills are loaded from:
  ~/.claude/skills/     (global, Claude Code)
  ~/.agents/skills/     (global, universal)
  .claude/skills/       (project-level)
  .agents/skills/       (project-level)

  Each skill is a directory with a SKILL.md file.
  Browse the Marketplace tab to install skills.
                            `}</pre>
                        </div>
                    ) : (
                        <>
                            {projectSkills.length > 0 && renderSection('Project Skills', 'project', projectSkills, '\u{1F4C1}')}
                            {renderSection('Global Skills', 'global', globalSkills, '\u{1F30D}')}
                        </>
                    )}
                </div>
            )}

            {/* Marketplace view */}
            {view === 'marketplace' && (
                <div className="skillsPanelContent">
                    <div className="skillsPanelMarketplace">
                        <div className="skillsPanelMarketplaceHeader">
                            <span className="skillsPanelSectionTitle">skills.sh</span>
                            <span className="skillsPanelMarketplaceSubtitle">
                                The Open Agent Skills Ecosystem
                            </span>
                        </div>

                        <div className="skillsPanelMarketplaceInfo">
                            <p>Browse and install community skills from <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" className="skillsPanelLink">skills.sh</a></p>
                            <p>Skills work with Claude Code, Cursor, Codex, GitHub Copilot, and 18+ other tools.</p>
                        </div>

                        <div className="skillsPanelInstallBox">
                            <div className="skillsPanelInstallLabel">Install a skill:</div>
                            <div className="skillsPanelInstallRow">
                                <code className="skillsPanelInstallCmd">npx skillsadd</code>
                                <input
                                    type="text"
                                    className="skillsPanelInstallInput"
                                    placeholder="owner/repo"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const target = e.currentTarget;
                                            const repo = target.value.trim();
                                            if (repo) {
                                                window.open(`https://skills.sh/${repo}`, '_blank');
                                                target.value = '';
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <div className="skillsPanelInstallHint">
                                Press Enter to view on skills.sh, or run the command in your terminal
                            </div>
                        </div>

                        <div className="skillsPanelPopularSection">
                            <div className="skillsPanelSectionHeader" onClick={() => toggleSection('popular')}>
                                <span className="skillsPanelSectionToggle">
                                    {collapsedSections.has('popular') ? '\u25B6' : '\u25BC'}
                                </span>
                                <span className="skillsPanelSectionTitle">Popular Skills</span>
                            </div>
                            {!collapsedSections.has('popular') && (
                                <div className="skillsPanelPopularGrid">
                                    {[
                                        { name: 'find-skills', repo: 'anthropics/find-skills', desc: 'Discover relevant skills for your project' },
                                        { name: 'cursor-rules', repo: 'pontusab/cursor-rules', desc: 'Best practices for Cursor rules' },
                                        { name: 'nextjs', repo: 'vercel/next.js-skill', desc: 'Next.js development best practices' },
                                        { name: 'react', repo: 'facebook/react-skill', desc: 'React development patterns' },
                                        { name: 'typescript', repo: 'anthropics/typescript-skill', desc: 'TypeScript best practices' },
                                        { name: 'python', repo: 'anthropics/python-skill', desc: 'Python development patterns' },
                                    ].map(item => (
                                        <a
                                            key={item.name}
                                            href={`https://skills.sh/${item.repo}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="skillsPanelPopularCard"
                                        >
                                            <span className="skillsPanelPopularName">{item.name}</span>
                                            <span className="skillsPanelPopularDesc">{item.desc}</span>
                                            <span className="skillsPanelPopularRepo">{item.repo}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="skillsPanelMarketplaceFooter">
                            <a
                                href="https://skills.sh"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="themedBtn skillsPanelBrowseBtn"
                            >
                                Browse all skills on skills.sh &rarr;
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
