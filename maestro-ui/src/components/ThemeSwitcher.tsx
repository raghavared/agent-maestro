import React from 'react';
import { useThemeStore } from '../stores/useThemeStore';
import { THEMES, THEME_IDS, ThemeId } from '../app/constants/themes';

export function ThemeSwitcher() {
  const themeId = useThemeStore((s) => s.themeId);
  const setThemeId = useThemeStore((s) => s.setThemeId);

  return (
    <div className="themeSwitcher">
      <div className="themeSwitcherLabel">Color Theme</div>
      <div className="themeSwitcherGrid">
        {THEME_IDS.map((id) => {
          const theme = THEMES[id];
          const isActive = id === themeId;
          return (
            <button
              key={id}
              className={`themeSwitcherOption ${isActive ? 'themeSwitcherOptionActive' : ''}`}
              onClick={() => setThemeId(id)}
              title={theme.name}
              style={{
                '--swatch-color': theme.colors.primary,
                '--swatch-border': theme.colors.border,
              } as React.CSSProperties}
            >
              <span className="themeSwitcherSwatch" />
              <span className="themeSwitcherName">{theme.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
