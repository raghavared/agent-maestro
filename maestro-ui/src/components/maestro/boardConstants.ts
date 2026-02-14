import { TaskStatus, TaskPriority, TaskSessionStatus } from "../../app/types/maestro";

export const COLUMNS: { status: TaskStatus; label: string; symbol: string }[] = [
    { status: "todo", label: "BACKLOG", symbol: "○" },
    { status: "blocked", label: "BLOCKED", symbol: "✗" },
    { status: "in_progress", label: "IN PROGRESS", symbol: "◉" },
    { status: "in_review", label: "REVIEW", symbol: "◎" },
    { status: "completed", label: "DONE", symbol: "✓" },
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
    high: "#ff6464",
    medium: "#ffb000",
    low: "rgba(var(--theme-primary-rgb), 0.3)",
};

export const TASK_SESSION_STATUS_SYMBOL: Record<TaskSessionStatus, string> = {
    queued: "○",
    working: "◉",
    blocked: "✗",
    completed: "✓",
    failed: "✗",
    skipped: "⊘",
};

export const TASK_SESSION_STATUS_COLOR: Record<TaskSessionStatus, string> = {
    queued: "rgba(var(--theme-primary-rgb), 0.4)",
    working: "#00d9ff",
    blocked: "#ef4444",
    completed: "var(--theme-primary)",
    failed: "#ef4444",
    skipped: "rgba(var(--theme-primary-rgb), 0.3)",
};

export function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}
