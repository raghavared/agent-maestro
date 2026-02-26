import { describe, it, expect } from "vitest";
import { buildTeamGroups, getGroupedSessionOrder } from "../utils/teamGrouping";
import type { MaestroSession } from "../app/types/maestro";
import { TEAM_COLORS } from "../app/constants/teamColors";

function makeMaestroSession(overrides: Partial<MaestroSession> = {}): MaestroSession {
  return {
    id: "ms-1",
    projectId: "proj-1",
    status: "working",
    mode: "worker",
    ...overrides,
  } as MaestroSession;
}

describe("buildTeamGroups", () => {
  it("returns empty groups when no sessions", () => {
    const { groups, sessionColorMap } = buildTeamGroups([], new Map());
    expect(groups).toHaveLength(0);
    expect(sessionColorMap.size).toBe(0);
  });

  it("groups sessions by teamSessionId", () => {
    const localSessions = [
      { id: "ls-1", maestroSessionId: "ms-coord" },
      { id: "ls-2", maestroSessionId: "ms-worker" },
    ];
    const maestroSessions = new Map<string, MaestroSession>([
      ["ms-coord", makeMaestroSession({ id: "ms-coord", mode: "coordinator", teamSessionId: "ms-coord" })],
      ["ms-worker", makeMaestroSession({ id: "ms-worker", mode: "worker", teamSessionId: "ms-coord" })],
    ]);

    const { groups } = buildTeamGroups(localSessions, maestroSessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].coordinatorMaestroSessionId).toBe("ms-coord");
    expect(groups[0].workerMaestroSessionIds).toContain("ms-worker");
    expect(groups[0].coordinatorLocalSessionId).toBe("ls-1");
    expect(groups[0].workerLocalSessionIds).toContain("ls-2");
  });

  it("falls back to spawnedBy grouping", () => {
    const localSessions = [
      { id: "ls-1", maestroSessionId: "ms-coord" },
      { id: "ls-2", maestroSessionId: "ms-worker" },
    ];
    const maestroSessions = new Map<string, MaestroSession>([
      ["ms-coord", makeMaestroSession({ id: "ms-coord", mode: "coordinator" })],
      ["ms-worker", makeMaestroSession({ id: "ms-worker", mode: "worker", spawnedBy: "ms-coord" })],
    ]);

    const { groups } = buildTeamGroups(localSessions, maestroSessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].workerMaestroSessionIds).toContain("ms-worker");
  });

  it("assigns colors to groups", () => {
    const localSessions = [{ id: "ls-1", maestroSessionId: "ms-coord" }];
    const maestroSessions = new Map<string, MaestroSession>([
      ["ms-coord", makeMaestroSession({ id: "ms-coord", mode: "coordinator", teamSessionId: "ms-coord" })],
    ]);

    const { groups, sessionColorMap } = buildTeamGroups(localSessions, maestroSessions);
    expect(groups[0].color).toBeDefined();
    expect(sessionColorMap.get("ls-1")).toBeDefined();
    expect(sessionColorMap.get("ls-1")?.isCoordinator).toBe(true);
  });
});

describe("getGroupedSessionOrder", () => {
  it("groups sessions and separates ungrouped", () => {
    const sessions = [
      { id: "ls-1" },
      { id: "ls-2" },
      { id: "ls-3" },
    ];
    const groups = [{
      coordinatorMaestroSessionId: "ms-1",
      coordinatorLocalSessionId: "ls-1",
      teamSessionId: "ms-1",
      workerLocalSessionIds: ["ls-2"],
      workerMaestroSessionIds: ["ms-2"],
      color: TEAM_COLORS[0],
      status: "active" as const,
    }];

    const result = getGroupedSessionOrder(sessions, groups);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[0].sessions.map(s => s.id)).toEqual(["ls-1", "ls-2"]);
    expect(result.ungrouped.map(s => s.id)).toEqual(["ls-3"]);
  });
});
