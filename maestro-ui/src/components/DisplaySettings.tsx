import React from 'react';
import { useZoomStore, ZOOM_LEVELS, ZOOM_CONFIG, ZoomLevel } from '../stores/useZoomStore';

export function DisplaySettings() {
  const zoomLevel = useZoomStore((s) => s.zoomLevel);
  const setZoomLevel = useZoomStore((s) => s.setZoomLevel);

  return (
    <div className="displaySettings">
      <div className="displaySettingsSection">
        <div className="displaySettingsLabel">UI Scale</div>
        <div className="displaySettingsHint">
          Scales the entire interface — text, panels, buttons, spacing
        </div>
        <div className="displaySettingsOptions">
          {ZOOM_LEVELS.map((level) => {
            const config = ZOOM_CONFIG[level];
            const isActive = level === zoomLevel;
            return (
              <button
                key={level}
                type="button"
                className={`displaySettingsOption ${isActive ? 'displaySettingsOptionActive' : ''}`}
                onClick={() => setZoomLevel(level)}
              >
                <span className="displaySettingsOptionLabel">{config.label}</span>
                <span className="displaySettingsOptionScale">{Math.round(config.scale * 100)}%</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="displaySettingsPreview">
        <div className="displaySettingsPreviewLabel">Preview</div>
        <div className="displaySettingsPreviewBox">
          <span style={{ fontSize: `calc(13px * ${ZOOM_CONFIG[zoomLevel].scale})` }}>
            The quick brown fox jumps over the lazy dog.
          </span>
          <span style={{ fontSize: `calc(11px * ${ZOOM_CONFIG[zoomLevel].scale})`, opacity: 0.6 }}>
            ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
          </span>
        </div>
      </div>

      {zoomLevel !== 'normal' && (
        <button
          type="button"
          className="displaySettingsReset"
          onClick={() => setZoomLevel('normal')}
        >
          Reset to Default
        </button>
      )}
    </div>
  );
}
