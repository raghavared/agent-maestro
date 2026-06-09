/* useRedesignTheme.ts — redesign theme + flag mechanism.

   Mirrors panel-redesign/shell.jsx TopBar toggle:
     document.documentElement.dataset.theme = dark ? 'dark' : ''
   and guarantees  <html data-redesign>  is present while the redesign is active
   so the scoped tokens in redesign-tokens.css apply.

   This module only EXPORTS the mechanism — it does NOT auto-wire any live chrome.
   The TopBar worker consumes useRedesignTheme() to render the Moon/Sun toggle. */

import { useCallback, useEffect, useState } from "react";

const root = (): HTMLElement => document.documentElement;

/** localStorage key for the light/dark axis (owned exclusively by this module). */
const THEME_STORAGE_KEY = "maestro-redesign-theme-v1";

/** Read the persisted light/dark choice, or null if none/unavailable. */
function getPersistedTheme(): RedesignTheme | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "dark" ? "dark" : raw === "light" ? "light" : null;
  } catch {
    return null;
  }
}

/** Persist the light/dark choice (best-effort). */
function persistTheme(theme: RedesignTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* best-effort */
  }
}

/** Imperatively mark the redesign as active (sets <html data-redesign>). */
export function setRedesignActive(active: boolean): void {
  if (active) root().setAttribute("data-redesign", "");
  else root().removeAttribute("data-redesign");
}

/** Read whether the redesign flag is currently present on <html>. */
export function isRedesignActive(): boolean {
  return root().hasAttribute("data-redesign");
}

export type RedesignTheme = "light" | "dark";

/** Imperatively set the theme: 'dark' -> data-theme="dark", 'light' -> cleared. */
export function setRedesignTheme(theme: RedesignTheme): void {
  root().dataset.theme = theme === "dark" ? "dark" : "";
}

/** Read the current theme from <html data-theme>. */
export function getRedesignTheme(): RedesignTheme {
  return root().dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Apply the persisted light/dark choice at app startup (call once, e.g. alongside
 * the legacy initTheme()). Runs app-wide regardless of whether the TopBar toggle is
 * mounted yet (e.g. the empty-state screen with no projects). Defaults to light when
 * nothing is persisted. This is what makes a user's dark choice survive reload.
 */
export function initRedesignTheme(): void {
  setRedesignTheme(getPersistedTheme() ?? "light");
}

export interface UseRedesignThemeResult {
  /** Current theme. */
  theme: RedesignTheme;
  /** True when theme === 'dark'. */
  isDark: boolean;
  /** Flip between light and dark (mirrors shell.jsx TopBar toggle). */
  toggle: () => void;
  /** Set the theme explicitly. */
  setTheme: (theme: RedesignTheme) => void;
}

export interface UseRedesignThemeOptions {
  /**
   * Ensure <html data-redesign> is set on mount (default true). On this branch
   * the redesign is default-on; pass false to leave the flag untouched.
   */
  ensureRedesign?: boolean;
  /** Initial theme to apply on mount. Defaults to the current <html data-theme>. */
  initialTheme?: RedesignTheme;
}

/**
 * React hook wrapping the redesign theme toggle. Keeps local state in sync with
 * the <html data-theme> attribute and guarantees data-redesign while active.
 */
export function useRedesignTheme(options: UseRedesignThemeOptions = {}): UseRedesignThemeResult {
  const { ensureRedesign = true, initialTheme } = options;
  // Prefer the explicit prop, then the persisted choice, then whatever is on <html>.
  const [theme, setThemeState] = useState<RedesignTheme>(
    () => initialTheme ?? getPersistedTheme() ?? getRedesignTheme(),
  );

  useEffect(() => {
    if (ensureRedesign) setRedesignActive(true);
    // Re-assert (and persist) on mount so a reload restores the saved light/dark axis.
    setRedesignTheme(theme);
    persistTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: RedesignTheme) => {
    setRedesignTheme(next);
    persistTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: RedesignTheme = prev === "dark" ? "light" : "dark";
      setRedesignTheme(next);
      persistTheme(next);
      return next;
    });
  }, []);

  return { theme, isDark: theme === "dark", toggle, setTheme };
}
