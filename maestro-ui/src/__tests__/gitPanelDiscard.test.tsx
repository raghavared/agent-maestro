import { describe, it, expect } from "vitest";
import { canDiscardWorktree } from "../components/maestro/GitPanel";

describe("canDiscardWorktree", () => {
  it("allows discard for terminal session statuses", () => {
    for (const status of ["completed", "failed", "stopped"] as const) {
      expect(canDiscardWorktree(status)).toBe(true);
    }
  });

  it("blocks discard for in-flight session statuses", () => {
    for (const status of ["spawning", "idle", "working"] as const) {
      expect(canDiscardWorktree(status)).toBe(false);
    }
  });

  it("blocks discard when status is unknown", () => {
    expect(canDiscardWorktree(undefined)).toBe(false);
  });
});
