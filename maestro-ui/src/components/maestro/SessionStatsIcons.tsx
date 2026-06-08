import React from "react";

/**
 * Self-contained icon set for SessionStatsView. The shared <Icon> component
 * doesn't carry the glyphs this dashboard needs (outcome marks, file types,
 * chat marks, etc.), so these Lucide-derived paths live here, stroke-matched
 * (1.8 / round) to the rest of the app's icon system.
 */

export type StatIconName =
  | "chevron-right"
  | "chevron-down"
  | "chevron-up"
  | "check"
  | "copy"
  | "play"
  | "terminal"
  | "rotate-ccw"
  | "quote"
  | "file-text"
  | "file-code"
  | "calendar"
  | "link"
  | "git-merge"
  | "cpu"
  | "bot"
  | "user"
  | "arrow-right"
  | "check-circle"
  | "x-circle"
  | "stop-circle"
  | "user-check"
  | "archive"
  | "loader"
  | "circle-dashed"
  | "ban"
  | "skip-forward"
  | "download"
  | "refresh"
  | "file-x";

interface StatIconProps {
  name: StatIconName;
  size?: number;
  color?: string;
  className?: string;
}

function paths(name: StatIconName): React.ReactNode {
  switch (name) {
    case "chevron-right":
      return <path d="m9 18 6-6-6-6" />;
    case "chevron-down":
      return <path d="m6 9 6 6 6-6" />;
    case "chevron-up":
      return <path d="m18 15-6-6-6 6" />;
    case "check":
      return <path d="M20 6 9 17l-5-5" />;
    case "copy":
      return (
        <>
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </>
      );
    case "terminal":
      return (
        <>
          <path d="m4 17 6-6-6-6" />
          <path d="M12 19h8" />
        </>
      );
    case "rotate-ccw":
      return (
        <>
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </>
      );
    case "quote":
      return (
        <>
          <path d="M7 6H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2c.5 2-.5 3.2-2 3.6" />
          <path d="M16 6h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2c.5 2-.5 3.2-2 3.6" transform="translate(5 0)" />
        </>
      );
    case "file-text":
      return (
        <>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v5h5" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </>
      );
    case "file-code":
      return (
        <>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v5h5" />
          <path d="m9 13-2 2 2 2" />
          <path d="m13 13 2 2-2 2" />
        </>
      );
    case "file-x":
      return (
        <>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v5h5" />
          <path d="m14.5 12.5-5 5" />
          <path d="m9.5 12.5 5 5" />
        </>
      );
    case "calendar":
      return (
        <>
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 2v4" />
          <path d="M16 2v4" />
        </>
      );
    case "link":
      return (
        <>
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </>
      );
    case "git-merge":
      return (
        <>
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <path d="M6 21V9a9 9 0 0 0 9 9" />
        </>
      );
    case "cpu":
      return (
        <>
          <rect width="16" height="16" x="4" y="4" rx="2" />
          <rect width="6" height="6" x="9" y="9" rx="1" />
          <path d="M15 2v2" />
          <path d="M15 20v2" />
          <path d="M2 15h2" />
          <path d="M2 9h2" />
          <path d="M20 15h2" />
          <path d="M20 9h2" />
          <path d="M9 2v2" />
          <path d="M9 20v2" />
        </>
      );
    case "bot":
      return (
        <>
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </>
      );
    case "user":
      return (
        <>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      );
    case "arrow-right":
      return (
        <>
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </>
      );
    case "check-circle":
      return (
        <>
          <path d="M21.801 10A10 10 0 1 1 17 3.335" />
          <path d="m9 11 3 3L22 4" />
        </>
      );
    case "x-circle":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </>
      );
    case "stop-circle":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <rect width="6" height="6" x="9" y="9" rx="1" />
        </>
      );
    case "user-check":
      return (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="m16 11 2 2 4-4" />
        </>
      );
    case "archive":
      return (
        <>
          <rect width="20" height="5" x="2" y="3" rx="1" />
          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
          <path d="M10 12h4" />
        </>
      );
    case "loader":
      return (
        <>
          <path d="M12 2v4" />
          <path d="m16.2 7.8 2.9-2.9" />
          <path d="M18 12h4" />
          <path d="m16.2 16.2 2.9 2.9" />
          <path d="M12 18v4" />
          <path d="m4.9 19.1 2.9-2.9" />
          <path d="M2 12h4" />
          <path d="m4.9 4.9 2.9 2.9" />
        </>
      );
    case "circle-dashed":
      return <circle cx="12" cy="12" r="9" strokeDasharray="3.5 3" />;
    case "ban":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="m4.9 4.9 14.2 14.2" />
        </>
      );
    case "skip-forward":
      return (
        <>
          <path d="M5 4 15 12 5 20Z" />
          <path d="M19 5v14" />
        </>
      );
    case "download":
      return (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
          <path d="M12 15V3" />
        </>
      );
    case "refresh":
      return (
        <>
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </>
      );
    case "play":
      return null; // handled below (filled)
    default:
      return null;
  }
}

export function StatIcon({ name, size = 16, color, className }: StatIconProps) {
  if (name === "play") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={color ?? "currentColor"}
        stroke="none"
        className={className}
        aria-hidden
        focusable={false}
      >
        <path d="M6 4.5v15a1 1 0 0 0 1.5.87l13-7.5a1 1 0 0 0 0-1.74l-13-7.5A1 1 0 0 0 6 4.5Z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable={false}
    >
      {paths(name)}
    </svg>
  );
}
