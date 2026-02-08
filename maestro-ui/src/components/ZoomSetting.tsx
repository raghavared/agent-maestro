import React from 'react';
import { useZoomStore, ZOOM_LEVELS, ZOOM_CONFIG, ZoomLevel } from '../stores/useZoomStore';

export function ZoomSetting() {
  const zoomLevel = useZoomStore((s) => s.zoomLevel);
  const setZoomLevel = useZoomStore((s) => s.setZoomLevel);

  return (
    <div className="themeSwitcher">
      <div className="themeSwitcherLabel">UI Scale</div>
      <div className="themeSwitcherGrid">
        {ZOOM_LEVELS.map((level) => {
          const config = ZOOM_CONFIG[level];
          const isActive = level === zoomLevel;
          return (
            <button
              key={level}
              className={`themeSwitcherOption ${isActive ? 'themeSwitcherOptionActive' : ''}`}
              onClick={() => setZoomLevel(level as ZoomLevel)}
              title={`${config.label} (${Math.round(config.scale * 100)}%)`}
            >
              <span className="themeSwitcherName">{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
