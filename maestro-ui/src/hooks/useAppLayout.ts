import { useState, useCallback } from "react";
import * as DEFAULTS from "../app/constants/defaults";

export function useAppLayout() {
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        try {
            const raw = localStorage.getItem(DEFAULTS.STORAGE_SIDEBAR_WIDTH_KEY);
            const parsed = raw != null ? Number(raw) : NaN;
            if (Number.isFinite(parsed)) {
                return Math.min(DEFAULTS.MAX_SIDEBAR_WIDTH, Math.max(DEFAULTS.MIN_SIDEBAR_WIDTH, parsed));
            }
        } catch {
            // Best-effort
        }
        return DEFAULTS.DEFAULT_SIDEBAR_WIDTH;
    });

    const persistSidebarWidth = useCallback((value: number) => {
        try {
            localStorage.setItem(DEFAULTS.STORAGE_SIDEBAR_WIDTH_KEY, String(value));
        } catch {
            // Best-effort
        }
    }, []);

    const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
        try {
            const raw = localStorage.getItem(DEFAULTS.STORAGE_RIGHT_PANEL_WIDTH_KEY);
            const parsed = raw != null ? Number(raw) : NaN;
            if (Number.isFinite(parsed)) {
                return Math.min(DEFAULTS.MAX_RIGHT_PANEL_WIDTH, Math.max(DEFAULTS.MIN_RIGHT_PANEL_WIDTH, parsed));
            }
        } catch {
            // Best-effort
        }
        return DEFAULTS.DEFAULT_RIGHT_PANEL_WIDTH;
    });

    const persistRightPanelWidth = useCallback((value: number) => {
        try {
            localStorage.setItem(DEFAULTS.STORAGE_RIGHT_PANEL_WIDTH_KEY, String(value));
        } catch {
            // Best-effort
        }
    }, []);

    const [activeRightPanel, setActiveRightPanel] = useState<"none" | "maestro" | "files">("none");

    const [projectsListHeightMode, setProjectsListHeightMode] = useState<"auto" | "manual">(() => {
        try {
            const raw = localStorage.getItem(DEFAULTS.STORAGE_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT_KEY);
            const parsed = raw != null ? Number(raw) : NaN;
            return Number.isFinite(parsed) ? "manual" : "auto";
        } catch {
            // Best-effort: localStorage may be unavailable in some contexts.
            return "auto";
        }
    });

    const [projectsListMaxHeight, setProjectsListMaxHeight] = useState<number>(() => {
        try {
            const raw = localStorage.getItem(DEFAULTS.STORAGE_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT_KEY);
            const parsed = raw != null ? Number(raw) : NaN;
            if (Number.isFinite(parsed)) {
                return Math.min(
                    DEFAULTS.MAX_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT,
                    Math.max(DEFAULTS.MIN_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT, parsed),
                );
            }
        } catch {
            // Best-effort: localStorage may be unavailable in some contexts.
        }
        return DEFAULTS.DEFAULT_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT;
    });

    return {
        sidebarWidth,
        setSidebarWidth,
        persistSidebarWidth,
        rightPanelWidth,
        setRightPanelWidth,
        persistRightPanelWidth,
        activeRightPanel,
        setActiveRightPanel,
        projectsListHeightMode,
        setProjectsListHeightMode,
        projectsListMaxHeight,
        setProjectsListMaxHeight,
    };
}
