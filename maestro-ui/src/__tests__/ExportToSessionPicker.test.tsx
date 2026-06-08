import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../stores/useProjectStore", () => ({
  useProjectStore: (selector: any) =>
    selector({ activeProjectId: "proj_1" }),
}));

const mockSessions: Record<string, any> = {
  sess_a: {
    id: "sess_a",
    name: "Worker A",
    status: "working",
    projectId: "proj_1",
    updatedAt: 2000,
    teamMemberSnapshot: { name: "Alice" },
  },
  sess_b: {
    id: "sess_b",
    name: "Idle B",
    status: "idle",
    projectId: "proj_1",
    updatedAt: 1000,
  },
  sess_completed: {
    id: "sess_completed",
    name: "Done",
    status: "completed",
    projectId: "proj_1",
    updatedAt: 500,
  },
  sess_other_proj: {
    id: "sess_other_proj",
    name: "Other Project",
    status: "working",
    projectId: "proj_2",
    updatedAt: 1500,
  },
};

vi.mock("../stores/useMaestroStore", () => ({
  useMaestroStore: (selector: any) => selector({ sessions: mockSessions }),
}));

const mockInjectDiagram = vi.fn().mockResolvedValue({
  pngPath: "/tmp/diag.png",
  excalidrawPath: "/tmp/diag.excalidraw",
});
vi.mock("../utils/MaestroClient", () => ({
  maestroClient: { injectDiagramToSession: (...a: any[]) => mockInjectDiagram(...a) },
}));

import { ExportToSessionPicker } from "../components/ExportToSessionPicker";

describe("ExportToSessionPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOnExport = vi.fn().mockResolvedValue({
    png: new Blob(["png"], { type: "image/png" }),
    sceneJson: '{"elements":[],"appState":{},"files":{}}',
  });

  it("lists only running sessions from the active project", () => {
    render(
      <ExportToSessionPicker
        onExport={mockOnExport}
        onClose={() => {}}
        whiteboardName="test"
      />,
    );
    expect(screen.getByText("Worker A")).toBeTruthy();
    expect(screen.getByText("Idle B")).toBeTruthy();
    // completed session should not appear
    expect(screen.queryByText("Done")).toBeNull();
    // other project session should not appear
    expect(screen.queryByText("Other Project")).toBeNull();
  });

  it("filters by search text", () => {
    render(
      <ExportToSessionPicker
        onExport={mockOnExport}
        onClose={() => {}}
        whiteboardName="test"
      />,
    );
    const input = screen.getByPlaceholderText("Search sessions...");
    fireEvent.change(input, { target: { value: "Worker" } });
    expect(screen.getByText("Worker A")).toBeTruthy();
    expect(screen.queryByText("Idle B")).toBeNull();
  });

  it("calls injectDiagramToSession when a session is clicked", async () => {
    render(
      <ExportToSessionPicker
        onExport={mockOnExport}
        onClose={() => {}}
        whiteboardName="my-board"
      />,
    );
    fireEvent.click(screen.getByText("Worker A"));
    await waitFor(() => expect(mockInjectDiagram).toHaveBeenCalledTimes(1));
    expect(mockInjectDiagram).toHaveBeenCalledWith(
      "sess_a",
      expect.any(Blob),
      expect.any(String),
      "my-board",
    );
  });

  it("shows an error status when export returns null", async () => {
    const emptyExport = vi.fn().mockResolvedValue(null);
    render(
      <ExportToSessionPicker
        onExport={emptyExport}
        onClose={() => {}}
        whiteboardName="test"
      />,
    );
    fireEvent.click(screen.getByText("Idle B"));
    await waitFor(() =>
      expect(screen.getByText("Nothing to export (empty canvas)")).toBeTruthy(),
    );
    expect(mockInjectDiagram).not.toHaveBeenCalled();
  });

  it("calls onClose when the × button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ExportToSessionPicker
        onExport={mockOnExport}
        onClose={onClose}
        whiteboardName="test"
      />,
    );
    fireEvent.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
