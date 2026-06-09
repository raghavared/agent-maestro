import React from "react";

/* Run + Coordinate buttons — ported from panel-redesign 4/buttons.jsx.
   Styles live in redesign-buttons.css (pn-run2 / pn-spawn classes). */

/* play triangle that nudges on hover (run) */
function RunGlyph() {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M5 3.2l8 4.8-8 4.8z" fill="currentColor" />
        </svg>
    );
}

/* conductor → spawning parallel agents (coordinate); dots fan out on hover */
function CoordGlyph() {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="4" cy="8" r="2.1" fill="currentColor" />
            <path className="pn-spawn__line" d="M5.8 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <g className="pn-spawn__node pn-spawn__n1"><circle cx="12" cy="8" r="1.7" fill="currentColor" /></g>
            <g className="pn-spawn__node pn-spawn__n3"><circle cx="12" cy="8" r="1.7" fill="currentColor" /></g>
        </svg>
    );
}

export interface RunCoordButtonProps {
    kind: "run" | "coord";
    onClick: () => void;
    /** label content (e.g. "run" or "coordinate (3 tasks)") */
    children: React.ReactNode;
    /** mono sub-label baseline-aligned after the label; hidden in the compact variant */
    sub?: string;
    /** keyboard hint chip, e.g. "⌘↵" */
    kbd?: string;
    solid?: boolean;
    sm?: boolean;
    disabled?: boolean;
    title?: string;
    className?: string;
}

export function RunCoordButton({
    kind,
    onClick,
    children,
    sub,
    kbd,
    solid = false,
    sm = false,
    disabled = false,
    title,
    className,
}: RunCoordButtonProps) {
    const classes = [
        "pn-run2",
        kind === "run" ? "pn-run2--run" : "pn-run2--coord",
        solid ? "pn-run2--solid" : "",
        sm ? "pn-run2--sm" : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button type="button" className={classes} onClick={onClick} disabled={disabled} title={title}>
            <span className="pn-run2__chip">{kind === "run" ? <RunGlyph /> : <CoordGlyph />}</span>
            <span className="pn-run2__label">
                {children}
                {sub && !sm && <span className="pn-run2__sub">{sub}</span>}
            </span>
            {kbd && <span className="pn-run2__kbd">{kbd}</span>}
        </button>
    );
}
