import type { DocEntry } from "../app/types/maestro";

/**
 * A doc is a diagram when explicitly tagged `kind === 'diagram'`, when its file
 * ends in `.excalidraw`, or when its content is an Excalidraw scene export.
 *
 * The fallbacks matter because docs that flow through session/task timelines or
 * the CLI (`maestro task docs add` without `--kind diagram`) often arrive with
 * neither `kind` set nor a `.excalidraw` filename. Without detection they'd
 * wrongly render their raw scene JSON in the doc viewer instead of opening on
 * the Excalidraw board, and they'd appear as ordinary doc chips on tiles.
 */
export function isDiagramDoc(doc: Pick<DocEntry, "kind" | "filePath" | "content">): boolean {
  if (doc.kind === "diagram") return true;
  if (doc.filePath?.toLowerCase().endsWith(".excalidraw")) return true;
  return isExcalidrawSceneJson(doc.content);
}

/**
 * True when `content` is an Excalidraw scene export. Matches both the canonical
 * `serializeAsJSON` form (`{ "type": "excalidraw", ... }`) and the localStorage
 * form (`{ elements: [...], appState: {...} }`).
 */
export function isExcalidrawSceneJson(content: string | undefined | null): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  // Cheap guards so we never JSON.parse markdown / arbitrary text.
  if (!trimmed.startsWith("{") || !trimmed.includes('"elements"')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object") return false;
    if (parsed.type === "excalidraw") return true;
    return Array.isArray(parsed.elements) && typeof parsed.appState === "object" && parsed.appState !== null;
  } catch {
    return false;
  }
}
