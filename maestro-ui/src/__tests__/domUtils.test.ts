import { describe, it, expect, vi } from "vitest";
import { sleep, copyToClipboard } from "../utils/domUtils";

describe("sleep", () => {
  it("resolves after the specified delay", async () => {
    vi.useFakeTimers();
    const promise = sleep(100);
    vi.advanceTimersByTime(100);
    await promise;
    vi.useRealTimers();
  });
});

describe("copyToClipboard", () => {
  it("returns false for empty string", async () => {
    expect(await copyToClipboard("")).toBe(false);
  });

  it("uses navigator.clipboard.writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const result = await copyToClipboard("hello");
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("returns false when clipboard API throws", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });

    const result = await copyToClipboard("hello");
    expect(result).toBe(false);
  });
});
