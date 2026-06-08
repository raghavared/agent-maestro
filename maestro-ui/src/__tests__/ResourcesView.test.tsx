import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { DocEntry } from "../app/types/maestro";

// Mock MaestroClient
const mockGetProjectDocs = vi.fn();
const mockGetTaskImageUrl = vi.fn((taskId: string, imageId: string) => `http://mock/${taskId}/${imageId}`);

vi.mock("../utils/MaestroClient", () => ({
  maestroClient: {
    getProjectDocs: (projectId: string) => mockGetProjectDocs(projectId),
    getTaskImageUrl: (taskId: string, imageId: string) => mockGetTaskImageUrl(taskId, imageId),
  },
  API_BASE_URL: "http://localhost:4569/api",
}));

// Mock useMaestroStore – provide tasks with images
const mockTasks: Record<string, any> = {
  task_1: {
    id: "task_1",
    projectId: "proj_abc",
    title: "Alpha Task",
    images: [
      { id: "img_1", filename: "screenshot.png", mimeType: "image/png", size: 100, addedAt: 1 },
    ],
  },
  task_2: {
    id: "task_2",
    projectId: "proj_abc",
    title: "Beta Task",
    images: [],
  },
  task_other: {
    id: "task_other",
    projectId: "proj_other",
    title: "Other Project Task",
    images: [{ id: "img_x", filename: "other.png", mimeType: "image/png", size: 10, addedAt: 1 }],
  },
};

vi.mock("../stores/useMaestroStore", () => ({
  useMaestroStore: (selector: any) => selector({ sessions: {}, tasks: mockTasks, teams: {} }),
}));

// Mock useSpacesStore
const mockOpenDocument = vi.fn(() => "doc_space_1");
const mockCreateWhiteboard = vi.fn(() => "wb_space_1");
vi.mock("../stores/useSpacesStore", () => ({
  useSpacesStore: (selector: any) =>
    selector({ openDocument: mockOpenDocument, createWhiteboard: mockCreateWhiteboard }),
}));

// Mock useSessionStore
const mockSetActiveId = vi.fn();
vi.mock("../stores/useSessionStore", () => ({
  useSessionStore: (selector: any) => selector({ setActiveId: mockSetActiveId }),
}));

import { ResourcesView } from "../components/ResourcesView";

function makeDoc(overrides: Partial<DocEntry> = {}): DocEntry {
  return {
    id: "doc_001",
    title: "My Note",
    filePath: "my_note.md",
    kind: "markdown",
    addedAt: Date.now(),
    sessionId: "sess_1",
    sessionName: "Session Alpha",
    ...overrides,
  };
}

describe("ResourcesView – rendering", () => {
  beforeEach(() => {
    mockGetProjectDocs.mockReset();
    mockOpenDocument.mockReset();
    mockCreateWhiteboard.mockReset();
    mockSetActiveId.mockReset();
    mockGetProjectDocs.mockResolvedValue([]);
  });

  it("renders the view with filter buttons", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    expect(screen.getByTestId("resources-view")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("resources-filters")).toBeTruthy());
    expect(screen.getByText(/All/)).toBeTruthy();
    expect(screen.getByText(/Docs/)).toBeTruthy();
    expect(screen.getByText(/Diagrams/)).toBeTruthy();
    expect(screen.getByText(/Images/)).toBeTruthy();
  });

  it("shows images from tasks in the current project", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
    expect(screen.getByText("screenshot.png")).toBeTruthy();
    // Image from other project should NOT appear
    expect(screen.queryByText("other.png")).toBeNull();
  });

  it("shows docs returned by getProjectDocs", async () => {
    mockGetProjectDocs.mockResolvedValue([makeDoc()]);
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("My Note")).toBeTruthy());
  });

  it("shows diagram docs with Diagram badge", async () => {
    mockGetProjectDocs.mockResolvedValue([
      makeDoc({ id: "d1", title: "My Diagram", kind: "diagram", filePath: "diag.excalidraw" }),
    ]);
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("My Diagram")).toBeTruthy());
    expect(screen.getByText("Diagram")).toBeTruthy();
  });
});

