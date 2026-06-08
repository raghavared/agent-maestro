import { describe, it, expect } from "vitest";
import { validateBranchName } from "../components/maestro/GitPanel";

describe("validateBranchName", () => {
  it("accepts valid branch names", () => {
    for (const name of ["maestro/feature-abcd", "fix/bug-123", "release_2.0", "main"]) {
      expect(validateBranchName(name)).toBeUndefined();
    }
  });

  it("accepts names after trimming surrounding whitespace", () => {
    expect(validateBranchName("  feature/trimmed  ")).toBeUndefined();
  });

  it("rejects empty names", () => {
    expect(validateBranchName("")).toBe("Branch name cannot be empty");
    expect(validateBranchName("   ")).toBe("Branch name cannot be empty");
  });

  it("rejects names with spaces", () => {
    expect(validateBranchName("has spaces")).toBe("Branch name cannot contain spaces");
  });

  it("rejects names with invalid characters", () => {
    for (const name of ["with~tilde", "caret^name", "colon:name", "star*name", "question?mark"]) {
      expect(validateBranchName(name)).toBe("Branch name contains invalid characters");
    }
  });

  it("rejects names that break git ref rules", () => {
    for (const name of ["foo..bar", "@{weird", "double//slash", "/leading", "trailing/", "ends.", "-leading", "name.lock"]) {
      expect(validateBranchName(name)).toBe("Branch name is not a valid git ref");
    }
  });
});
