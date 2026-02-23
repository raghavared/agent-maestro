import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProcessEffect } from "../processEffects";

const TerminalIcon: React.FC = () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
        <rect x="2" y="3" width="16" height="14" rx="2" />
        <path d="M6 9l3 2-3 2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 13h4" strokeLinecap="round" />
    </svg>
);

const WhiteboardIcon: React.FC = () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
        <path d="M3 17l3.5-3.5M6.5 13.5l-2-2L14 2l2 2L6.5 13.5z" strokeLinejoin="round" />
        <path d="M12 4l2 2" strokeLinecap="round" />
    </svg>
);

const DocumentIcon: React.FC = () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
        <path d="M5 2h7l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" />
        <path d="M12 2v4h4" />
        <path d="M7 10h6M7 13h4" strokeLinecap="round" />
    </svg>
);

type NewSpaceDropdownProps = {
    onOpenNewSession?: () => void;
    onOpenWhiteboard?: () => void;
    agentShortcuts?: ProcessEffect[];
    onQuickStart?: (effect: ProcessEffect) => void;
    /** "rail" = icon button (48px rail), "toolbar" = small action button (expanded panel toolbar) */
    variant?: "rail" | "toolbar";
};

export const NewSpaceDropdown: React.FC<NewSpaceDropdownProps> = ({
    onOpenNewSession,
    onOpenWhiteboard,
    agentShortcuts,
    onQuickStart,
    variant = "rail",
}) => {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const toggle = useCallback(() => setOpen((p) => !p), []);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const pick = useCallback((action: () => void) => {
        setOpen(false);
        action();
    }, []);

    // Compute fixed position from button rect
    const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
    useEffect(() => {
        if (!open || !btnRef.current) { setPos(null); return; }
        const rect = btnRef.current.getBoundingClientRect();
        setPos({
            top: rect.top,
            right: window.innerWidth - rect.left + 4,
        });
    }, [open]);

    const menu = open && pos ? createPortal(
        <div
            ref={menuRef}
            className="spacesRailDropdown"
            style={{ position: "fixed", top: pos.top, right: pos.right }}
        >
            {onOpenNewSession && (
                <button className="spacesRailDropdownItem" onClick={() => pick(onOpenNewSession)} type="button">
                    <TerminalIcon />
                    <span>Terminal</span>
                </button>
            )}
            {onOpenWhiteboard && (
                <button className="spacesRailDropdownItem" onClick={() => pick(onOpenWhiteboard)} type="button">
                    <WhiteboardIcon />
                    <span>Draw</span>
                </button>
            )}
            <button
                className="spacesRailDropdownItem"
                onClick={() => pick(() => { /* Document — Phase 2 */ })}
                type="button"
                disabled
            >
                <DocumentIcon />
                <span>Document</span>
            </button>
            {agentShortcuts?.map((effect) => (
                <button
                    key={effect.id}
                    className="spacesRailDropdownItem"
                    onClick={() => pick(() => onQuickStart?.(effect))}
                    type="button"
                >
                    {effect.iconSrc ? (
                        <img
                            src={effect.iconSrc}
                            alt={effect.label}
                            className="spacesRailDropdownIcon"
                            width="16"
                            height="16"
                        />
                    ) : (
                        <TerminalIcon />
                    )}
                    <span>{effect.label.charAt(0).toUpperCase() + effect.label.slice(1)}</span>
                </button>
            ))}
        </div>,
        document.body,
    ) : null;

    const plusSvg = (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width={variant === "toolbar" ? 14 : 18} height={variant === "toolbar" ? 14 : 18}>
            <line x1="8" y1="3" x2="8" y2="13" strokeLinecap="round" />
            <line x1="3" y1="8" x2="13" y2="8" strokeLinecap="round" />
        </svg>
    );

    return (
        <>
            <button
                ref={btnRef}
                className={variant === "toolbar" ? "spacesPanelAction" : "iconRailButton"}
                onClick={toggle}
                title="New Space"
                type="button"
            >
                {plusSvg}
            </button>
            {menu}
        </>
    );
};
