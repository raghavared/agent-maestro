/**
 * Shared clipboard/drag-and-drop image extraction.
 *
 * Used by the task create/edit modal (and any future surface that accepts
 * pasted images) to pull image Files out of a paste or drop event,
 * Claude/ChatGPT-style: paste a screenshot, a copied image, or image files
 * copied from Finder, and they become attachments.
 */

const GENERIC_CLIPBOARD_NAMES = new Set(["", "image.png", "image.jpg", "image.jpeg", "image.gif", "image.webp"]);

function fileKey(f: File): string {
    return `${f.name}:${f.size}:${f.type}`;
}

/** Map a mime type to a sensible file extension. */
function extForMime(mimeType: string): string {
    const sub = mimeType.split("/")[1] || "png";
    if (sub === "jpeg") return "jpg";
    if (sub === "svg+xml") return "svg";
    return sub;
}

/**
 * Clipboard image blobs usually arrive named "image.png". Give them a
 * meaningful, unique-ish name so the attachment list stays readable.
 */
function withMeaningfulName(file: File, index: number): File {
    if (!GENERIC_CLIPBOARD_NAMES.has(file.name.toLowerCase())) return file;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const suffix = index > 0 ? `-${index + 1}` : "";
    const name = `pasted-image-${ts}${suffix}.${extForMime(file.type)}`;
    return new File([file], name, { type: file.type, lastModified: file.lastModified });
}

/**
 * Extract image Files from a paste or drop DataTransfer.
 *
 * Reads both `items` (screenshots, "Copy Image") and `files` (OS file
 * copies — WebKit sometimes only populates one of the two), deduping
 * entries that appear in both.
 */
export function extractImageFiles(data: DataTransfer | null): File[] {
    if (!data) return [];

    const out: File[] = [];
    const seen = new Set<string>();

    const push = (f: File | null) => {
        if (!f || !f.type.startsWith("image/")) return;
        const key = fileKey(f);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(f);
    };

    if (data.items) {
        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            if (item.kind === "file") push(item.getAsFile());
        }
    }
    if (data.files) {
        for (let i = 0; i < data.files.length; i++) {
            push(data.files[i]);
        }
    }

    return out.map(withMeaningfulName);
}

/** True if the DataTransfer carries files at all (used to accept drag-over). */
export function dataTransferHasFiles(data: DataTransfer | null): boolean {
    if (!data) return false;
    return Array.from(data.types || []).includes("Files");
}
