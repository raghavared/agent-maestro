import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrChip, getPrInfo } from "../components/maestro/PrChip";

describe("getPrInfo", () => {
  it("returns null when no prUrl is present", () => {
    expect(getPrInfo({ metadata: {} })).toBeNull();
    expect(getPrInfo({ metadata: undefined })).toBeNull();
    expect(getPrInfo({ metadata: { prNumber: 12 } })).toBeNull();
  });

  it("extracts url and number from session metadata", () => {
    const pr = getPrInfo({
      metadata: { prUrl: "https://github.com/o/r/pull/42", prNumber: 42 },
    });
    expect(pr).toEqual({ url: "https://github.com/o/r/pull/42", number: 42 });
  });

  it("tolerates a url without a number", () => {
    const pr = getPrInfo({ metadata: { prUrl: "https://github.com/o/r/pull/7" } });
    expect(pr).toEqual({ url: "https://github.com/o/r/pull/7", number: undefined });
  });
});

describe("PrChip", () => {
  it("renders a link to the PR with the number label", () => {
    render(<PrChip url="https://github.com/o/r/pull/42" number={42} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/pull/42");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
    expect(link.textContent).toContain("#42");
  });

  it("falls back to a generic label when no number is given", () => {
    render(<PrChip url="https://github.com/o/r/pull/7" />);
    const link = screen.getByRole("link");
    expect(link.textContent).toContain("PR");
    expect(link.textContent).not.toContain("#");
  });
});
