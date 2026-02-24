import { useCallback, useRef } from "react";
import * as DEFAULTS from "../app/constants/defaults";
import { useUIStore } from "../stores/useUIStore";

/**
 * Provides stable resize-start handlers for the maestro sidebar and right panel.
 *
 * Reads current widths from the store via getState() at drag-start (not via
 * reactive subscriptions) so the callbacks never recreate and App.tsx doesn't
 * re-render on every pixel change during a drag.
 */
export function useAppLayoutResizing() {

    const handleMaestroSidebarResizePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;
            event.preventDefault();

            const pointerId = event.pointerId;
            const target = event.currentTarget;
            const startX = event.clientX;
            // Read current width at drag-start — no reactive dep needed
            const startWidth = useUIStore.getState().maestroSidebarWidth;

            const clamp = (value: number) =>
                Math.min(DEFAULTS.MAX_MAESTRO_SIDEBAR_WIDTH, Math.max(DEFAULTS.MIN_MAESTRO_SIDEBAR_WIDTH, value));

            let current = startWidth;
            const prevCursor = document.body.style.cursor;
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";

            document.documentElement.classList.add("maestro-sidebar-resizing");

            try {
                target.setPointerCapture(pointerId);
            } catch {
                // ignore
            }

            const handlePointerMove = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
                current = clamp(startWidth + (e.clientX - startX));
                document.documentElement.style.setProperty("--maestro-sidebar-width-live", `${current}px`);
            };

            const handlePointerUp = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
                document.removeEventListener("pointermove", handlePointerMove);
                document.removeEventListener("pointerup", handlePointerUp);
                document.removeEventListener("pointercancel", handlePointerUp);

                document.body.style.cursor = prevCursor;
                document.body.style.userSelect = prevUserSelect;
                document.documentElement.classList.remove("maestro-sidebar-resizing");
                document.documentElement.style.removeProperty("--maestro-sidebar-width-live");

                try {
                    target.releasePointerCapture(pointerId);
                } catch {
                    // ignore
                }

                useUIStore.getState().setMaestroSidebarWidth(current);
                useUIStore.getState().persistMaestroSidebarWidth(current);
            };

            document.addEventListener("pointermove", handlePointerMove);
            document.addEventListener("pointerup", handlePointerUp);
            document.addEventListener("pointercancel", handlePointerUp);
        },
        [], // stable — no deps, reads from store at call time
    );

    const handleRightPanelResizePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;
            event.preventDefault();

            const pointerId = event.pointerId;
            const target = event.currentTarget;
            const startX = event.clientX;
            // Read current width at drag-start — no reactive dep needed
            const startWidth = useUIStore.getState().rightPanelWidth;

            const clamp = (value: number) =>
                Math.min(DEFAULTS.MAX_RIGHT_PANEL_WIDTH, Math.max(DEFAULTS.MIN_RIGHT_PANEL_WIDTH, value));

            let current = startWidth;
            const prevCursor = document.body.style.cursor;
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";

            document.documentElement.classList.add("right-panel-resizing");

            try {
                target.setPointerCapture(pointerId);
            } catch {
                // ignore
            }

            const handlePointerMove = (e: PointerEvent) => {
                if (e.pointerId !== pointerId) return;
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

                useUIStore.getState().setRightPanelWidth(current);
                useUIStore.getState().persistRightPanelWidth(current);
            };

            document.addEventListener("pointermove", handlePointerMove);
            document.addEventListener("pointerup", handlePointerUp);
            document.addEventListener("pointercancel", handlePointerUp);
        },
        [], // stable — no deps, reads from store at call time
    );

    return {
        handleMaestroSidebarResizePointerDown,
        handleRightPanelResizePointerDown,
    };
}
