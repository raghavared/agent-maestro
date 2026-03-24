import React, { useState, useRef, useEffect } from "react";
import { TaskStatus, TaskPriority } from "../../app/types/maestro";

export type SortByOption = "updatedAt" | "createdAt" | "priority" | "dueDate" | "custom";

type TaskFiltersProps = {
    statusFilter: TaskStatus[];
    priorityFilter: TaskPriority[];
    sortBy: SortByOption;
    overdueFilter: boolean;
    onStatusFilterChange: (statuses: TaskStatus[]) => void;
    onPriorityFilterChange: (priorities: TaskPriority[]) => void;
    onSortChange: (sort: SortByOption) => void;
    onOverdueFilterChange: (overdue: boolean) => void;
};

const STATUS_CONFIG: { value: TaskStatus; label: string; icon: string; colorClass: string }[] = [
    { value: "todo", label: "Todo", icon: "○", colorClass: "filterChip--todo" },
    { value: "in_progress", label: "In Progress", icon: "◉", colorClass: "filterChip--inProgress" },
    { value: "in_review", label: "In Review", icon: "◎", colorClass: "filterChip--inReview" },
    { value: "completed", label: "Completed", icon: "✓", colorClass: "filterChip--completed" },
    { value: "blocked", label: "Blocked", icon: "⊘", colorClass: "filterChip--blocked" },
    { value: "cancelled", label: "Cancelled", icon: "✕", colorClass: "filterChip--cancelled" },
];

const PRIORITY_CONFIG: { value: TaskPriority; label: string; colorClass: string }[] = [
    { value: "high", label: "High", colorClass: "filterChip--high" },
    { value: "medium", label: "Medium", colorClass: "filterChip--medium" },
    { value: "low", label: "Low", colorClass: "filterChip--low" },
];

const SORT_OPTIONS: { value: SortByOption; label: string }[] = [
    { value: "custom", label: "Custom" },
    { value: "updatedAt", label: "Updated" },
    { value: "createdAt", label: "Created" },
    { value: "priority", label: "Priority" },
    { value: "dueDate", label: "Due Date" },
];

function InlineDropdown({
    label,
    children,
    isOpen,
    onToggle,
    onClose,
    hasActive,
}: {
    label: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    hasActive?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen, onClose]);

    return (
        <div className="filterInlineDropdown" ref={ref}>
            <button
                type="button"
                className={`filterInlineDropdown__trigger ${hasActive ? 'filterInlineDropdown__trigger--active' : ''}`}
                onClick={onToggle}
            >
                <span className="filterInlineDropdown__label">{label}</span>
                <span className={`filterInlineDropdown__caret ${isOpen ? 'filterInlineDropdown__caret--open' : ''}`}>▾</span>
            </button>
            {isOpen && (
                <div className="filterInlineDropdown__menu">
                    {children}
                </div>
            )}
        </div>
    );
}

