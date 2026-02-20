import { create } from 'zustand';
import {
  StyleId,
  DEFAULT_STYLE_ID,
  STYLE_IDS,
  STYLE_THEMES,
  buildThemeId,
  parseThemeId,
  getColorVariant,
} from '../app/constants/themes';
import { STORAGE_THEME_KEY, STORAGE_STYLE_KEY } from '../app/constants/defaults';

interface ThemeState {
  styleId: StyleId;
  colorKey: string;
  setStyle: (id: StyleId) => void;
  setColor: (colorKey: string) => void;
  setStyleAndColor: (styleId: StyleId, colorKey: string) => void;
}

function readStyleFromStorage(): StyleId {
  try {
    const raw = localStorage.getItem(STORAGE_STYLE_KEY);
    if (raw && STYLE_IDS.includes(raw as StyleId)) {
      return raw as StyleId;
    }
    // Legacy migration: if old theme key exists, it's terminal style
    const legacyTheme = localStorage.getItem('agents-ui-theme-v1');
    if (legacyTheme) {
      return 'terminal';
    }
  } catch {
    // best-effort
  }
  return DEFAULT_STYLE_ID;
}

function readColorFromStorage(styleId: StyleId): string {
  try {
    const raw = localStorage.getItem(STORAGE_THEME_KEY);
    if (raw) {
      const parsed = parseThemeId(raw);
      // If the style matches, use the saved color
      if (parsed.styleId === styleId) {
        const variant = getColorVariant(styleId, parsed.colorKey);
        if (variant) return parsed.colorKey;
      }
      // Legacy: bare color key (e.g. "green") → terminal
      if (styleId === 'terminal' && !raw.includes('-')) {
        const variant = getColorVariant('terminal', raw);
        if (variant) return raw;
      }
    }
  } catch {
    // best-effort
  }
  return STYLE_THEMES[styleId].defaultColorKey;
}

function applyToDom(styleId: StyleId, colorKey: string): void {
  const el = document.documentElement;
  el.setAttribute('data-style', styleId);
  // Set per-color theme vars as a composite key for CSS
  el.setAttribute('data-theme', buildThemeId(styleId, colorKey));

  // Also apply color CSS vars directly so existing var(--theme-primary) etc. still work
  const variant = getColorVariant(styleId, colorKey);
  if (variant) {
    el.style.setProperty('--theme-primary', variant.colors.primary);
    el.style.setProperty('--theme-primary-dim', variant.colors.primaryDim);
    el.style.setProperty('--theme-primary-rgb', variant.colors.primaryRgb);
    el.style.setProperty('--theme-border', variant.colors.border);
    el.style.setProperty('--theme-text', variant.colors.text);
    el.style.setProperty('--theme-text-dim', variant.colors.textDim);
  }
}

function persistToStorage(styleId: StyleId, colorKey: string): void {
  try {
    localStorage.setItem(STORAGE_STYLE_KEY, styleId);
    localStorage.setItem(STORAGE_THEME_KEY, buildThemeId(styleId, colorKey));
  } catch {
    // best-effort
  }
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initStyle = readStyleFromStorage();
  const initColor = readColorFromStorage(initStyle);

  return {
    styleId: initStyle,
    colorKey: initColor,

    setStyle: (styleId: StyleId) => {
      // When switching styles, pick that style's default color
      const colorKey = STYLE_THEMES[styleId].defaultColorKey;
      set({ styleId, colorKey });
      applyToDom(styleId, colorKey);
      persistToStorage(styleId, colorKey);
    },

    setColor: (colorKey: string) => {
      const { styleId } = get();
      set({ colorKey });
      applyToDom(styleId, colorKey);
      persistToStorage(styleId, colorKey);
    },

    setStyleAndColor: (styleId: StyleId, colorKey: string) => {
      set({ styleId, colorKey });
      applyToDom(styleId, colorKey);
      persistToStorage(styleId, colorKey);
    },
  };
});

/**
 * Initialize the theme on app startup.
 * Reads from localStorage and applies to the DOM.
 */
export function initTheme(): void {
  const { styleId, colorKey } = useThemeStore.getState();
  applyToDom(styleId, colorKey);
}
