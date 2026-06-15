import { describe, it, expect } from "vitest";
import { isDiagramDoc, isExcalidrawSceneJson } from "../utils/docHelpers";

const scene = JSON.stringify({
  type: "excalidraw",
  version: 2,
  source: "local",
  elements: [],
  appState: { viewBackgroundColor: "#fff" },
  files: {},
});

const localStorageScene = JSON.stringify({ elements: [{ id: "a" }], appState: {}, files: {} });

describe("isDiagramDoc", () => {
  it("detects explicit kind", () => {
    expect(isDiagramDoc({ kind: "diagram", filePath: "anything.txt" })).toBe(true);
  });

  it("detects .excalidraw extension regardless of kind", () => {
    expect(isDiagramDoc({ kind: undefined, filePath: "board.excalidraw" })).toBe(true);
    expect(isDiagramDoc({ kind: undefined, filePath: "board.EXCALIDRAW" })).toBe(true);
  });

  it("detects excalidraw scene content when kind and extension are missing", () => {
    // The real-world bug: CLI / timeline docs arrive without kind or a
    // .excalidraw filename, so only the content reveals they're a drawing.
    expect(isDiagramDoc({ kind: undefined, filePath: "drawing.md", content: scene })).toBe(true);
    expect(isDiagramDoc({ kind: undefined, filePath: "notes.json", content: localStorageScene })).toBe(true);
  });

  it("treats ordinary markdown as a doc, not a diagram", () => {
    expect(isDiagramDoc({ kind: undefined, filePath: "readme.md", content: "# Title\n\nSome text" })).toBe(false);
  });

  it("does not misclassify arbitrary JSON without elements", () => {
    expect(isDiagramDoc({ kind: undefined, filePath: "config.json", content: '{"foo":1}' })).toBe(false);
  });
});

describe("isExcalidrawSceneJson", () => {
  it("returns false for empty / non-object content", () => {
    expect(isExcalidrawSceneJson(undefined)).toBe(false);
    expect(isExcalidrawSceneJson("")).toBe(false);
    expect(isExcalidrawSceneJson("not json")).toBe(false);
    expect(isExcalidrawSceneJson("[]")).toBe(false);
  });

  it("returns false for malformed JSON that mentions elements", () => {
    expect(isExcalidrawSceneJson('{"elements": [}')).toBe(false);
  });

  it("returns true for canonical and localStorage scene forms", () => {
    expect(isExcalidrawSceneJson(scene)).toBe(true);
    expect(isExcalidrawSceneJson(localStorageScene)).toBe(true);
  });
});