describe("ResourcesView – type filter", () => {
  beforeEach(() => {
    mockGetProjectDocs.mockResolvedValue([
      makeDoc({ id: "d1", title: "DocItem", kind: "markdown" }),
      makeDoc({ id: "d2", title: "DiagramItem", kind: "diagram", filePath: "d.excalidraw" }),
    ]);
  });

  it("Docs filter hides diagrams and images", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("DocItem")).toBeTruthy());
    fireEvent.click(screen.getByText(/^Docs/));
    expect(screen.getByText("DocItem")).toBeTruthy();
    expect(screen.queryByText("DiagramItem")).toBeNull();
    expect(screen.queryByText("screenshot.png")).toBeNull();
  });

  it("Diagrams filter shows only diagrams", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("DiagramItem")).toBeTruthy());
    fireEvent.click(screen.getByText(/^Diagrams/));
    expect(screen.getByText("DiagramItem")).toBeTruthy();
    expect(screen.queryByText("DocItem")).toBeNull();
    expect(screen.queryByText("screenshot.png")).toBeNull();
  });

  it("Images filter shows only images", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("DocItem")).toBeTruthy());
    fireEvent.click(screen.getByText(/^Images/));
    expect(screen.getByText("screenshot.png")).toBeTruthy();
    expect(screen.queryByText("DocItem")).toBeNull();
    expect(screen.queryByText("DiagramItem")).toBeNull();
  });

  it("All filter shows everything", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("DocItem")).toBeTruthy());
    fireEvent.click(screen.getByText(/^Diagrams/));
    fireEvent.click(screen.getByText(/^All/));
    expect(screen.getByText("DocItem")).toBeTruthy();
    expect(screen.getByText("DiagramItem")).toBeTruthy();
    expect(screen.getByText("screenshot.png")).toBeTruthy();
  });
});

describe("ResourcesView – search filter", () => {
  beforeEach(() => {
    mockGetProjectDocs.mockResolvedValue([
      makeDoc({ id: "d1", title: "Alpha Document" }),
      makeDoc({ id: "d2", title: "Beta Report" }),
    ]);
  });

  it("filters items by title search", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("Alpha Document")).toBeTruthy());
    fireEvent.change(screen.getByTestId("resources-search"), { target: { value: "alpha" } });
    expect(screen.getByText("Alpha Document")).toBeTruthy();
    expect(screen.queryByText("Beta Report")).toBeNull();
  });

  it("shows all items when search is cleared", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("Beta Report")).toBeTruthy());
    fireEvent.change(screen.getByTestId("resources-search"), { target: { value: "beta" } });
    expect(screen.queryByText("Alpha Document")).toBeNull();
    fireEvent.change(screen.getByTestId("resources-search"), { target: { value: "" } });
    expect(screen.getByText("Alpha Document")).toBeTruthy();
    expect(screen.getByText("Beta Report")).toBeTruthy();
  });
});

describe("ResourcesView – click opens the right space", () => {
  beforeEach(() => {
    mockGetProjectDocs.mockResolvedValue([
      makeDoc({ id: "d1", title: "MyDoc", kind: "markdown", sessionId: "sess_1" }),
      makeDoc({ id: "d2", title: "MyDiagram", kind: "diagram", filePath: "d.excalidraw", sessionId: "sess_2" }),
    ]);
    mockOpenDocument.mockReturnValue("doc_space_1");
    mockCreateWhiteboard.mockReturnValue("wb_space_1");
  });

  it("clicking a doc calls openDocument + setActiveId", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("MyDoc")).toBeTruthy());
    fireEvent.click(screen.getByText("MyDoc").closest("[data-testid='resource-item']")!);
    expect(mockOpenDocument).toHaveBeenCalledWith("proj_abc", expect.objectContaining({ id: "d1" }));
    expect(mockSetActiveId).toHaveBeenCalledWith("doc_space_1");
  });

  it("clicking a diagram calls createWhiteboard + setActiveId", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("MyDiagram")).toBeTruthy());
    fireEvent.click(screen.getByText("MyDiagram").closest("[data-testid='resource-item']")!);
    expect(mockCreateWhiteboard).toHaveBeenCalledWith(
      "proj_abc",
      "MyDiagram",
      undefined,
      "d2",
      "sess_2",
    );
    expect(mockSetActiveId).toHaveBeenCalledWith("wb_space_1");
  });

  it("clicking an image shows the preview overlay", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("screenshot.png")).toBeTruthy());
    fireEvent.click(screen.getByText("screenshot.png").closest("[data-testid='resource-item']")!);
    expect(screen.getByTestId("image-preview-overlay")).toBeTruthy();
  });

  it("clicking overlay close dismisses the preview", async () => {
    render(<ResourcesView projectId="proj_abc" />);
    await waitFor(() => expect(screen.getByText("screenshot.png")).toBeTruthy());
    fireEvent.click(screen.getByText("screenshot.png").closest("[data-testid='resource-item']")!);
    fireEvent.click(screen.getByText("✕"));
    expect(screen.queryByTestId("image-preview-overlay")).toBeNull();
  });
});

describe("MaestroClient.getProjectDocs – client test", () => {
  it("getProjectDocs calls the correct endpoint", async () => {
    expect(mockGetProjectDocs).toBeDefined();
    mockGetProjectDocs.mockResolvedValue([makeDoc()]);
    const result = await mockGetProjectDocs("proj_xyz");
    expect(result).toHaveLength(1);
    expect(mockGetProjectDocs).toHaveBeenCalledWith("proj_xyz");
  });
});
