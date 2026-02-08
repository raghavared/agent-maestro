import { create } from 'zustand';
import { ThemeId, DEFAULT_THEME_ID, THEME_IDS } from '../app/constants/themes';
import { STORAGE_THEME_KEY } from '../app/constants/defaults';

interface ThemeState {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

function readThemeFromStorage(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_THEME_KEY);
    if (raw && THEME_IDS.includes(raw as ThemeId)) {
      return raw as ThemeId;
    }
  } catch {
    // best-effort
  }
  return DEFAULT_THEME_ID;
}

function applyThemeToDom(themeId: ThemeId): void {
  document.documentElement.setAttribute('data-theme', themeId);
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: readThemeFromStorage(),

  setThemeId: (id: ThemeId) => {
    set({ themeId: id });
    applyThemeToDom(id);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, id);
    } catch {
      // best-effort
    }
  },
}));

/**
 * Initialize the theme on app startup.
 * Reads from localStorage and applies to the DOM.
 */
export function initTheme(): void {
  const themeId = useThemeStore.getState().themeId;
  applyThemeToDom(themeId);
}
