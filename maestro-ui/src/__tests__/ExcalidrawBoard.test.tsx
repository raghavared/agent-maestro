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

const mockUpdateDocContent = vi.fn().mockResolvedValue({});
vi.mock("../utils/MaestroClient", () => ({
  maestroClient: {
    updateDocContent: (...args: any[]) => mockUpdateDocContent(...args),
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
});
