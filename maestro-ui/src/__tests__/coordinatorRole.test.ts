import { describe, it, expect, beforeEach } from "vitest";
import { isCoordinatorRole } from "../utils/coordinatorRole";
import { useMaestroStore } from "../stores/useMaestroStore";
import type { MaestroSession } from "../app/types/maestro";

// ─── isCoordinatorRole truth table ───────────────────────────────────────────

describe("isCoordinatorRole", () => {
  it("returns true for 'coordinator'", () => {
    expect(isCoordinatorRole("coordinator")).toBe(true);
  });

  it("returns true for 'coordinated-coordinator'", () => {
    expect(isCoordinatorRole("coordinated-coordinator")).toBe(true);
  });

  it("returns false for 'worker'", () => {
    expect(isCoordinatorRole("worker")).toBe(false);
  });

  it("returns false for 'coordinated-worker'", () => {
    expect(isCoordinatorRole("coordinated-worker")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isCoordinatorRole(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCoordinatorRole(null)).toBe(false);
  });
});

// ─── Store: session:mode_changed updates sessions[id].mode ───────────────────

function makeSession(overrides: Partial<MaestroSession> = {}): MaestroSession {
  return {
    id: "sess-1",
    projectId: "proj-1",
    taskIds: [],
    name: "test session",
    env: {},
    status: "idle",
    startedAt: Date.now(),
    lastActivity: Date.now(),
    completedAt: null,
    hostname: "localhost",
    platform: "darwin",
    events: [],
    timeline: [],
    mode: "worker",
    ...overrides,
  };
}

describe("useMaestroStore.updateSessionMode", () => {
  beforeEach(() => {
    useMaestroStore.setState({ sessions: {} });
  });

  it("patches sessions[id].mode when the session exists", () => {
    const session = makeSession({ id: "sess-1", mode: "worker" });
    useMaestroStore.setState({ sessions: { "sess-1": session } });

    useMaestroStore.getState().updateSessionMode("sess-1", "coordinator");

    expect(useMaestroStore.getState().sessions["sess-1"].mode).toBe("coordinator");
  });

  it("preserves other session fields when patching mode", () => {
    const session = makeSession({ id: "sess-1", name: "my session", mode: "worker" });
    useMaestroStore.setState({ sessions: { "sess-1": session } });

    useMaestroStore.getState().updateSessionMode("sess-1", "coordinated-coordinator");

    const updated = useMaestroStore.getState().sessions["sess-1"];
    expect(updated.mode).toBe("coordinated-coordinator");
    expect(updated.name).toBe("my session");
    expect(updated.projectId).toBe("proj-1");
  });

  it("is a no-op when the session does not exist", () => {
    useMaestroStore.setState({ sessions: {} });
    useMaestroStore.getState().updateSessionMode("nonexistent", "coordinator");
    expect(useMaestroStore.getState().sessions["nonexistent"]).toBeUndefined();
  });

  it("supports demotion from coordinator back to worker", () => {
    const session = makeSession({ id: "sess-1", mode: "coordinator" });
    useMaestroStore.setState({ sessions: { "sess-1": session } });

    useMaestroStore.getState().updateSessionMode("sess-1", "worker");

    expect(useMaestroStore.getState().sessions["sess-1"].mode).toBe("worker");
  });
});
