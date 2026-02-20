import React from 'react';
import { useThemeStore } from '../stores/useThemeStore';
import {
  STYLES,
  STYLE_IDS,
  STYLE_THEMES,
  StyleId,
} from '../app/constants/themes';

export function ThemeSwitcher() {
  const styleId = useThemeStore((s) => s.styleId);
  const colorKey = useThemeStore((s) => s.colorKey);
  const setStyle = useThemeStore((s) => s.setStyle);
  const setColor = useThemeStore((s) => s.setColor);

  const currentStyleThemes = STYLE_THEMES[styleId];

  return (
    <div className="themeSwitcher">
      {/* ---- Style Picker ---- */}
      <div className="themeSwitcherLabel">App Style</div>
      <div className="styleSwitcherGrid">
        {STYLE_IDS.map((sid) => {
          const style = STYLES[sid];
          const isActive = sid === styleId;
          return (
            <button
              key={sid}
              className={`styleSwitcherOption ${isActive ? 'styleSwitcherOptionActive' : ''}`}
              onClick={() => setStyle(sid)}
              title={style.description}
            >
              <span className="styleSwitcherIcon">{style.icon}</span>
              <span className="styleSwitcherName">{style.name}</span>
            </button>
          );
        })}
      </div>

      {/* ---- Color Picker ---- */}
      <div className="themeSwitcherLabel" style={{ marginTop: 16 }}>
        Color Theme
      </div>
      <div className="themeSwitcherGrid">
        {currentStyleThemes.variants.map((variant) => {
          const isActive = variant.key === colorKey;
          return (
            <button
              key={variant.key}
              className={`themeSwitcherOption ${isActive ? 'themeSwitcherOptionActive' : ''}`}
              onClick={() => setColor(variant.key)}
              title={variant.name}
              style={{
                '--swatch-color': variant.colors.primary,
                '--swatch-border': variant.colors.border,
              } as React.CSSProperties}
            >
              <span className="themeSwitcherSwatch" />
              <span className="themeSwitcherName">{variant.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
