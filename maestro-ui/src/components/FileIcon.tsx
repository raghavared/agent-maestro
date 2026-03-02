import React from "react";

type FileIconProps = {
  name: string;
  isDir: boolean;
  isExpanded?: boolean;
  size?: number;
};

// IntelliJ-style color mapping for file extensions
const EXT_COLORS: Record<string, string> = {
  // TypeScript / JavaScript
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f0db4f",
  jsx: "#f0db4f",
  mjs: "#f0db4f",
  cjs: "#f0db4f",

  // Web
  html: "#e34c26",
  htm: "#e34c26",
  css: "#563d7c",
  scss: "#cd6799",
  sass: "#cd6799",
  less: "#1d365d",
  vue: "#41b883",
  svelte: "#ff3e00",

  // Data / Config
  json: "#a8b34b",
  yaml: "#cb171e",
  yml: "#cb171e",
  toml: "#9c4121",
  xml: "#e37933",
  csv: "#48a56a",
  env: "#ecd53f",

  // Languages
  py: "#3572a5",
  rb: "#cc342d",
  rs: "#dea584",
  go: "#00add8",
  java: "#b07219",
  kt: "#a97bff",
  swift: "#f05138",
  c: "#555555",
  h: "#555555",
  cpp: "#f34b7d",
  hpp: "#f34b7d",
  cs: "#178600",
  php: "#4f5d95",
  lua: "#000080",
  zig: "#f7a41d",
  ex: "#6e4a7e",
  exs: "#6e4a7e",

  // Shell / Scripts
  sh: "#89e051",
  bash: "#89e051",
  zsh: "#89e051",
  fish: "#89e051",
  ps1: "#012456",
  bat: "#c1f12e",

  // Markup / Docs
  md: "#519aba",
  mdx: "#519aba",
  txt: "#8a8a8a",
  rst: "#141414",
  tex: "#3d6117",
  adoc: "#e40046",

  // Config files
  lock: "#6b7a8a",
  gitignore: "#f05032",
  dockerignore: "#2496ed",
  editorconfig: "#e0efef",
  eslintrc: "#4b32c3",
  prettierrc: "#56b3b4",

  // Images
  png: "#a074c4",
  jpg: "#a074c4",
  jpeg: "#a074c4",
  gif: "#a074c4",
  svg: "#ffb13b",
  ico: "#a074c4",
  webp: "#a074c4",
  bmp: "#a074c4",

  // Build / Package
  dockerfile: "#2496ed",
  makefile: "#427819",
  cmake: "#064f8c",
  gradle: "#02303a",

  // Misc
  sql: "#e38c00",
  graphql: "#e10098",
  gql: "#e10098",
  proto: "#4285f4",
  wasm: "#654ff0",
  log: "#6b7a8a",
};

// Special filenames that map to specific colors
const FILENAME_COLORS: Record<string, string> = {
  "package.json": "#cb3837",
  "tsconfig.json": "#3178c6",
  "vite.config.ts": "#646cff",
  "vite.config.js": "#646cff",
  "webpack.config.js": "#8dd6f9",
  "rollup.config.js": "#ef3335",
  ".gitignore": "#f05032",
  ".env": "#ecd53f",
  ".env.local": "#ecd53f",
  ".env.development": "#ecd53f",
  ".env.production": "#ecd53f",
  "dockerfile": "#2496ed",
  "docker-compose.yml": "#2496ed",
  "docker-compose.yaml": "#2496ed",
  "cargo.toml": "#dea584",
  "cargo.lock": "#dea584",
  "go.mod": "#00add8",
  "go.sum": "#00add8",
  "makefile": "#427819",
  "license": "#d4b25e",
  "readme.md": "#519aba",
};

function getExtension(name: string): string {
  const lower = name.toLowerCase();
  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx < 0 || dotIdx === lower.length - 1) return "";
  return lower.slice(dotIdx + 1);
}

function getFileColor(name: string): string {
  const lower = name.toLowerCase();
  // Check special filenames first
  const filenameColor = FILENAME_COLORS[lower];
  if (filenameColor) return filenameColor;

  // Check extension
  const ext = getExtension(name);
  if (ext && EXT_COLORS[ext]) return EXT_COLORS[ext];

  // Default file color
  return "#8a8f98";
}

// Folder colors - subtle tinted
const FOLDER_COLOR = "#8a9bae";
const FOLDER_OPEN_COLOR = "#a0b4c8";

export const FileIcon = React.memo(function FileIcon({
  name,
  isDir,
  isExpanded = false,
  size = 16,
}: FileIconProps) {
  if (isDir) {
    // IntelliJ-style folder icon
    const color = isExpanded ? FOLDER_OPEN_COLOR : FOLDER_COLOR;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        focusable={false}
      >
        {isExpanded ? (
          // Open folder
          <>
            <path
              d="M1.5 3C1.5 2.44772 1.94772 2 2.5 2H6.29289L7.79289 3.5H13.5C14.0523 3.5 14.5 3.94772 14.5 4.5V5.5H3.5L1.5 12.5V3Z"
              fill={color}
              opacity="0.5"
            />
            <path
              d="M2.5 5.5H14.5L12.5 13H0.5L2.5 5.5Z"
              fill={color}
              opacity="0.85"
            />
          </>
        ) : (
          // Closed folder
          <path
            d="M1.5 3C1.5 2.44772 1.94772 2 2.5 2H6.29289L7.79289 3.5H13.5C14.0523 3.5 14.5 3.94772 14.5 4.5V12C14.5 12.5523 14.0523 13 13.5 13H2.5C1.94772 13 1.5 12.5523 1.5 12V3Z"
            fill={color}
            opacity="0.75"
          />
        )}
      </svg>
    );
  }

  // File icon with colored indicator based on extension
  const color = getFileColor(name);
  const ext = getExtension(name);
  const label = ext.slice(0, 3).toUpperCase();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable={false}
    >
      {/* File body */}
      <path
        d="M3 1.5C3 1.22386 3.22386 1 3.5 1H9.5L13 4.5V14.5C13 14.7761 12.7761 15 12.5 15H3.5C3.22386 15 3 14.7761 3 14.5V1.5Z"
        fill={color}
        opacity="0.18"
      />
      {/* File outline */}
      <path
        d="M3.5 1H9.5L13 4.5V14.5C13 14.7761 12.7761 15 12.5 15H3.5C3.22386 15 3 14.7761 3 14.5V1.5C3 1.22386 3.22386 1 3.5 1Z"
        stroke={color}
        strokeWidth="0.75"
        opacity="0.55"
      />
      {/* Dog-ear fold */}
      <path
        d="M9.5 1V4C9.5 4.27614 9.72386 4.5 10 4.5H13"
        stroke={color}
        strokeWidth="0.75"
        opacity="0.45"
      />
      {/* Extension label text */}
      {label && (
        <text
          x="8"
          y="11.5"
          textAnchor="middle"
          fontSize={label.length > 2 ? "4" : "4.5"}
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill={color}
          opacity="0.85"
        >
          {label}
        </text>
      )}
    </svg>
  );
});
