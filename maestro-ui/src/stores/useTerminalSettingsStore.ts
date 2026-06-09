import { create } from 'zustand';

/**
 * User-configurable terminal appearance (font family + size), persisted to
 * localStorage and applied live to every open xterm instance. The terminal
 * stays dark in both themes; this only controls glyph font + size.
 */

const STORAGE_TERMINAL_FONT_KEY = 'agents-ui-terminal-font-id-v1';
const STORAGE_TERMINAL_FONT_SIZE_KEY = 'agents-ui-terminal-font-size-v1';

export interface TerminalFontPreset {
  id: string;
  label: string;
  /** Full CSS font-family stack passed to xterm's `fontFamily` option. */
  stack: string;
}

export const TERMINAL_FONT_PRESETS: TerminalFontPreset[] = [
  {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    stack:
      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  {
    id: 'system',
    label: 'System Mono (SF Mono)',
    stack:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  { id: 'menlo', label: 'Menlo', stack: 'Menlo, Monaco, "Courier New", monospace' },
  { id: 'monaco', label: 'Monaco', stack: 'Monaco, Menlo, "Courier New", monospace' },
  { id: 'courier', label: 'Courier', stack: '"Courier New", Courier, monospace' },
];

export const DEFAULT_TERMINAL_FONT_ID = 'jetbrains';
export const DEFAULT_TERMINAL_FONT_SIZE = 13;
export const TERMINAL_FONT_SIZE_MIN = 9;
export const TERMINAL_FONT_SIZE_MAX = 22;

export function terminalFontStack(id: string): string {
  return (
    TERMINAL_FONT_PRESETS.find((p) => p.id === id) ?? TERMINAL_FONT_PRESETS[0]
  ).stack;
}

function readFontId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_TERMINAL_FONT_KEY);
    if (raw && TERMINAL_FONT_PRESETS.some((p) => p.id === raw)) return raw;
  } catch {
    // best-effort
  }
  return DEFAULT_TERMINAL_FONT_ID;
}

function readFontSize(): number {
  try {
    const raw = localStorage.getItem(STORAGE_TERMINAL_FONT_SIZE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= TERMINAL_FONT_SIZE_MIN && n <= TERMINAL_FONT_SIZE_MAX) {
      return n;
    }
  } catch {
    // best-effort
  }
  return DEFAULT_TERMINAL_FONT_SIZE;
}

interface TerminalSettingsState {
  fontId: string;
  fontSize: number;
  /** Derived from fontId — the stack to hand xterm. */
  fontStack: string;
  setFontId: (id: string) => void;
  setFontSize: (size: number) => void;
  reset: () => void;
}

export const useTerminalSettingsStore = create<TerminalSettingsState>((set) => ({
  fontId: readFontId(),
  fontSize: readFontSize(),
  fontStack: terminalFontStack(readFontId()),

  setFontId: (id: string) => {
    set({ fontId: id, fontStack: terminalFontStack(id) });
    try {
      localStorage.setItem(STORAGE_TERMINAL_FONT_KEY, id);
    } catch {
      // best-effort
    }
  },

  setFontSize: (size: number) => {
    const clamped = Math.min(
      TERMINAL_FONT_SIZE_MAX,
      Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(size)),
    );
    set({ fontSize: clamped });
    try {
      localStorage.setItem(STORAGE_TERMINAL_FONT_SIZE_KEY, String(clamped));
    } catch {
      // best-effort
    }
  },

  reset: () => {
    set({
      fontId: DEFAULT_TERMINAL_FONT_ID,
      fontStack: terminalFontStack(DEFAULT_TERMINAL_FONT_ID),
      fontSize: DEFAULT_TERMINAL_FONT_SIZE,
    });
    try {
      localStorage.setItem(STORAGE_TERMINAL_FONT_KEY, DEFAULT_TERMINAL_FONT_ID);
      localStorage.setItem(STORAGE_TERMINAL_FONT_SIZE_KEY, String(DEFAULT_TERMINAL_FONT_SIZE));
    } catch {
      // best-effort
    }
  },
}));
