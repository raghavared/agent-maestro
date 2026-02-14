import { useState, useCallback, useRef } from "react";

export type DragState = {
    /** The ID of the task being dragged */
    taskId: string;
    /** Current mouse X position */
    x: number;
    /** Current mouse Y position */
    y: number;
    /** Offset from the top-left corner of the card to the grab point */
    offsetX: number;
    offsetY: number;
    /** Width/height of the original card for sizing the ghost */
    width: number;
    height: number;
};

/**
 * Custom hook for smooth pointer-based drag and drop on the task board.
 * Replaces native HTML5 drag API for a better UX where the card follows the cursor.
 *
 * The hook handles the full lifecycle:
 *  1. pointerdown on a card captures initial position
 *  2. After moving 4px, drag officially starts (ghost appears)
 *  3. pointermove updates ghost position + highlights target column
 *  4. pointerup fires the drop callback
 *  5. Escape cancels the drag
 */
export function useBoardDrag(
    onDropCallback: (taskId: string, targetStatus: string) => void,
) {
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    // Keep drop callback in a ref so the effect doesn't re-attach listeners
    const onDropRef = useRef(onDropCallback);
    onDropRef.current = onDropCallback;

    // Map of column status -> DOM element for hit-testing
    const columnRefs = useRef<Map<string, HTMLElement>>(new Map());

    const registerColumn = useCallback((status: string, el: HTMLElement | null) => {
        if (el) {
            columnRefs.current.set(status, el);
        } else {
            columnRefs.current.delete(status);
        }
    }, []);

    // Detect which column the pointer is over
    const getColumnAtPoint = useCallback((x: number, y: number): string | null => {
        for (const [status, el] of columnRefs.current) {
            const rect = el.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return status;
            }
        }
        return null;
    }, []);

    /**
     * Attach to each draggable card's onPointerDown.
     * Captures the card rect immediately (before React nullifies the event),
     * then sets up move/up listeners with a 4px threshold.
     */
    const onCardPointerDown = useCallback((e: React.PointerEvent, taskId: string) => {
        // Only primary button
        if (e.button !== 0) return;
        // Don't drag from buttons inside the card
        if ((e.target as HTMLElement).closest("button")) return;

        // Capture card geometry NOW while e.currentTarget is valid
        const card = e.currentTarget as HTMLElement;
        const rect = card.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const offsetX = startX - rect.left;
        const offsetY = startY - rect.top;
        const width = rect.width;
        const height = rect.height;

        let started = false;

        const onMove = (me: PointerEvent) => {
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;

            if (!started && Math.abs(dx) + Math.abs(dy) > 4) {
                // Threshold crossed — start the drag
                started = true;
                document.body.classList.add("dragging-active");
                setDragState({
                    taskId,
                    x: me.clientX,
                    y: me.clientY,
                    offsetX,
                    offsetY,
                    width,
                    height,
                });
            }

            if (started) {
                setDragState((prev) => {
                    if (!prev) return prev;
                    return { ...prev, x: me.clientX, y: me.clientY };
                });
                const col = getColumnAtPoint(me.clientX, me.clientY);
                setDragOverColumn(col);
            }
        };

        const onUp = (ue: PointerEvent) => {
            cleanup();
            if (started) {
                const col = getColumnAtPoint(ue.clientX, ue.clientY);
                if (col) {
                    onDropRef.current(taskId, col);
                }
                setDragState(null);
                setDragOverColumn(null);
                document.body.classList.remove("dragging-active");
            }
        };

        const onKeyDown = (ke: KeyboardEvent) => {
            if (ke.key === "Escape") {
                cleanup();
                setDragState(null);
                setDragOverColumn(null);
                document.body.classList.remove("dragging-active");
            }
        };

        const cleanup = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("keydown", onKeyDown);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("keydown", onKeyDown);
    }, [getColumnAtPoint]);

    return {
        dragState,
        dragOverColumn,
        onCardPointerDown,
        registerColumn,
    };
}
