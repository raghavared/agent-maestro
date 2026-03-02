import type { DocEntry } from "./maestro";

export type SpaceType = "session" | "whiteboard" | "document" | "file";

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

export interface FileSpace {
  id: string;          // "file_<id>"
  type: "file";
  name: string;        // file name (basename)
  projectId: string;
  createdAt: number;
  filePath: string;    // absolute path to the file
  rootDir: string;     // root directory for the editor
  provider: "local" | "ssh";
  sshTarget: string | null;
}

export type Space = WhiteboardSpace | DocumentSpace | FileSpace;

// --- Helpers ---

export function isWhiteboardId(id: string): boolean {
  return id.startsWith("wb_");
}

export function isDocumentId(id: string): boolean {
  return id.startsWith("doc_");
}

export function isFileId(id: string): boolean {
  return id.startsWith("file_");
}

export function isSessionId(id: string): boolean {
  return !isWhiteboardId(id) && !isDocumentId(id) && !isFileId(id);
}

export function getSpaceType(id: string): SpaceType {
  if (isWhiteboardId(id)) return "whiteboard";
  if (isDocumentId(id)) return "document";
  if (isFileId(id)) return "file";
  return "session";
}
