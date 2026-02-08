import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import * as DEFAULTS from "../app/constants/defaults";
import { MaestroProject } from "../app/types/maestro";

interface UseAppLayoutResizingProps {
    sidebarRef: React.RefObject<HTMLElement>;
    projects: MaestroProject[];
    sidebarWidth: number;
    setSidebarWidth: (width: number) => void;
    persistSidebarWidth: (width: number) => void;
    rightPanelWidth: number;
    setRightPanelWidth: (width: number) => void;
    persistRightPanelWidth: (width: number) => void;
    projectsListHeightMode: "auto" | "manual";
    setProjectsListHeightMode: (mode: "auto" | "manual") => void;
    projectsListMaxHeight: number;
    setProjectsListMaxHeight: (height: number | ((prev: number) => number)) => void;
}

export function useAppLayoutResizing({
    sidebarRef,
    projects,
    sidebarWidth,
    setSidebarWidth,
    persistSidebarWidth,
    rightPanelWidth,
    setRightPanelWidth,
    persistRightPanelWidth,
    projectsListHeightMode,
    setProjectsListHeightMode,
    projectsListMaxHeight,
    setProjectsListMaxHeight,
}: UseAppLayoutResizingProps) {
    const projectsListResizingRef = useRef(false);
    const projectsListSyncRafRef = useRef<number | null>(null);

    const persistProjectsListMaxHeight = useCallback((value: number) => {
        setProjectsListHeightMode("manual");
        try {
            localStorage.setItem(
                DEFAULTS.STORAGE_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT_KEY,
                String(Math.round(value)),
            );
        } catch {
            // Best-effort: localStorage may be unavailable in some contexts.
        }
    }, [setProjectsListHeightMode]);

    const clearPersistedProjectsListMaxHeight = useCallback(() => {
        try {
            localStorage.removeItem(DEFAULTS.STORAGE_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT_KEY);
        } catch {
            // Best-effort: localStorage may be unavailable in some contexts.
        }
    }, []);

    const computeProjectsListMaxHeightLimit = useCallback(() => {
        const sidebar = sidebarRef.current;
        const projectList = sidebar?.querySelector<HTMLElement>(".projectList");
        if (!sidebar || !projectList) return DEFAULTS.MAX_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT;
        const sidebarRect = sidebar.getBoundingClientRect();
        const listRect = projectList.getBoundingClientRect();
        const available = sidebarRect.bottom - listRect.top - DEFAULTS.SIDEBAR_RESIZE_BOTTOM_MIN_PX;
        return Math.min(
            DEFAULTS.MAX_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT,
            Math.max(DEFAULTS.MIN_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT, Math.floor(available)),
        );
    }, [sidebarRef]);

    const computeProjectsListAutoHeight = useCallback((): number => {
        const sidebar = sidebarRef.current;
        const projectList = sidebar?.querySelector<HTMLElement>(".projectList");
        if (!sidebar || !projectList) return DEFAULTS.DEFAULT_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT;

        const items: HTMLElement[] = Array.from(projectList.querySelectorAll<HTMLElement>(".projectItem"));
        const visibleCount = Math.min(items.length, DEFAULTS.SIDEBAR_PROJECTS_LIST_AUTO_MAX_VISIBLE);
        if (!visibleCount) return 0;

        const style = getComputedStyle(projectList);
        const gap = Number.parseFloat(style.rowGap || style.gap || "0") || 0;

        let height = 0;
        for (let i = 0; i < visibleCount; i++) {
            height += items[i].getBoundingClientRect().height;
        }
        height += gap * Math.max(0, visibleCount - 1);
        return height;
    }, [sidebarRef]);

    const syncProjectsListHeight = useCallback(
        (modeOverride?: "auto" | "manual") => {
            if (projectsListResizingRef.current) return;

            const max = computeProjectsListMaxHeightLimit();
            const clamp = (value: number) =>
                Math.min(max, Math.max(DEFAULTS.MIN_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT, value));

            const mode = modeOverride ?? projectsListHeightMode;
            if (mode === "auto") {
                setProjectsListMaxHeight(clamp(computeProjectsListAutoHeight()));
                return;
            }

            setProjectsListMaxHeight((prev) => {
                const clamped = clamp(prev);
                if (clamped !== prev) persistProjectsListMaxHeight(clamped);
                return clamped;
            });
        },
        [
            computeProjectsListAutoHeight,
            computeProjectsListMaxHeightLimit,
            persistProjectsListMaxHeight,
            projectsListHeightMode,
            setProjectsListMaxHeight
        ],
    );

    const scheduleProjectsListHeightSync = useCallback(
        (modeOverride?: "auto" | "manual") => {
            if (projectsListSyncRafRef.current != null) {
                cancelAnimationFrame(projectsListSyncRafRef.current);
            }

            projectsListSyncRafRef.current = requestAnimationFrame(() => {
                projectsListSyncRafRef.current = null;
                syncProjectsListHeight(modeOverride);
            });
        },
        [syncProjectsListHeight],
    );

    useLayoutEffect(() => {
        syncProjectsListHeight();
    }, [projects.length, projectsListHeightMode, syncProjectsListHeight]);

    const handleWindowResize = useCallback(() => {
        scheduleProjectsListHeightSync();
    }, [scheduleProjectsListHeightSync]);

    useEffect(() => {
        window.addEventListener("resize", handleWindowResize);
        return () => window.removeEventListener("resize", handleWindowResize);
    }, [handleWindowResize]);

    useEffect(() => {
        return () => {
            if (projectsListSyncRafRef.current != null) {
                cancelAnimationFrame(projectsListSyncRafRef.current);
            }
        };
    }, []);

    const resetProjectsListMaxHeight = useCallback(() => {
        setProjectsListHeightMode("auto");
        clearPersistedProjectsListMaxHeight();
        scheduleProjectsListHeightSync("auto");
    }, [clearPersistedProjectsListMaxHeight, scheduleProjectsListHeightSync, setProjectsListHeightMode]);

    const handleProjectsDividerKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            const step = event.shiftKey ? 60 : 20;
            const max = computeProjectsListMaxHeightLimit();
            const clamp = (value: number) =>
                Math.min(max, Math.max(DEFAULTS.MIN_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT, value));

            if (event.key === "ArrowDown") {
                event.preventDefault();
                setProjectsListMaxHeight((prev) => {
                    const next = clamp(prev + step);
                    persistProjectsListMaxHeight(next);
                    return next;
                });
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                setProjectsListMaxHeight((prev) => {
                    const next = clamp(prev - step);
                    persistProjectsListMaxHeight(next);
                    return next;
                });
                return;
            }

            if (event.key === "Home") {
                event.preventDefault();
                setProjectsListMaxHeight(DEFAULTS.MIN_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT);
                persistProjectsListMaxHeight(DEFAULTS.MIN_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT);
                return;
            }

            if (event.key === "End") {
                event.preventDefault();
                setProjectsListMaxHeight(max);
                persistProjectsListMaxHeight(max);
            }
        },
        [computeProjectsListMaxHeightLimit, persistProjectsListMaxHeight, setProjectsListMaxHeight],
    );

    const handleSidebarResizePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;
            event.preventDefault();

            const pointerId = event.pointerId;
            const target = event.currentTarget;
            const startX = event.clientX;
            const startWidth = sidebarWidth;

            const clamp = (value: number) => Math.min(DEFAULTS.MAX_SIDEBAR_WIDTH, Math.max(DEFAULTS.MIN_SIDEBAR_WIDTH, value));

            let current = startWidth;
            const prevCursor = document.body.style.cursor;
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";

            // Add resizing class for CSS optimizations (will-change, pointer-events)
            document.documentElement.classList.add("sidebar-resizing");

            try {
                target.setPointerCapture(pointerId);
            } catch {
                // ignore
            }

            // Use CSS variable for smooth drag - bypasses React re-renders
            const handlePointerMove = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
                current = clamp(startWidth + (e.clientX - startX));
                document.documentElement.style.setProperty("--sidebar-width-live", `${current}px`);
            };

            const handlePointerUp = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
                document.removeEventListener("pointermove", handlePointerMove);
                document.removeEventListener("pointerup", handlePointerUp);
                document.removeEventListener("pointercancel", handlePointerUp);

                document.body.style.cursor = prevCursor;
                document.body.style.userSelect = prevUserSelect;
                document.documentElement.classList.remove("sidebar-resizing");
                document.documentElement.style.removeProperty("--sidebar-width-live");

                try {
                    target.releasePointerCapture(pointerId);
                } catch {
                    // ignore
                }

                // Sync final value to React state
                setSidebarWidth(current);
                persistSidebarWidth(current);
            };

            document.addEventListener("pointermove", handlePointerMove);
            document.addEventListener("pointerup", handlePointerUp);
            document.addEventListener("pointercancel", handlePointerUp);
        },
        [sidebarWidth, persistSidebarWidth, setSidebarWidth],
    );

    const handleRightPanelResizePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;
            event.preventDefault();

            const pointerId = event.pointerId;
            const target = event.currentTarget;
            const startX = event.clientX;
            const startWidth = rightPanelWidth;

            const clamp = (value: number) =>
                Math.min(DEFAULTS.MAX_RIGHT_PANEL_WIDTH, Math.max(DEFAULTS.MIN_RIGHT_PANEL_WIDTH, value));

            let current = startWidth;
            const prevCursor = document.body.style.cursor;
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";

            // Add resizing class for CSS optimizations (will-change, pointer-events)
            document.documentElement.classList.add("right-panel-resizing");

            try {
                target.setPointerCapture(pointerId);
            } catch {
                // ignore
            }

            // Use CSS variable for smooth drag - bypasses React re-renders
            const handlePointerMove = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
                // Dragging left increases width (since panel is on right)
                current = clamp(startWidth + (startX - e.clientX));
                document.documentElement.style.setProperty("--right-panel-width-live", `${current}px`);
            };

            const handlePointerUp = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
                document.removeEventListener("pointermove", handlePointerMove);
                document.removeEventListener("pointerup", handlePointerUp);
                document.removeEventListener("pointercancel", handlePointerUp);

                document.body.style.cursor = prevCursor;
                document.body.style.userSelect = prevUserSelect;
                document.documentElement.classList.remove("right-panel-resizing");
                document.documentElement.style.removeProperty("--right-panel-width-live");

                try {
                    target.releasePointerCapture(pointerId);
                } catch {
                    // ignore
                }

                // Sync final value to React state
                setRightPanelWidth(current);
                persistRightPanelWidth(current);
            };

            document.addEventListener("pointermove", handlePointerMove);
            document.addEventListener("pointerup", handlePointerUp);
            document.addEventListener("pointercancel", handlePointerUp);
        },
        [rightPanelWidth, persistRightPanelWidth, setRightPanelWidth],
    );

    const handleProjectsDividerPointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;
            event.preventDefault();

            projectsListResizingRef.current = true;
            if (projectsListSyncRafRef.current != null) {
                cancelAnimationFrame(projectsListSyncRafRef.current);
                projectsListSyncRafRef.current = null;
            }

            const pointerId = event.pointerId;
            const target = event.currentTarget;
            const startY = event.clientY;
            const startHeight = projectsListMaxHeight;
            const maxHeight = computeProjectsListMaxHeightLimit();

            const clamp = (value: number) =>
                Math.min(maxHeight, Math.max(DEFAULTS.MIN_SIDEBAR_PROJECTS_LIST_MAX_HEIGHT, value));

            let current = startHeight;
            const prevCursor = document.body.style.cursor;
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";

            try {
                target.setPointerCapture(pointerId);
            } catch {
                // ignore
            }

            const handlePointerMove = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
                current = clamp(startHeight + (e.clientY - startY));
                setProjectsListMaxHeight(current);
            };

            const handlePointerUp = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
                document.removeEventListener("pointermove", handlePointerMove);
                document.removeEventListener("pointerup", handlePointerUp);
                document.removeEventListener("pointercancel", handlePointerUp);
                projectsListResizingRef.current = false;
                document.body.style.cursor = prevCursor;
                document.body.style.userSelect = prevUserSelect;
                persistProjectsListMaxHeight(current);
                try {
                    target.releasePointerCapture(pointerId);
                } catch {
                    // ignore
                }
            };

            document.addEventListener("pointermove", handlePointerMove);
            document.addEventListener("pointerup", handlePointerUp);
            document.addEventListener("pointercancel", handlePointerUp);
        },
        [
            computeProjectsListMaxHeightLimit,
            persistProjectsListMaxHeight,
            projectsListMaxHeight,
            setProjectsListMaxHeight,
        ],
    );

    return {
        resetProjectsListMaxHeight,
        handleProjectsDividerKeyDown,
        handleSidebarResizePointerDown,
        handleRightPanelResizePointerDown,
        handleProjectsDividerPointerDown,
    };
}
