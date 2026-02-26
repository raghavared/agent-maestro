import { describe, it, expect } from "vitest";
import {
  formatTimeAgo,
  formatRecordingT,
  sanitizeRecordedInputForReplay,
  splitRecordingIntoSteps,
  formatError,
  joinPathDisplay,
} from "../utils/formatters";

describe("formatTimeAgo", () => {
  it('returns "just now" for recent timestamps', () => {
    expect(formatTimeAgo(Date.now())).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(formatTimeAgo(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(formatTimeAgo(Date.now() - 3 * 3_600_000)).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(formatTimeAgo(Date.now() - 2 * 86_400_000)).toBe("2d ago");
  });

  it("returns a date string for older timestamps", () => {
    const result = formatTimeAgo(Date.now() - 30 * 86_400_000);
    expect(result).not.toContain("ago");
  });
});

describe("formatRecordingT", () => {
  it("formats milliseconds", () => {
    expect(formatRecordingT(500)).toBe("+500ms");
  });

  it("formats seconds with tenths", () => {
    expect(formatRecordingT(3200)).toBe("+3.2s");
  });

  it("formats minutes and seconds", () => {
    expect(formatRecordingT(125_000)).toBe("+2m05s");
  });

  it("handles zero", () => {
    expect(formatRecordingT(0)).toBe("+0ms");
  });

  it("handles non-finite values", () => {
    expect(formatRecordingT(NaN)).toBe("+0ms");
    expect(formatRecordingT(Infinity)).toBe("+0ms");
  });
});

describe("sanitizeRecordedInputForReplay", () => {
  it("strips ANSI escape codes", () => {
    expect(sanitizeRecordedInputForReplay("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("strips OSC sequences", () => {
    expect(sanitizeRecordedInputForReplay("\x1b]0;title\x07text")).toBe("text");
  });

  it("removes control characters", () => {
    expect(sanitizeRecordedInputForReplay("hello\x00world")).toBe("helloworld");
  });
});

describe("splitRecordingIntoSteps", () => {
  it("splits on newlines", () => {
    const events = [{ data: "line1\nline2\n", timestamp: 0 }];
    const steps = splitRecordingIntoSteps(events as any);
    expect(steps).toEqual(["line1\n", "line2\n"]);
  });

  it("splits on carriage returns", () => {
    const events = [{ data: "cmd1\rcmd2\r", timestamp: 0 }];
    const steps = splitRecordingIntoSteps(events as any);
    expect(steps).toEqual(["cmd1\r", "cmd2\r"]);
  });

  it("handles trailing buffer", () => {
    const events = [{ data: "incomplete", timestamp: 0 }];
    const steps = splitRecordingIntoSteps(events as any);
    expect(steps).toEqual(["incomplete"]);
  });
});

describe("formatError", () => {
  it("returns message for Error instances", () => {
    expect(formatError(new Error("oops"))).toBe("oops");
  });

  it("returns string as-is", () => {
    expect(formatError("something bad")).toBe("something bad");
  });

  it("stringifies objects", () => {
    expect(formatError({ code: 42 })).toBe('{"code":42}');
  });
});

describe("joinPathDisplay", () => {
  it("joins base and relative paths", () => {
    expect(joinPathDisplay("/home/user", "docs/file.txt")).toBe("/home/user/docs/file.txt");
  });

  it("strips trailing slashes from base", () => {
    expect(joinPathDisplay("/home/user/", "file.txt")).toBe("/home/user/file.txt");
  });

  it("strips leading slashes from relative", () => {
    expect(joinPathDisplay("/home", "/file.txt")).toBe("/home/file.txt");
  });

  it("returns relative when base is empty", () => {
    expect(joinPathDisplay("", "file.txt")).toBe("file.txt");
  });

  it("returns base when relative is empty", () => {
    expect(joinPathDisplay("/home/user", "")).toBe("/home/user");
  });
});
