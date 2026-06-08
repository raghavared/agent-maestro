import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Provide a proper localStorage mock for this test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal("localStorage", localStorageMock);

// Mock @excalidraw/excalidraw so the test runs in jsdom without canvas
vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: ({ onChange, viewModeEnabled }: any) => (
    <div
      data-testid="excalidraw-mock"
      data-view-mode={viewModeEnabled ? "true" : "false"}
      onClick={() =>
        onChange?.([{ id: "el1" }], { collaborators: new Map() }, {})
      }
    />
  ),
  exportToBlob: vi.fn(),
  serializeAsJSON: vi.fn(() => '{"elements":[],"appState":{},"files":{}}'),
}));
vi.mock("@excalidraw/excalidraw/index.css", () => ({}));
vi.mock("../components/ExportToTaskPicker", () => ({
  ExportToTaskPicker: () => null,
}));
vi.mock("../components/ExportToSessionPicker", () => ({
  ExportToSessionPicker: ({ onClose }: any) => (
    <div data-testid="session-picker-mock">
      <button data-testid="session-picker-close" onClick={onClose}>close</button>
    </div>
  ),
}));

// Mock stores used by ExportToSessionPicker (not needed directly in board tests but resolves import chain)
vi.mock("../stores/useMaestroStore", () => ({ useMaestroStore: vi.fn(() => ({})) }));
vi.mock("../stores/useProjectStore", () => ({ useProjectStore: vi.fn(() => ({ activeProjectId: "proj_1" })) }));

const mockUpdateDocContent = vi.fn().mockResolvedValue({});
const mockInjectDiagram = vi.fn().mockResolvedValue({ pngPath: "/tmp/d.png", excalidrawPath: "/tmp/d.excalidraw" });
vi.mock("../utils/MaestroClient", () => ({
  maestroClient: {
    updateDocContent: (...args: any[]) => mockUpdateDocContent(...args),
    injectDiagramToSession: (...args: any[]) => mockInjectDiagram(...args),
  },
  API_BASE_URL: "http://localhost:4569/api",
}));

import { ExcalidrawBoard } from "../components/ExcalidrawBoard";

describe("ExcalidrawBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders in edit mode by default (viewModeEnabled=false)", () => {
    render(<ExcalidrawBoard onClose={() => {}} inline />);
    expect(screen.getByTestId("excalidraw-mock").dataset.viewMode).toBe("false");
  });

  it("renders in view mode when mode=view (viewModeEnabled=true)", () => {
    render(<ExcalidrawBoard onClose={() => {}} inline mode="view" />);
    expect(screen.getByTestId("excalidraw-mock").dataset.viewMode).toBe("true");
  });

  it("saves to localStorage after debounce in edit mode", () => {
    const storageKey = "test-wb-key";
    render(<ExcalidrawBoard onClose={() => {}} inline storageKey={storageKey} />);
    fireEvent.click(screen.getByTestId("excalidraw-mock"));
    vi.runAllTimers();
    expect(localStorage.getItem(storageKey)).not.toBeNull();
  });

  it("calls updateDocContent when doc-backed + edit mode after debounce", async () => {
    render(
      <ExcalidrawBoard
        onClose={() => {}}
        inline
        mode="edit"
        docId="doc_123"
        docSessionId="sess_abc"
      />,
    );
    fireEvent.click(screen.getByTestId("excalidraw-mock"));
    vi.runAllTimers();
    // flush the promise from updateDocContent
    await Promise.resolve();
    expect(mockUpdateDocContent).toHaveBeenCalledWith(
      "sess_abc",
      "doc_123",
      expect.any(String),
    );
  });

  it("does NOT call updateDocContent in view mode", async () => {
    render(
      <ExcalidrawBoard
        onClose={() => {}}
        inline
        mode="view"
        docId="doc_123"
        docSessionId="sess_abc"
      />,
    );
    fireEvent.click(screen.getByTestId("excalidraw-mock"));
    vi.runAllTimers();
    await Promise.resolve();
    expect(mockUpdateDocContent).not.toHaveBeenCalled();
  });

  it("loads initialSceneJson over localStorage cache without error", () => {
    const storageKey = "test-wb-initial";
    localStorage.setItem(
      storageKey,
      JSON.stringify({ elements: [{ id: "old" }], appState: {}, files: {} }),
    );
    const sceneJson = JSON.stringify({ elements: [{ id: "new" }], appState: {}, files: {} });
    expect(() =>
      render(
        <ExcalidrawBoard
          onClose={() => {}}
          inline
          storageKey={storageKey}
          initialSceneJson={sceneJson}
        />,
      ),
    ).not.toThrow();
  });

  it("shows 'Export to Session' button in edit mode", () => {
    render(<ExcalidrawBoard onClose={() => {}} inline />);
    expect(screen.getByTitle("Export diagram and inject it into a running session")).toBeTruthy();
  });

  it("opens ExportToSessionPicker when 'Export to Session' is clicked", () => {
    render(<ExcalidrawBoard onClose={() => {}} inline />);
    const btn = screen.getByTitle("Export diagram and inject it into a running session");
    fireEvent.click(btn);
    expect(screen.getByTestId("session-picker-mock")).toBeTruthy();
  });

  it("closes ExportToSessionPicker when picker fires onClose", () => {
    render(<ExcalidrawBoard onClose={() => {}} inline />);
    fireEvent.click(screen.getByTitle("Export diagram and inject it into a running session"));
    expect(screen.queryByTestId("session-picker-mock")).toBeTruthy();
    fireEvent.click(screen.getByTestId("session-picker-close"));
    expect(screen.queryByTestId("session-picker-mock")).toBeNull();
  });

  it("shows 'Import' button in edit mode", () => {
    render(<ExcalidrawBoard onClose={() => {}} inline />);
    expect(screen.getByTitle("Import .excalidraw file or image onto canvas")).toBeTruthy();
  });

  it("does NOT show 'Import' button in view mode", () => {
    render(<ExcalidrawBoard onClose={() => {}} inline mode="view" />);
    expect(screen.queryByTitle("Import .excalidraw file or image onto canvas")).toBeNull();
  });
});
