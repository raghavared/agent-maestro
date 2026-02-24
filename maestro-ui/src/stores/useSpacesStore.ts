import { create } from "zustand";
import type { Space, WhiteboardSpace, DocumentSpace } from "../app/types/space";
import type { DocEntry } from "../app/types/maestro";

const STORAGE_KEY = "maestro-spaces-v1";

function generateId(prefix: string): string {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function loadSpaces(): Space[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: unknown): s is Space =>
        typeof s === "object" &&
        s !== null &&
        ("type" in s) &&
        ((s as Space).type === "whiteboard" || (s as Space).type === "document"),
    );
  } catch {
    return [];
  }
}

function persistSpaces(spaces: Space[]) {
  try {
    // Only persist whiteboards (documents are ephemeral — they reopen from DocsList)
    const whiteboards = spaces.filter((s) => s.type === "whiteboard");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(whiteboards));
  } catch {
    // best-effort
  }
}

interface SpacesState {
  spaces: Space[];

  // Whiteboard actions
  createWhiteboard: (projectId: string, name?: string) => string;
  closeWhiteboard: (id: string) => void;

  // Document actions
  openDocument: (projectId: string, doc: DocEntry) => string;
  closeDocument: (id: string) => void;

  // Getters
  getSpacesByProject: (projectId: string) => Space[];
  getSpace: (id: string) => Space | undefined;
}

export const useSpacesStore = create<SpacesState>((set, get) => ({
  spaces: loadSpaces(),

  createWhiteboard: (projectId, name) => {
    const id = generateId("wb_");
    const storageKey = `maestro-excalidraw-scene-${id}`;
    const wb: WhiteboardSpace = {
      id,
      type: "whiteboard",
      name: name || "Whiteboard",
      projectId,
      createdAt: Date.now(),
      storageKey,
    };
    set((s) => {
      const next = [...s.spaces, wb];
      persistSpaces(next);
      return { spaces: next };
    });
    return id;
  },

  closeWhiteboard: (id) => {
    const space = get().spaces.find((s) => s.id === id);
    set((s) => {
      const next = s.spaces.filter((sp) => sp.id !== id);
      persistSpaces(next);
      return { spaces: next };
    });
    // Clean up the scene data from localStorage
    if (space && space.type === "whiteboard") {
      try {
        localStorage.removeItem((space as WhiteboardSpace).storageKey);
      } catch {
        // best-effort
      }
    }
  },

  openDocument: (projectId, doc) => {
    // Reuse an existing document space for the same doc
    const existing = get().spaces.find(
      (s) => s.type === "document" && (s as DocumentSpace).doc.id === doc.id,
    );
    if (existing) return existing.id;

    const id = generateId("doc_");
    const ds: DocumentSpace = {
      id,
      type: "document",
      name: doc.title,
      projectId,
      createdAt: Date.now(),
      doc,
    };
    set((s) => ({ spaces: [...s.spaces, ds] }));
    return id;
  },

  closeDocument: (id) => {
    set((s) => ({
      spaces: s.spaces.filter((sp) => sp.id !== id),
    }));
  },

  getSpacesByProject: (projectId) => {
    return get().spaces.filter((s) => s.projectId === projectId);
  },

  getSpace: (id) => {
    return get().spaces.find((s) => s.id === id);
  },
}));
