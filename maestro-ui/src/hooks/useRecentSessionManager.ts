import { useState, useEffect } from "react";
import * as DEFAULTS from "../app/constants/defaults";
import { RecentSessionKey } from "../app/types/app-state";

import { MaestroProject } from "../app/types/maestro";
import { TerminalSession } from "../app/types/session";

interface UseRecentSessionManagerProps {
    projects: MaestroProject[];
    active: TerminalSession | null;
    hydrated: boolean;
}

export function useRecentSessionManager({
    projects,
    active,
    hydrated,
}: UseRecentSessionManagerProps) {
    const [recentSessionKeys, setRecentSessionKeys] = useState<RecentSessionKey[]>(() => {
        try {
            const raw = localStorage.getItem(DEFAULTS.STORAGE_RECENT_SESSIONS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter(
                    (entry): entry is { projectId: string; persistId: string } =>
                        Boolean(entry) &&
                        typeof (entry as { projectId?: unknown }).projectId === "string" &&
                        typeof (entry as { persistId?: unknown }).persistId === "string",
                )
                .map((entry) => ({ projectId: entry.projectId, persistId: entry.persistId }))
                .slice(0, 50);
        } catch {
            return [];
        }
    });

    useEffect(() => {
        if (!hydrated) return;
        if (!active) return;

        const key: RecentSessionKey = { projectId: active.projectId, persistId: active.persistId };
        setRecentSessionKeys((prev) => {
            const head = prev[0] ?? null;
            if (head && head.projectId === key.projectId && head.persistId === key.persistId) return prev;
            const next = [
                key,
                ...prev.filter((s) => !(s.projectId === key.projectId && s.persistId === key.persistId)),
            ].slice(0, 50);
            try {
                localStorage.setItem(DEFAULTS.STORAGE_RECENT_SESSIONS_KEY, JSON.stringify(next));
            } catch {
                // Best-effort.
            }
            return next;
        });
    }, [active?.persistId, active?.projectId, hydrated]);

    useEffect(() => {
        if (!hydrated) return;
        const validProjects = new Set(projects.map((p) => p.id));
        setRecentSessionKeys((prev) => {
            const next = prev.filter((s) => validProjects.has(s.projectId));
            if (next.length === prev.length) return prev;
            try {
                localStorage.setItem(DEFAULTS.STORAGE_RECENT_SESSIONS_KEY, JSON.stringify(next));
            } catch {
                // Best-effort.
            }
            return next;
        });
    }, [hydrated, projects]);

    return recentSessionKeys;
}
