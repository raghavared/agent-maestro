import { describe, it, expect } from "vitest";
import { resolveTeamView, buildHasChildrenPredicate } from "../utils/resolveTeamView";
import type { MaestroSession } from "../app/types/maestro";

function makeSession(overrides: Partial<MaestroSession> = {}): MaestroSession {
  return {
    id: "ms-1",
    projectId: "proj-1",
    status: "working",
    mode: "worker",
    startedAt: 0,
    ...overrides,
  } as MaestroSession;
}

function toMap(sessions: MaestroSession[]): Record<string, MaestroSession> {
  return Object.fromEntries(sessions.map((s) => [s.id, s]));
}

describe("resolveTeamView", () => {
  it("returns null when rootId is null", () => {
    expect(resolveTeamView(null, {})).toBeNull();
  });

  it("returns null when the root no longer resolves", () => {
    const map = toMap([makeSession({ id: "a" })]);
    expect(resolveTeamView("missing", map)).toBeNull();
  });

  it("resolves depth-1: root with direct children, ordered by startedAt", () => {
    const root = makeSession({ id: "root", startedAt: 100 });
    const c1 = makeSession({ id: "c1", parentSessionId: "root", startedAt: 30 });
    const c2 = makeSession({ id: "c2", parentSessionId: "root", startedAt: 10 });
    const map = toMap([root, c1, c2]);

    const result = resolveTeamView("root", map);
    expect(result).not.toBeNull();
    expect(result!.root.id).toBe("root");
    // ordered by startedAt ascending: c2 (10) before c1 (30)
    expect(result!.children.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(result!.trail.map((t) => t.id)).toEqual(["root"]);
  });

  it("builds the full breadcrumb trail for depth-N (rooted at a mid node)", () => {
    const top = makeSession({ id: "top" });
    const mid = makeSession({ id: "mid", parentSessionId: "top" });
    const leaf = makeSession({ id: "leaf", parentSessionId: "mid" });
    const grandchild = makeSession({ id: "gc", parentSessionId: "leaf" });
    const map = toMap([top, mid, leaf, grandchild]);

    const result = resolveTeamView("leaf", map);
    expect(result!.trail.map((t) => t.id)).toEqual(["top", "mid", "leaf"]);
    expect(result!.children.map((c) => c.id)).toEqual(["gc"]);
  });

  it("is cycle-safe in the breadcrumb walk", () => {
    const a = makeSession({ id: "a", parentSessionId: "b" });
    const b = makeSession({ id: "b", parentSessionId: "a" });
    const map = toMap([a, b]);

    const result = resolveTeamView("a", map);
    expect(result).not.toBeNull();
    // walk stops once it revisits a seen node — both appear at most once
    expect(result!.trail.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("stops the breadcrumb when a parent isn't loaded", () => {
    const child = makeSession({ id: "child", parentSessionId: "absent-parent" });
    const map = toMap([child]);

    const result = resolveTeamView("child", map);
    expect(result!.trail.map((t) => t.id)).toEqual(["child"]);
  });

  it("returns an empty children list for a leaf root", () => {
    const leaf = makeSession({ id: "leaf" });
    const map = toMap([leaf]);
    const result = resolveTeamView("leaf", map);
    expect(result!.children).toEqual([]);
  });
});

describe("buildHasChildrenPredicate", () => {
  it("reports true only for sessions that are a parent of another", () => {
    const root = makeSession({ id: "root" });
    const child = makeSession({ id: "child", parentSessionId: "root" });
    const leaf = makeSession({ id: "leaf", parentSessionId: "child" });
    const map = toMap([root, child, leaf]);

    const hasChildren = buildHasChildrenPredicate(map);
    expect(hasChildren("root")).toBe(true);
    expect(hasChildren("child")).toBe(true);
    expect(hasChildren("leaf")).toBe(false);
    expect(hasChildren("unknown")).toBe(false);
  });
});
