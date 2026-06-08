import { describe, it, expect, beforeEach } from "vitest";
import {
  previewBranchName,
  DEFAULT_BRANCH_NAMING_SCHEME,
  useGitSettingsStore,
} from "../stores/useGitSettingsStore";

describe("previewBranchName", () => {
  it("expands {slug} and {id} placeholders", () => {
    expect(previewBranchName("maestro/{slug}-{id}", "fix-bug", "9z9z")).toBe(
      "maestro/fix-bug-9z9z",
    );
  });

  it("falls back to the default scheme when the template is blank", () => {
    expect(previewBranchName("   ", "task", "abcd")).toBe(
      previewBranchName(DEFAULT_BRANCH_NAMING_SCHEME, "task", "abcd"),
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(previewBranchName("feat/{slug}/{unknown}", "x", "y")).toBe(
      "feat/x/{unknown}",
    );
  });
});

describe("useGitSettingsStore", () => {
  beforeEach(() => {
    useGitSettingsStore.getState().reset();
  });

  it("trims the default base branch on set", () => {
    useGitSettingsStore.getState().setDefaultBaseBranch("  develop  ");
    expect(useGitSettingsStore.getState().defaultBaseBranch).toBe("develop");
  });

  it("toggles auto-discard-on-merge", () => {
    expect(useGitSettingsStore.getState().autoDiscardOnMerge).toBe(false);
    useGitSettingsStore.getState().setAutoDiscardOnMerge(true);
    expect(useGitSettingsStore.getState().autoDiscardOnMerge).toBe(true);
  });

  it("reset restores defaults", () => {
    const s = useGitSettingsStore.getState();
    s.setDefaultBaseBranch("main");
    s.setBranchNamingScheme("custom/{slug}");
    s.setAutoDiscardOnMerge(true);
    s.reset();
    const after = useGitSettingsStore.getState();
    expect(after.defaultBaseBranch).toBe("");
    expect(after.branchNamingScheme).toBe(DEFAULT_BRANCH_NAMING_SCHEME);
    expect(after.autoDiscardOnMerge).toBe(false);
  });
});
