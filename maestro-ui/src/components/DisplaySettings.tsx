import React from 'react';
import { useZoomStore, ZOOM_LEVELS, ZOOM_CONFIG } from '../stores/useZoomStore';
import {
  useTerminalSettingsStore,
  TERMINAL_FONT_PRESETS,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_FONT_SIZE_MAX,
  DEFAULT_TERMINAL_FONT_ID,
  DEFAULT_TERMINAL_FONT_SIZE,
} from '../stores/useTerminalSettingsStore';

export function DisplaySettings() {
  const zoomLevel = useZoomStore((s) => s.zoomLevel);
  const setZoomLevel = useZoomStore((s) => s.setZoomLevel);

  const termFontId = useTerminalSettingsStore((s) => s.fontId);
  const termFontStack = useTerminalSettingsStore((s) => s.fontStack);
  const termFontSize = useTerminalSettingsStore((s) => s.fontSize);
  const setTermFontId = useTerminalSettingsStore((s) => s.setFontId);
  const setTermFontSize = useTerminalSettingsStore((s) => s.setFontSize);
  const resetTerm = useTerminalSettingsStore((s) => s.reset);

  const termIsDefault =
    termFontId === DEFAULT_TERMINAL_FONT_ID && termFontSize === DEFAULT_TERMINAL_FONT_SIZE;

  return (
    <div className="pn-fld">
      <div className="pn-fld">
        <div className="pn-flabel">UI Scale</div>
        <div className="pn-fhint">
          Scales the entire interface — text, panels, buttons, spacing
        </div>
        <div className="pn-seg">
          {ZOOM_LEVELS.map((level) => {
            const config = ZOOM_CONFIG[level];
            const isActive = level === zoomLevel;
            return (
              <button
                key={level}
                type="button"
                className={`pn-seg-i${isActive ? ' pn-seg-i--active' : ''}`}
                onClick={() => setZoomLevel(level)}
              >
                {config.label} {Math.round(config.scale * 100)}%
              </button>
            );
          })}
        </div>
      </div>

      <div className="pn-fld">
        <div className="pn-flabel">Preview</div>
        <div className="pn-card-s" style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: `calc(13px * ${ZOOM_CONFIG[zoomLevel].scale})` }}>
            The quick brown fox jumps over the lazy dog.
          </span>
          <span style={{ fontSize: `calc(11px * ${ZOOM_CONFIG[zoomLevel].scale})`, opacity: 0.6 }}>
            ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
          </span>
        </div>
      </div>

      {/* ---------------- Terminal ---------------- */}
      <div className="pn-fld">
        <div className="pn-flabel">Terminal Font</div>
        <div className="pn-fhint">
          Font used inside session terminals. Applies live to every open terminal.
        </div>
        <select
          className="pn-select"
          value={termFontId}
          onChange={(e) => setTermFontId(e.target.value)}
        >
          {TERMINAL_FONT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pn-fld">
        <div className="pn-flabel">Terminal Font Size</div>
        <div className="pn-fhint">{termFontSize}px</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="pn-btn"
            onClick={() => setTermFontSize(termFontSize - 1)}
            disabled={termFontSize <= TERMINAL_FONT_SIZE_MIN}
            aria-label="Decrease terminal font size"
          >
            −
          </button>
          <input
            type="range"
            min={TERMINAL_FONT_SIZE_MIN}
            max={TERMINAL_FONT_SIZE_MAX}
            step={1}
            value={termFontSize}
            onChange={(e) => setTermFontSize(parseInt(e.target.value, 10))}
            style={{ flex: 1 }}
            aria-label="Terminal font size"
          />
          <button
            type="button"
            className="pn-btn"
            onClick={() => setTermFontSize(termFontSize + 1)}
            disabled={termFontSize >= TERMINAL_FONT_SIZE_MAX}
            aria-label="Increase terminal font size"
          >
            +
          </button>
        </div>
      </div>

      <div className="pn-fld">
        <div className="pn-flabel">Terminal Preview</div>
        <div
          style={{
            background: 'var(--pn-term-bg, #1B1812)',
            color: 'var(--pn-term-ink, #D9D2C4)',
            fontFamily: termFontStack,
            fontSize: `${termFontSize}px`,
            lineHeight: 1.6,
            padding: '12px 14px',
            borderRadius: 6,
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
          <div>
            <span style={{ color: 'var(--pn-term-acc, #E0A45A)' }}>❯</span> ls -la · git status
          </div>
          <div>function foo(x) {'{'} return x * 2; {'}'} // il1 O0 {'<='} {'=>'}</div>
          <div style={{ color: 'var(--pn-term-dim, #8a8474)' }}>
            ABCDEFGHIJKLM abcdefghijklm 0123456789
          </div>
        </div>
      </div>

      {!termIsDefault && (
        <button type="button" className="pn-btn" onClick={resetTerm}>
          Reset Terminal to Default
        </button>
      )}

      {zoomLevel !== 'normal' && (
        <button
          type="button"
          className="pn-btn"
          onClick={() => setZoomLevel('normal')}
        >
          Reset UI Scale to Default
        </button>
      )}
    </div>
  );
}
