import React, { useState } from "react";
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
                <button
                    className="filterBar__toggle"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <span className="filterBar__toggleIcon">⚙</span>
                    <span className="filterBar__toggleLabel">Filters</span>
                    {activeFilterCount > 0 && (
                        <span className="filterBar__badge">{activeFilterCount}</span>
                    )}
                    <span className={`filterBar__arrow ${isExpanded ? "filterBar__arrow--open" : ""}`}>▾</span>
                </button>

                {activeFilterCount > 0 && !isExpanded && (
                    <div className="filterBar__activeSummary">
                        {statusFilter.map(s => {
                            const cfg = STATUS_CONFIG.find(c => c.value === s);
                            return cfg ? (
                                <span key={s} className={`filterChip filterChip--active ${cfg.colorClass}`}>
                                    <span className="filterChip__icon">{cfg.icon}</span>
                                    {cfg.label}
                                    <button className="filterChip__remove" onClick={(e) => { e.stopPropagation(); toggleStatus(s); }}>×</button>
                                </span>
                            ) : null;
                        })}
                        {priorityFilter.map(p => {
                            const cfg = PRIORITY_CONFIG.find(c => c.value === p);
                            return cfg ? (
                                <span key={p} className={`filterChip filterChip--active ${cfg.colorClass}`}>
                                    {cfg.label}
                                    <button className="filterChip__remove" onClick={(e) => { e.stopPropagation(); togglePriority(p); }}>×</button>
                                </span>
                            ) : null;
                        })}
                        {overdueFilter && (
                            <span className="filterChip filterChip--active filterChip--overdue">
                                <span className="filterChip__icon">⚠</span>
                                Overdue
                                <button className="filterChip__remove" onClick={(e) => { e.stopPropagation(); onOverdueFilterChange(false); }}>×</button>
                            </span>
                        )}
                        {sortBy !== "updatedAt" && (
                            <span className="filterChip filterChip--active filterChip--sort">
                                Sort: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                                <button className="filterChip__remove" onClick={(e) => { e.stopPropagation(); onSortChange("updatedAt"); }}>×</button>
                            </span>
                        )}
                        <button className="filterBar__clearAll" onClick={handleClearAll}>Clear all</button>
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="filterBar__panel">
                    <div className="filterGroup">
                        <span className="filterGroup__label">Status</span>
                        <div className="filterGroup__chips">
                            {STATUS_CONFIG.map(({ value, label, icon, colorClass }) => {
                                const isActive = statusFilter.includes(value);
                                return (
                                    <button
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
                                    <button
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
                                <button
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
                        <button className="filterBar__clearAll" onClick={handleClearAll}>
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
