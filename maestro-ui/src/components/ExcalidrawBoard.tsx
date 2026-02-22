import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

const STORAGE_KEY = "maestro-excalidraw-scene-v1";
const SAVE_DEBOUNCE_MS = 300;

type ExcalidrawBoardProps = {
  onClose: () => void;
};

type ExcalidrawChangeHandler = NonNullable<React.ComponentProps<typeof Excalidraw>["onChange"]>;

function loadInitialData(): ExcalidrawInitialDataState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExcalidrawInitialDataState;
  } catch {
    return null;
  }
}

export function ExcalidrawBoard({ onClose }: ExcalidrawBoardProps) {
  const saveTimeoutRef = useRef<number | null>(null);
  const initialData = useMemo(() => loadInitialData(), []);

  const handleChange = useCallback<ExcalidrawChangeHandler>((elements, appState, files) => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            elements,
            appState,
            files,
          }),
        );
      } catch {
        // Ignore storage failures (quota/full/private mode).
      } finally {
        saveTimeoutRef.current = null;
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div className="excalidrawOverlay">
      <div className="excalidrawContainer">
        <div className="excalidrawHeader">
          <div className="excalidrawHeaderLeft">
            <span className="taskBoardTitle">WHITEBOARD</span>
            <span className="excalidrawShortcutHint">Cmd/Ctrl+Shift+X to toggle</span>
          </div>
          <button
            type="button"
            className="taskBoardCloseBtn"
            onClick={onClose}
            aria-label="Close whiteboard"
            title="Close whiteboard"
          >
            ×
          </button>
        </div>
        <div className="excalidrawCanvas">
          <Excalidraw
            initialData={initialData}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
