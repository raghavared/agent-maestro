import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

const DEFAULT_STORAGE_KEY = "maestro-excalidraw-scene-v1";
const SAVE_DEBOUNCE_MS = 300;

type ExcalidrawBoardProps = {
  onClose: () => void;
  /** When true, render inline inside parent container instead of as a portal overlay */
  inline?: boolean;
  /** Custom localStorage key for multi-whiteboard support */
  storageKey?: string;
  /** Display name for the whiteboard */
  name?: string;
};

type ExcalidrawChangeHandler = NonNullable<React.ComponentProps<typeof Excalidraw>["onChange"]>;

function loadInitialData(key: string): ExcalidrawInitialDataState | null {
  try {
    const raw = localStorage.getItem(key);
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

export function ExcalidrawBoard({ onClose, inline, storageKey, name }: ExcalidrawBoardProps) {
  const effectiveKey = storageKey || DEFAULT_STORAGE_KEY;
  const saveTimeoutRef = useRef<number | null>(null);
  const initialData = useMemo(() => loadInitialData(effectiveKey), [effectiveKey]);

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
          effectiveKey,
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
  }, [effectiveKey]);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    },
    [],
  );

  // Escape-to-close only for overlay mode
  useEffect(() => {
    if (inline) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, inline]);

  const content = (
    <div className={inline ? "excalidrawInline" : "excalidrawOverlay"}>
      <div className="excalidrawContainer">
        <div className="excalidrawHeader">
          <div className="excalidrawHeaderLeft">
            <span className="taskBoardTitle">{name || "WHITEBOARD"}</span>
            {!inline && (
              <span className="excalidrawShortcutHint">Cmd/Ctrl+Shift+X to toggle</span>
            )}
          </div>
          {!inline && (
            <button
              type="button"
              className="taskBoardCloseBtn"
              onClick={onClose}
              aria-label="Close whiteboard"
              title="Close whiteboard"
            >
              ×
            </button>
          )}
        </div>
        <div className="excalidrawCanvas">
          <Excalidraw
            initialData={initialData}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return createPortal(content, document.body);
}
