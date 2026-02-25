import { RefObject, useCallback, useLayoutEffect, useState } from "react";

type Placement = "above" | "below";

type Position = {
    top?: number;
    bottom?: number;
    left: number;
};

export function useDropdownPosition(
    btnRef: RefObject<HTMLElement | null>,
    isOpen: boolean,
    placement: Placement = "above"
): Position | null {
    const [pos, setPos] = useState<Position | null>(null);

    const compute = useCallback(() => {
        const btn = btnRef.current;
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        if (placement === "above") {
            return { bottom: window.innerHeight - rect.top + 4, left: rect.left };
        }
        return { top: rect.bottom + 4, left: rect.left };
    }, [btnRef, placement]);

    useLayoutEffect(() => {
        if (isOpen) {
            setPos(compute());
        }
    }, [isOpen, compute]);

    return isOpen ? pos : null;
}
