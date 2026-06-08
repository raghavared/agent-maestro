import { describe, it, expect } from "vitest";
import type { GitDiffSummary } from "../app/types/maestro";
import { deriveBranchHeader } from "../components/maestro/GitPanel";

function makeSummary(overrides: Partial<GitDiffSummary> = {}): GitDiffSummary {
  return {
    branch: "maestro/feature-abcd",
    baseBranch: "main",
    baseCommit: "deadbeef",
    ahead: 0,
    behind: 0,
    dirty: false,
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
    commitCount: 0,
    files: [],
    ...overrides,
  };
}

describe("deriveBranchHeader", () => {
  it("returns a placeholder, action-disabled state when summary is missing", () => {
    const state = deriveBranchHeader(undefined);
    expect(state.branch).toBe("—");
    expect(state.baseBranch).toBeUndefined();
    expect(state.ahead).toBe(0);
    expect(state.behind).toBe(0);
    expect(state.dirty).toBe(false);
    expect(state.mutationDisabled).toBe(true);
    expect(state.disabledReason).toBe("No git summary available");
  });

  it("passes through branch/base/ahead/behind and enables actions when clean", () => {
    const state = deriveBranchHeader(makeSummary({ ahead: 3, behind: 1 }));
    expect(state.branch).toBe("maestro/feature-abcd");
    expect(state.baseBranch).toBe("main");
    expect(state.ahead).toBe(3);
    expect(state.behind).toBe(1);
    expect(state.dirty).toBe(false);
    expect(state.mutationDisabled).toBe(false);
    expect(state.disabledReason).toBeUndefined();
  });

  it("disables mutating actions and reports a reason when the worktree is dirty", () => {
    const state = deriveBranchHeader(makeSummary({ dirty: true, ahead: 2 }));
    expect(state.dirty).toBe(true);
    expect(state.mutationDisabled).toBe(true);
    expect(state.disabledReason).toBe("Worktree has uncommitted changes");
  });
});
