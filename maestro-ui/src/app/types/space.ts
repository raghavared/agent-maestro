import type { DocEntry } from "./maestro";

export type SpaceType = "session" | "whiteboard" | "document";

export interface WhiteboardSpace {
  id: string;          // "wb_<id>"
  type: "whiteboard";
  name: string;
  projectId: string;
  createdAt: number;
  storageKey: string;  // localStorage key for Excalidraw scene data
}

export interface DocumentSpace {
  id: string;          // "doc_<id>"
  type: "document";
  name: string;
  projectId: string;
  createdAt: number;
  doc: DocEntry;
}

export type Space = WhiteboardSpace | DocumentSpace;

// --- Helpers ---

export function isWhiteboardId(id: string): boolean {
  return id.startsWith("wb_");
}

export function isDocumentId(id: string): boolean {
  return id.startsWith("doc_");
}

export function isSessionId(id: string): boolean {
  return !isWhiteboardId(id) && !isDocumentId(id);
}

export function getSpaceType(id: string): SpaceType {
  if (isWhiteboardId(id)) return "whiteboard";
  if (isDocumentId(id)) return "document";
  return "session";
}
