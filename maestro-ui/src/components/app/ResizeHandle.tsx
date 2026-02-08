import React from "react";

type ResizeHandleProps = {
  orientation: "horizontal" | "vertical";
  label: string;
  min: number;
  max: number;
  current: number;
  onPointerDown: (e: React.PointerEvent) => void;
  className?: string;
  title?: string;
};

export function ResizeHandle({
  orientation,
  label,
  min,
  max,
  current,
  onPointerDown,
  className = "",
  title = "Drag to resize",
}: ResizeHandleProps) {
  return (
    <div
      className={className || (orientation === "vertical" ? "sidebarRightResizeHandle" : "sidebarResizeHandle")}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={current}
      tabIndex={0}
      onPointerDown={onPointerDown}
      title={title}
    />
  );
}
