import { getProcessEffectById } from "../processEffects";
import { RecordingEvent } from "../app/types/recording";


export function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

export function formatRecordingT(ms: number): string {
    const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    if (safe < 1000) return `+${safe}ms`;
    const totalSeconds = Math.floor(safe / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `+${minutes}m${seconds.toString().padStart(2, "0")}s`;
    const tenths = Math.floor((safe % 1000) / 100);
    return `+${seconds}.${tenths}s`;
  }

  export function sanitizeRecordedInputForReplay(input: string): string {
    // Remove common ANSI/terminal control sequences; recordings should be replayable as plain input.
    let out = input;
    out = out.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
    out = out.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "");
    out = out.replace(/\x1bP[\s\S]*?\x1b\\/g, "");
    out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    return out;
  }

  export   function splitRecordingIntoSteps(events: RecordingEvent[]): string[] {
    const steps: string[] = [];
    let buffer = "";
    for (const ev of events) {
      buffer += sanitizeRecordedInputForReplay(ev.data);
      while (true) {
        const r = buffer.indexOf("\r");
        const n = buffer.indexOf("\n");
        const idx = r === -1 ? n : n === -1 ? r : Math.min(r, n);
        if (idx === -1) break;
        steps.push(buffer.slice(0, idx + 1));
        buffer = buffer.slice(idx + 1);
      }
    }
    if (buffer) steps.push(buffer);
    return steps;
  }


  export function formatError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  export function joinPathDisplay(baseDir: string, relativePath: string): string {
    const base = baseDir.replace(/[\\/]+$/, "");
    const rel = relativePath.replace(/^[\\/]+/, "");
    if (!base) return rel;
    if (!rel) return base;
    return `${base}/${rel}`;
  }

  export function cleanAgentShortcutIds(input: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of input) {
      const id = raw.trim();
      if (!id || seen.has(id)) continue;
      if (!getProcessEffectById(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