export function TaskFilters({
    statusFilter,
    priorityFilter,
    sortBy,
    overdueFilter,
    onStatusFilterChange,
    onPriorityFilterChange,
    onSortChange,
    onOverdueFilterChange,
}: TaskFiltersProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const toggleStatus = (status: TaskStatus) => {
        if (statusFilter.includes(status)) {
            onStatusFilterChange(statusFilter.filter((s) => s !== status));
        } else {
            onStatusFilterChange([...statusFilter, status]);
        }
    };

    const togglePriority = (priority: TaskPriority) => {
        if (priorityFilter.includes(priority)) {
            onPriorityFilterChange(priorityFilter.filter((p) => p !== priority));
        } else {
            onPriorityFilterChange([...priorityFilter, priority]);
        }
    };

    const activeFilterCount = statusFilter.length + priorityFilter.length + (sortBy !== "updatedAt" ? 1 : 0) + (overdueFilter ? 1 : 0);

    const handleClearAll = () => {
        onStatusFilterChange([]);
        onPriorityFilterChange([]);
        onSortChange("updatedAt");
        onOverdueFilterChange(false);
    };

    return (
        <div className={`filterBar ${isExpanded ? "filterBar--expanded" : ""}`}>
            <div className="filterBar__header">
                <button type="button"
                    className="filterBar__toggle"
                    onClick={() => { setIsExpanded(!isExpanded); setOpenDropdown(null); }}
                    title={isExpanded ? "Collapse filters" : "Expand filters"}
                >
                    <svg className="filterBar__filterIcon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1.5 2h13M3.5 6h9M5.5 10h5M7 14h2" />
                    </svg>
                    {activeFilterCount > 0 && (
                        <span className="filterBar__badge">{activeFilterCount}</span>
                    )}
                    <span className={`filterBar__arrow ${isExpanded ? "filterBar__arrow--open" : ""}`}>▾</span>
                </button>

                {/* Collapsed: inline dropdowns */}
                {!isExpanded && (
                    <div className="filterBar__inlineControls">
                        <InlineDropdown
                            label="Status"
                            isOpen={openDropdown === "status"}
                            onToggle={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
                            onClose={() => setOpenDropdown(null)}
                            hasActive={statusFilter.length > 0}
                        >
                            {STATUS_CONFIG.map(({ value, label, icon, colorClass }) => {
                                const isActive = statusFilter.includes(value);
                                return (
                                    <button type="button"
                                        key={value}
                                        className={`filterInlineDropdown__item ${colorClass} ${isActive ? "filterInlineDropdown__item--active" : ""}`}
                                        onClick={() => toggleStatus(value)}
                                    >
                                        <span className="filterInlineDropdown__itemIcon">{icon}</span>
                                        <span className="filterInlineDropdown__itemLabel">{label}</span>
                                        {isActive && <span className="filterInlineDropdown__check">✓</span>}
                                    </button>
                                );
                            })}
                        </InlineDropdown>

                        <InlineDropdown
                            label="Priority"
                            isOpen={openDropdown === "priority"}
                            onToggle={() => setOpenDropdown(openDropdown === "priority" ? null : "priority")}
                            onClose={() => setOpenDropdown(null)}
                            hasActive={priorityFilter.length > 0}
                        >
                            {PRIORITY_CONFIG.map(({ value, label, colorClass }) => {
                                const isActive = priorityFilter.includes(value);
                                return (
                                    <button type="button"
                                        key={value}
                                        className={`filterInlineDropdown__item ${colorClass} ${isActive ? "filterInlineDropdown__item--active" : ""}`}
                                        onClick={() => togglePriority(value)}
                                    >
                                        <span className="filterInlineDropdown__itemDot" />
                                        <span className="filterInlineDropdown__itemLabel">{label}</span>
                                        {isActive && <span className="filterInlineDropdown__check">✓</span>}
                                    </button>
                                );
                            })}
                        </InlineDropdown>

                        <InlineDropdown
                            label="Sort"
                            isOpen={openDropdown === "sort"}
                            onToggle={() => setOpenDropdown(openDropdown === "sort" ? null : "sort")}
                            onClose={() => setOpenDropdown(null)}
                            hasActive={sortBy !== "updatedAt"}
                        >
                            {SORT_OPTIONS.map(({ value, label }) => (
                                <button type="button"
                                    key={value}
                                    className={`filterInlineDropdown__item ${sortBy === value ? "filterInlineDropdown__item--active" : ""}`}
                                    onClick={() => { onSortChange(value); setOpenDropdown(null); }}
                                >
                                    <span className="filterInlineDropdown__itemLabel">{label}</span>
                                    {sortBy === value && <span className="filterInlineDropdown__check">✓</span>}
                                </button>
                            ))}
                        </InlineDropdown>

                        <button
                            type="button"
                            className={`filterBar__overdueToggle ${overdueFilter ? 'filterBar__overdueToggle--active' : ''}`}
                            onClick={() => onOverdueFilterChange(!overdueFilter)}
                            title="Overdue tasks"
                        >
                            ⚠
                        </button>

                        {activeFilterCount > 0 && (
                            <button type="button" className="filterBar__clearAll" onClick={handleClearAll}>Clear</button>
                        )}
                    </div>
                )}
            </div>

            {/* Collapsed: selected filters row */}
            {!isExpanded && activeFilterCount > 0 && (
                <div className="filterBar__selectedRow">
                    {statusFilter.map(s => {
                        const cfg = STATUS_CONFIG.find(c => c.value === s);
                        return cfg ? (
                            <span key={s} className={`filterChip filterChip--active filterChip--sm ${cfg.colorClass}`}>
                                <span className="filterChip__icon">{cfg.icon}</span>
                                {cfg.label}
                                <button type="button" className="filterChip__remove" onClick={() => toggleStatus(s)}>×</button>
                            </span>
                        ) : null;
                    })}
                    {priorityFilter.map(p => {
                        const cfg = PRIORITY_CONFIG.find(c => c.value === p);
                        return cfg ? (
                            <span key={p} className={`filterChip filterChip--active filterChip--sm ${cfg.colorClass}`}>
                                <span className="filterChip__dot" />
                                {cfg.label}
                                <button type="button" className="filterChip__remove" onClick={() => togglePriority(p)}>×</button>
                            </span>
                        ) : null;
                    })}
                    {overdueFilter && (
                        <span className="filterChip filterChip--active filterChip--sm filterChip--overdue">
                            <span className="filterChip__icon">⚠</span>
                            Overdue
                            <button type="button" className="filterChip__remove" onClick={() => onOverdueFilterChange(false)}>×</button>
                        </span>
                    )}
                    {sortBy !== "updatedAt" && (
                        <span className="filterChip filterChip--active filterChip--sm filterChip--sort">
                            Sort: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                            <button type="button" className="filterChip__remove" onClick={() => onSortChange("updatedAt")}>×</button>
                        </span>
                    )}
                </div>
            )}

            {/* Expanded: full filter panel (unchanged) */}
            {isExpanded && (
                <div className="filterBar__panel">
                    <div className="filterGroup">
                        <span className="filterGroup__label">Status</span>
                        <div className="filterGroup__chips">
                            {STATUS_CONFIG.map(({ value, label, icon, colorClass }) => {
                                const isActive = statusFilter.includes(value);
                                return (
                                    <button type="button"
                                        key={value}
                                        className={`filterChip ${colorClass} ${isActive ? "filterChip--active" : ""}`}
                                        onClick={() => toggleStatus(value)}
                                    >
                                        <span className="filterChip__icon">{icon}</span>
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="filterGroup">
                        <span className="filterGroup__label">Priority</span>
                        <div className="filterGroup__chips">
                            {PRIORITY_CONFIG.map(({ value, label, colorClass }) => {
                                const isActive = priorityFilter.includes(value);
                                return (
                                    <button type="button"
                                        key={value}
                                        className={`filterChip ${colorClass} ${isActive ? "filterChip--active" : ""}`}
                                        onClick={() => togglePriority(value)}
                                    >
                                        <span className="filterChip__dot" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="filterGroup">
                        <span className="filterGroup__label">Due Date</span>
                        <div className="filterGroup__chips">
                            <button
                                className={`filterChip filterChip--overdue ${overdueFilter ? "filterChip--active" : ""}`}
                                onClick={() => onOverdueFilterChange(!overdueFilter)}
                            >
                                <span className="filterChip__icon">⚠</span>
                                Overdue
                            </button>
                        </div>
                    </div>

                    <div className="filterGroup">
                        <span className="filterGroup__label">Sort by</span>
                        <div className="filterGroup__segmented">
                            {SORT_OPTIONS.map(({ value, label }) => (
                                <button type="button"
                                    key={value}
                                    className={`filterSegment ${sortBy === value ? "filterSegment--active" : ""}`}
                                    onClick={() => onSortChange(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeFilterCount > 0 && (
                        <button type="button" className="filterBar__clearAll" onClick={handleClearAll}>
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
