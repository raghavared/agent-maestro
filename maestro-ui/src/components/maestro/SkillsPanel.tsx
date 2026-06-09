import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ClaudeCodeSkill, MaestroProject } from "../../app/types/maestro";
import { Icon } from "./redesign/kit";
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
                (typeof skill.description === 'string' && skill.description.toLowerCase().includes(q)) ||
                (Array.isArray(skill.triggers) && skill.triggers.some(t => typeof t === 'string' && t.toLowerCase().includes(q))) ||
                (Array.isArray(skill.tags) && skill.tags.some(t => typeof t === 'string' && t.toLowerCase().includes(q)))
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
                className="pn-skill"
                data-expanded={isExpanded}
                onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
            >
                <div className="pn-skill__hd">
                    <span className="pn-skill__ic"><Icon name="sparkles" /></span>
                    <div className="pn-skill__body">
                        <div className="pn-skill__namerow">
                            <span className="pn-skill__name">{skill.name}</span>
                            <span className="pn-skill__badges">
                                {skill.skillSource && (
                                    <span className="pn-sbadge pn-sbadge--src">
                                        {skill.skillSource === 'claude' ? '.claude' : '.agents'}
                                    </span>
                                )}
                                {skill.version && (
                                    <span className="pn-sbadge pn-sbadge--ver">
                                        v{skill.version}
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="pn-skill__desc">
                            {typeof skill.description === 'string' ? skill.description : 'No description'}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="pn-skill__exp">
                        {Array.isArray(skill.triggers) && skill.triggers.length > 0 && (
                            <div className="pn-skill__row">
                                <span className="pn-skill__rowlabel">triggers</span>
                                <span className="pn-skill__rowval">{skill.triggers.filter(t => typeof t === 'string').join(', ')}</span>
                            </div>
                        )}
                        {Array.isArray(skill.tags) && skill.tags.length > 0 && (
                            <div className="pn-skill__row">
                                <span className="pn-skill__rowlabel">tags</span>
                                <span className="pn-skill__rowval">
                                    <span className="pn-skill__tags">
                                        {skill.tags.filter((t): t is string => typeof t === 'string').map(tag => (
                                            <span key={tag} className="pn-skill__tag">{tag}</span>
                                        ))}
                                    </span>
                                </span>
                            </div>
                        )}
                        {skill.role && (
                            <div className="pn-skill__row">
                                <span className="pn-skill__rowlabel">role</span>
                                <span className="pn-skill__rowval">{skill.role}</span>
                            </div>
                        )}
                        {skill.language && (
                            <div className="pn-skill__row">
                                <span className="pn-skill__rowlabel">language</span>
                                <span className="pn-skill__rowval">{skill.language}</span>
                            </div>
                        )}
                        {skill.framework && (
                            <div className="pn-skill__row">
                                <span className="pn-skill__rowlabel">framework</span>
                                <span className="pn-skill__rowval">{skill.framework}</span>
                            </div>
                        )}
                        {skill.hasReferences && (
                            <div className="pn-skill__row">
                                <span className="pn-skill__rowlabel">references</span>
                                <span className="pn-skill__rowval">{skill.referenceCount} file{skill.referenceCount !== 1 ? 's' : ''}</span>
                            </div>
                        )}
                        {skill.skillPath && (
                            <div className="pn-skill__row">
                                <span className="pn-skill__rowlabel">path</span>
                                <span className="pn-skill__rowval pn-skill__path">{skill.skillPath}</span>
                            </div>
                        )}
                        {skill.content && (
                            <div className="pn-skill__row">
                                <span className="pn-skill__rowlabel">content</span>
                                <pre className="pn-skill__rowval" style={{ fontFamily: 'var(--pn-mono)', fontSize: '10.5px', color: 'var(--pn-ink-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
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

    const renderSection = (title: string, sectionKey: string, sectionSkills: ClaudeCodeSkill[], icon: 'folder' | 'globe') => {
        const isCollapsed = collapsedSections.has(sectionKey);
        return (
            <React.Fragment key={sectionKey}>
                <div className="pn-vsec" onClick={() => toggleSection(sectionKey)}>
                    <span className="pn-eyebrow">
                        <Icon name={icon} size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />
                        {title} · {sectionSkills.length}
                    </span>
                    <span className="pn-line"></span>
                </div>
                {!isCollapsed && (
                    sectionSkills.length === 0
                        ? <div className="pn-skill__desc" style={{ padding: '0 12px 9px' }}>No {title.toLowerCase()} skills found</div>
                        : sectionSkills.map(renderSkillCard)
                )}
            </React.Fragment>
        );
    };

    if (loading) {
        return (
            <div className="pn-vframe pn-vframe--tall" style={{ width: '100%', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, fontFamily: 'var(--pn-mono)', fontSize: 12, color: 'var(--pn-ink-3)' }}>
                    <span className="skillsPanelSpinner">&#x27F3;</span> Loading skills...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="pn-vframe pn-vframe--tall" style={{ width: '100%', height: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 4, fontFamily: 'var(--pn-mono)', fontSize: 12, color: 'var(--pn-ink-3)' }}>
                    <div>Error: {error}</div>
                    <button type="button" onClick={loadSkills} className="pn-btn" style={{ marginTop: '8px' }}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pn-vframe pn-vframe--tall" style={{ width: '100%', height: '100%' }}>
            {/* Header: title + view toggle + refresh */}
            <div className="pn-vhd">
                <Icon name="sparkles" size={16} style={{ color: 'var(--pn-ink-3)' }} />
                <span className="pn-vhd__title">Skills</span>
                <span className="pn-vhd__sp"></span>
                <div className="pn-vtoggle">
                    <button type="button"
                        className={view === 'installed' ? 'on' : ''}
                        onClick={() => setView('installed')}
                    >
                        Installed <span className="n">{skills.length}</span>
                    </button>
                    <button type="button"
                        className={view === 'marketplace' ? 'on' : ''}
                        onClick={() => setView('marketplace')}
                    >
                        Marketplace
                    </button>
                </div>
                <button type="button"
                    className="pn-ib"
                    onClick={loadSkills}
                    title="Refresh skills"
                >
                    <Icon name="refresh" />
                </button>
            </div>

            {/* Search bar */}
            <div className="pn-vsearch">
                <Icon name="search" />
                <input
                    type="text"
                    placeholder={view === 'installed' ? "Filter skills" : "Search skills.sh"}
                    value={view === 'installed' ? searchQuery : marketplaceQuery}
                    onChange={(e) => view === 'installed' ? setSearchQuery(e.target.value) : setMarketplaceQuery(e.target.value)}
                />
                {(view === 'installed' ? searchQuery : marketplaceQuery) && (
                    <button type="button"
                        className="pn-vsearch__clear"
                        onClick={() => view === 'installed' ? setSearchQuery("") : setMarketplaceQuery("")}
                        style={{ border: 'none', background: 'transparent', color: 'var(--pn-ink-4)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}
                    >
                        &times;
                    </button>
                )}
            </div>

            {/* Installed view */}
            {view === 'installed' && (
                <div className="pn-vscroll" style={{ paddingTop: 6 }}>
                    {skills.length === 0 ? (
                        <pre style={{ fontFamily: 'var(--pn-mono)', fontSize: 11, color: 'var(--pn-ink-3)', padding: '0 14px', whiteSpace: 'pre-wrap' }}>{`
  No skills found.

  Skills are loaded from:
  ~/.claude/skills/     (global, Claude Code)
  ~/.agents/skills/     (global, universal)
  .claude/skills/       (project-level)
  .agents/skills/       (project-level)

  Each skill is a directory with a SKILL.md file.
  Browse the Marketplace tab to install skills.
                        `}</pre>
                    ) : (
                        <>
                            {projectSkills.length > 0 && renderSection('Project', 'project', projectSkills, 'folder')}
                            {renderSection('Global', 'global', globalSkills, 'globe')}
                        </>
                    )}
                </div>
            )}

            {/* Marketplace view */}
            {view === 'marketplace' && (
                <div className="pn-vscroll" style={{ padding: '14px 12px' }}>
                    <div style={{ fontFamily: 'var(--pn-serif)', fontSize: 17, color: 'var(--pn-ink)', marginBottom: 4 }}>skills.sh</div>
                    <div style={{ fontSize: 12, color: 'var(--pn-ink-3)', marginBottom: 14 }}>
                        The open agent-skills ecosystem. Works with Claude Code, Codex, Gemini &amp; more.
                    </div>

                    <div style={{ fontSize: 11.5, color: 'var(--pn-ink-3)', lineHeight: 1.5, marginBottom: 14 }}>
                        <p style={{ margin: '0 0 6px' }}>Browse and install community skills from <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pn-brand)' }}>skills.sh</a></p>
                        <p style={{ margin: 0 }}>Skills work with Claude Code, Cursor, Codex, GitHub Copilot, and 18+ other tools.</p>
                    </div>

                    <div style={{ background: 'var(--pn-card)', border: '1px solid var(--pn-line)', borderRadius: 'var(--pn-r-md)', padding: 12, marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pn-ink-2)', marginBottom: 8 }}>Install a skill:</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <code style={{ fontFamily: 'var(--pn-mono)', fontSize: 11, color: 'var(--pn-brand-2)', whiteSpace: 'nowrap' }}>npx skillsadd</code>
                            <input
                                type="text"
                                placeholder="owner/repo"
                                style={{ flex: 1, minWidth: 0, border: '1px solid var(--pn-line)', borderRadius: 'var(--pn-r-sm)', background: 'var(--pn-surface)', padding: '5px 8px', fontFamily: 'var(--pn-mono)', fontSize: 11, color: 'var(--pn-ink)', outline: 'none' }}
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
                        <div style={{ fontSize: 10.5, color: 'var(--pn-ink-4)', marginTop: 6 }}>
                            Press Enter to view on skills.sh, or run the command in your terminal
                        </div>
                    </div>

                    <div className="pn-vsec" style={{ padding: '0 0 6px' }} onClick={() => toggleSection('popular')}>
                        <span className="pn-eyebrow">Popular Skills</span>
                        <span className="pn-line"></span>
                    </div>
                    {!collapsedSections.has('popular') && (
                        [
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
                                className="pn-skill"
                                style={{ display: 'block', textDecoration: 'none' }}
                            >
                                <div className="pn-skill__hd">
                                    <span className="pn-skill__ic"><Icon name="sparkles" /></span>
                                    <div className="pn-skill__body">
                                        <div className="pn-skill__namerow">
                                            <span className="pn-skill__name">{item.name}</span>
                                        </div>
                                        <div className="pn-skill__desc">{item.desc}</div>
                                        <div className="pn-skill__path" style={{ marginTop: 4 }}>{item.repo}</div>
                                    </div>
                                </div>
                            </a>
                        ))
                    )}

                    <div style={{ marginTop: 16 }}>
                        <a
                            href="https://skills.sh"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pn-btn"
                            style={{ textDecoration: 'none' }}
                        >
                            Browse all skills on skills.sh &rarr;
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
