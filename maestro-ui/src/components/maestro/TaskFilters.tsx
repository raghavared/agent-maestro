import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { TaskStatus, TaskPriority } from "../../app/types/maestro";
import { Icon } from "./redesign/kit";

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

/* Portal dropdown in the redesign pn-pop / pn-opt idiom (matches the task-tile
   badge dropdowns). Positioned fixed under its trigger; pn-pop-ov backdrop
   dismisses on outside click. */
function FilterPop({
    open,
    anchorRef,
    onClose,
    children,
}: {
    open: boolean;
    anchorRef: React.RefObject<HTMLElement>;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    useLayoutEffect(() => {
        if (open && anchorRef.current) {
            const r = anchorRef.current.getBoundingClientRect();
            setPos({ left: r.left, top: r.bottom + 5 });
        } else {
            setPos(null);
        }
    }, [open, anchorRef]);

    if (!open || !pos) return null;

    return createPortal(
        <>
            <div className="pn-pop-ov" onClick={onClose} />
            <div className="pn-pop" style={{ left: pos.left, top: pos.top }}>
                {children}
            </div>
        </>,
        document.body
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

    const statusRef = useRef<HTMLButtonElement>(null);
    const priorityRef = useRef<HTMLButtonElement>(null);
    const sortRef = useRef<HTMLButtonElement>(null);

    // Close any open dropdown on scroll/resize so the fixed-position pop never drifts.
    useEffect(() => {
        if (!openDropdown) return;
        const close = () => setOpenDropdown(null);
        window.addEventListener("resize", close);
        window.addEventListener("scroll", close, true);
        return () => {
            window.removeEventListener("resize", close);
            window.removeEventListener("scroll", close, true);
        };
    }, [openDropdown]);

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
    const noFilters = activeFilterCount === 0;

    const handleClearAll = () => {
        onStatusFilterChange([]);
        onPriorityFilterChange([]);
        onSortChange("updatedAt");
        onOverdueFilterChange(false);
    };

    const toggle = (key: string) => setOpenDropdown((cur) => (cur === key ? null : key));

    return (
        <>
            <div className="pn-filters">
                {/* Quick pills */}
                <button
                    type="button"
                    className={`pn-filter ${noFilters ? "pn-filter--active" : ""}`}
                    onClick={handleClearAll}
                    title="All tasks (clear filters)"
                >
                    All
                </button>
                <button
                    type="button"
                    className={`pn-filter ${priorityFilter.includes("high") ? "pn-filter--active" : ""}`}
                    onClick={() => togglePriority("high")}
                >
                    High
                </button>
                <button
                    type="button"
                    className={`pn-filter ${overdueFilter ? "pn-filter--active" : ""}`}
                    onClick={() => onOverdueFilterChange(!overdueFilter)}
                >
                    Overdue
                </button>

                {/* Status multi-select (preserved IA, pn-pop dropdown) */}
                <button
                    type="button"
                    ref={statusRef}
                    className={`pn-filter ${statusFilter.length > 0 ? "pn-filter--active" : ""}`}
                    onClick={() => toggle("status")}
                >
                    Status{statusFilter.length > 0 ? ` · ${statusFilter.length}` : ""}
                    <Icon name="chevronD" size={12} />
                </button>
                <FilterPop open={openDropdown === "status"} anchorRef={statusRef} onClose={() => setOpenDropdown(null)}>
                    {STATUS_CONFIG.map(({ value, label, icon }) => {
                        const isActive = statusFilter.includes(value);
                        return (
                            <button
                                type="button"
                                key={value}
                                className={`pn-opt ${isActive ? "pn-opt--cur" : ""}`}
                                onClick={() => toggleStatus(value)}
                            >
                                <span aria-hidden="true">{icon}</span>
                                <span>{label}</span>
                                {isActive && <Icon name="check" size={13} sw={2} className="pn-opt__chk" />}
                            </button>
                        );
                    })}
                </FilterPop>

                {/* Priority multi-select (preserved IA, pn-pop dropdown) */}
                <button
                    type="button"
                    ref={priorityRef}
                    className={`pn-filter ${priorityFilter.length > 0 ? "pn-filter--active" : ""}`}
                    onClick={() => toggle("priority")}
                >
                    Priority{priorityFilter.length > 0 ? ` · ${priorityFilter.length}` : ""}
                    <Icon name="chevronD" size={12} />
                </button>
                <FilterPop open={openDropdown === "priority"} anchorRef={priorityRef} onClose={() => setOpenDropdown(null)}>
                    {PRIORITY_CONFIG.map(({ value, label }) => {
                        const isActive = priorityFilter.includes(value);
                        return (
                            <button
                                type="button"
                                key={value}
                                className={`pn-opt ${isActive ? "pn-opt--cur" : ""}`}
                                onClick={() => togglePriority(value)}
                            >
                                <span>{label}</span>
                                {isActive && <Icon name="check" size={13} sw={2} className="pn-opt__chk" />}
                            </button>
                        );
                    })}
                </FilterPop>

                {/* Sort (pushed right) */}
                <button
                    type="button"
                    ref={sortRef}
                    className={`pn-filter ${sortBy !== "updatedAt" ? "pn-filter--active" : ""}`}
                    style={{ marginLeft: "auto" }}
                    onClick={() => toggle("sort")}
                >
                    <Icon name="sliders" size={13} /> Sort
                </button>
                <FilterPop open={openDropdown === "sort"} anchorRef={sortRef} onClose={() => setOpenDropdown(null)}>
                    {SORT_OPTIONS.map(({ value, label }) => (
                        <button
                            type="button"
                            key={value}
                            className={`pn-opt ${sortBy === value ? "pn-opt--cur" : ""}`}
                            onClick={() => { onSortChange(value); setOpenDropdown(null); }}
                        >
                            <span>{label}</span>
                            {sortBy === value && <Icon name="check" size={13} sw={2} className="pn-opt__chk" />}
                        </button>
                    ))}
                </FilterPop>

                {/* Expanded full-panel toggle (preserved surface) */}
                <button
                    type="button"
                    className={`pn-filter ${isExpanded ? "pn-filter--active" : ""}`}
                    onClick={() => { setIsExpanded(!isExpanded); setOpenDropdown(null); }}
                    title={isExpanded ? "Collapse filters" : "Expand filters"}
                >
                    <Icon name="filter" size={13} />
                    {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
                </button>
            </div>

            {/* Expanded full filter panel — preserved structure + handlers, restyled to pn idiom */}
            {isExpanded && (
                <div className="pn-filters" style={{ flexDirection: "column", alignItems: "stretch", gap: 10, paddingTop: 0 }}>
                    <div>
                        <span className="pn-eyebrow">Status</span>
                        <div className="pn-filters" style={{ padding: "6px 0 0" }}>
                            {STATUS_CONFIG.map(({ value, label, icon }) => {
                                const isActive = statusFilter.includes(value);
                                return (
                                    <button
                                        type="button"
                                        key={value}
                                        className={`pn-filter ${isActive ? "pn-filter--active" : ""}`}
                                        onClick={() => toggleStatus(value)}
                                    >
                                        <span aria-hidden="true">{icon}</span> {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <span className="pn-eyebrow">Priority</span>
                        <div className="pn-filters" style={{ padding: "6px 0 0" }}>
                            {PRIORITY_CONFIG.map(({ value, label }) => {
                                const isActive = priorityFilter.includes(value);
                                return (
                                    <button
                                        type="button"
                                        key={value}
                                        className={`pn-filter ${isActive ? "pn-filter--active" : ""}`}
                                        onClick={() => togglePriority(value)}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <span className="pn-eyebrow">Due Date</span>
                        <div className="pn-filters" style={{ padding: "6px 0 0" }}>
                            <button
                                type="button"
                                className={`pn-filter ${overdueFilter ? "pn-filter--active" : ""}`}
                                onClick={() => onOverdueFilterChange(!overdueFilter)}
                            >
                                Overdue
                            </button>
                        </div>
                    </div>

                    <div>
                        <span className="pn-eyebrow">Sort by</span>
                        <div className="pn-filters" style={{ padding: "6px 0 0" }}>
                            {SORT_OPTIONS.map(({ value, label }) => (
                                <button
                                    type="button"
                                    key={value}
                                    className={`pn-filter ${sortBy === value ? "pn-filter--active" : ""}`}
                                    onClick={() => onSortChange(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeFilterCount > 0 && (
                        <button type="button" className="pn-filter" style={{ alignSelf: "flex-start" }} onClick={handleClearAll}>
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
