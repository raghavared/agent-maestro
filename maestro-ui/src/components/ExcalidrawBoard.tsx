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
    const data = JSON.parse(raw) as ExcalidrawInitialDataState;
    // collaborators is a Map internally; JSON serialization turns it into a plain
    // object which lacks forEach, causing a runtime error. Drop it on load.
    if (data.appState) {
      delete (data.appState as Record<string, unknown>).collaborators;
    }
    return data;
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
        // collaborators is a Map – strip it before serialising to avoid a
        // plain-object being reloaded where a Map is expected.
        const { collaborators: _collaborators, ...appStateToSave } = appState as unknown as Record<string, unknown>;
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            elements,
            appState: appStateToSave,
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
