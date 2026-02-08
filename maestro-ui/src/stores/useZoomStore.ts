import { create } from 'zustand';
import { STORAGE_ZOOM_KEY } from '../app/constants/defaults';

export type ZoomLevel = 'small' | 'normal' | 'large' | 'xlarge';

export const ZOOM_LEVELS: ZoomLevel[] = ['small', 'normal', 'large', 'xlarge'];

export const ZOOM_CONFIG: Record<ZoomLevel, { label: string; scale: number }> = {
  small: { label: 'Small', scale: 0.875 },
  normal: { label: 'Normal', scale: 1.0 },
  large: { label: 'Large', scale: 1.125 },
  xlarge: { label: 'Extra Large', scale: 1.25 },
};

const DEFAULT_ZOOM_LEVEL: ZoomLevel = 'normal';

interface ZoomState {
  zoomLevel: ZoomLevel;
  setZoomLevel: (level: ZoomLevel) => void;
}

function readZoomFromStorage(): ZoomLevel {
  try {
    const raw = localStorage.getItem(STORAGE_ZOOM_KEY);
    if (raw && ZOOM_LEVELS.includes(raw as ZoomLevel)) {
      return raw as ZoomLevel;
    }
  } catch {
    // best-effort
  }
  return DEFAULT_ZOOM_LEVEL;
}

function applyZoomToDom(zoomLevel: ZoomLevel): void {
  const scale = ZOOM_CONFIG[zoomLevel].scale;
  document.documentElement.style.setProperty('--app-zoom-scale', scale.toString());
  document.documentElement.setAttribute('data-zoom', zoomLevel);
}

export const useZoomStore = create<ZoomState>((set) => ({
  zoomLevel: readZoomFromStorage(),

  setZoomLevel: (level: ZoomLevel) => {
    set({ zoomLevel: level });
    applyZoomToDom(level);
    try {
      localStorage.setItem(STORAGE_ZOOM_KEY, level);
    } catch {
      // best-effort
    }
  },
}));

/**
 * Initialize the zoom level on app startup.
 * Reads from localStorage and applies to the DOM.
 */
export function initZoom(): void {
  const zoomLevel = useZoomStore.getState().zoomLevel;
  applyZoomToDom(zoomLevel);
}
