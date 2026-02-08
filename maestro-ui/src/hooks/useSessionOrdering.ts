import { useState, useEffect, useMemo, useCallback } from "react";
import { TerminalSession } from "../app/types/session";
import * as DEFAULTS from "../app/constants/defaults";

interface UseSessionOrderingProps {
    sessions: TerminalSession[];
    activeProjectId: string;
}

export function useSessionOrdering({ sessions, activeProjectId }: UseSessionOrderingProps) {
    const [sessionOrderByProject, setSessionOrderByProject] = useState<Record<string, string[]>>(() => {
        try {
            const raw = localStorage.getItem(DEFAULTS.STORAGE_SESSION_ORDER_BY_PROJECT_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return {};
            const out: Record<string, string[]> = {};
            for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
                if (typeof k === "string" && Array.isArray(v) && v.every((id) => typeof id === "string")) {
                    out[k] = v;
                }
            }
            return out;
        } catch {
            return {};
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(DEFAULTS.STORAGE_SESSION_ORDER_BY_PROJECT_KEY, JSON.stringify(sessionOrderByProject));
        } catch {
            // Best-effort: localStorage may be unavailable
        }
    }, [sessionOrderByProject]);

    const sortedSessions = useMemo(() => {
        const filtered = sessions.filter((s) => s.projectId === activeProjectId);
        const order = sessionOrderByProject[activeProjectId] ?? [];

        if (order.length === 0) {
            // No custom order, use creation time (newest first)
            return filtered.sort((a, b) => b.createdAt - a.createdAt);
        }

        // Sort based on stored order, with unordered sessions at the top (newest first)
        return filtered.sort((a, b) => {
            const indexA = order.indexOf(a.persistId);
            const indexB = order.indexOf(b.persistId);

            // Both have order positions
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }

            // Only A has order position (A goes after unordered)
            if (indexA !== -1) return 1;

            // Only B has order position (B goes after unordered)
            if (indexB !== -1) return -1;

            // Neither has order position, sort by creation time (newest first)
            return b.createdAt - a.createdAt;
        });
    }, [sessions, activeProjectId, sessionOrderByProject]);

    const reorderSessions = useCallback((draggedPersistId: string, targetPersistId: string) => {
        if (!activeProjectId) return;

        const currentOrder = sessionOrderByProject[activeProjectId] ?? [];
        const projectSessionPersistIds = sortedSessions.map((s) => s.persistId);

        // Build new order array
        let newOrder: string[];
        if (currentOrder.length === 0) {
            // No existing order, create one from current sessions
            newOrder = [...projectSessionPersistIds];
        } else {
            // Use existing order, add missing sessions at the end
            const ordered = currentOrder.filter((id) => projectSessionPersistIds.includes(id));
            const missing = projectSessionPersistIds.filter((id) => !currentOrder.includes(id));
            newOrder = [...ordered, ...missing];
        }

        // Perform the reorder
        const draggedIndex = newOrder.indexOf(draggedPersistId);
        const targetIndex = newOrder.indexOf(targetPersistId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Remove dragged item and insert at target position
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedPersistId);

        // Update state
        setSessionOrderByProject((prev) => ({
            ...prev,
            [activeProjectId]: newOrder,
        }));
    }, [activeProjectId, sessionOrderByProject, sortedSessions]);

    return {
        sortedSessions,
        reorderSessions,
        sessionOrderByProject // Exporting just in case, though mostly internal
    };
}
