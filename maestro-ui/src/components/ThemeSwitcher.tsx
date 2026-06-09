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
    <div className="pn-fld">
      {/* ---- Style Picker ---- */}
      <div className="pn-fld">
        <div className="pn-flabel">App Style</div>
        <div className="pn-toolsel" style={{ flexWrap: 'wrap' }}>
          {STYLE_IDS.map((sid) => {
            const style = STYLES[sid];
            const isActive = sid === styleId;
            return (
              <button type="button"
                key={sid}
                className={`pn-tool${isActive ? ' pn-tool--active' : ''}`}
                onClick={() => setStyle(sid)}
                title={style.description}
              >
                <span>{style.icon}</span>
                <span className="pn-tool__name">{style.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Color Picker ---- */}
      <div className="pn-fld">
        <div className="pn-flabel">Color Theme</div>
        <div className="pn-toolsel" style={{ flexWrap: 'wrap' }}>
          {currentStyleThemes.variants.map((variant) => {
            const isActive = variant.key === colorKey;
            return (
              <button type="button"
                key={variant.key}
                className={`pn-tool${isActive ? ' pn-tool--active' : ''}`}
                onClick={() => setColor(variant.key)}
                title={variant.name}
              >
                <span className="pn-dot" style={{ background: variant.colors.primary }} />
                <span className="pn-tool__name">{variant.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
