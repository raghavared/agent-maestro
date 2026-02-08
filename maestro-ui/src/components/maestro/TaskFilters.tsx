import React from "react";
import { TaskStatus, TaskPriority } from "../../app/types/maestro";
import { Icon } from "../Icon";

type TaskFiltersProps = {
    statusFilter: TaskStatus[];
    priorityFilter: TaskPriority[];
    sortBy: "updatedAt" | "createdAt" | "priority";
    onStatusFilterChange: (statuses: TaskStatus[]) => void;
    onPriorityFilterChange: (priorities: TaskPriority[]) => void;
    onSortChange: (sort: "updatedAt" | "createdAt" | "priority") => void;
};

export function TaskFilters({
    statusFilter,
    priorityFilter,
    sortBy,
    onStatusFilterChange,
    onPriorityFilterChange,
    onSortChange,
}: TaskFiltersProps) {
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

    return (
        <div className="terminalFilters">
            <div className="terminalFilterSection">
                <span className="terminalFilterLabel">--filter-status=</span>
                <div className="terminalFilterButtons">
                    <button
                        className={`terminalFilterBtn ${statusFilter.length === 0 ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => onStatusFilterChange([])}
                    >
                        all
                    </button>
                    <button
                        className={`terminalFilterBtn ${statusFilter.includes("todo") ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => toggleStatus("todo")}
                    >
                        todo
                    </button>
                    <button
                        className={`terminalFilterBtn ${statusFilter.includes("in_progress") ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => toggleStatus("in_progress")}
                    >
                        run
                    </button>
                    <button
                        className={`terminalFilterBtn ${statusFilter.includes("completed") ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => toggleStatus("completed")}
                    >
                        ok
                    </button>
                    <button
                        className={`terminalFilterBtn ${statusFilter.includes("cancelled") ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => toggleStatus("cancelled")}
                    >
                        cancel
                    </button>
                    <button
                        className={`terminalFilterBtn ${statusFilter.includes("blocked") ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => toggleStatus("blocked")}
                    >
                        err
                    </button>
                </div>
            </div>

            <div className="terminalFilterSection">
                <span className="terminalFilterLabel">--priority=</span>
                <div className="terminalFilterButtons">
                    <button
                        className={`terminalFilterBtn ${priorityFilter.length === 0 ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => onPriorityFilterChange([])}
                    >
                        all
                    </button>
                    <button
                        className={`terminalFilterBtn ${priorityFilter.includes("high") ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => togglePriority("high")}
                    >
                        high
                    </button>
                    <button
                        className={`terminalFilterBtn ${priorityFilter.includes("medium") ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => togglePriority("medium")}
                    >
                        med
                    </button>
                    <button
                        className={`terminalFilterBtn ${priorityFilter.includes("low") ? "terminalFilterBtnActive" : ""}`}
                        onClick={() => togglePriority("low")}
                    >
                        low
                    </button>
                </div>
            </div>

            <div className="terminalFilterSection">
                <span className="terminalFilterLabel">--sort=</span>
                <select
                    className="terminalFilterSelect"
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
                >
                    <option value="updatedAt">updated</option>
                    <option value="createdAt">created</option>
                    <option value="priority">priority</option>
                </select>
            </div>
        </div>
    );
}
