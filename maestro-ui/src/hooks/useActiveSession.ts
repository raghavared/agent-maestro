import { useMemo } from "react";
import { TerminalSession } from "../app/types/session";
import { MaestroProject } from "../app/types/maestro";
import { isSshCommandLine, sshTargetFromCommandLine } from "../app/utils/ssh";

interface UseActiveSessionProps {
  sessions: TerminalSession[];
  activeId: string | null;
  projects: MaestroProject[];
  activeProjectId: string;
}

export function useActiveSession({
  sessions,
  activeId,
  projects,
  activeProjectId,
}: UseActiveSessionProps) {
  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  const activeIsSsh = useMemo(() => {
    if (!active) return false;
    return isSshCommandLine(active.launchCommand ?? active.restoreCommand ?? null);
  }, [active]);

  const activeSshTarget = useMemo(() => {
    if (!activeIsSsh || !active) return null;
    const stored = active.sshTarget?.trim() ?? "";
    if (stored) return stored;
    return sshTargetFromCommandLine(active.launchCommand ?? active.restoreCommand ?? null);
  }, [active, activeIsSsh]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  return { active, activeIsSsh, activeSshTarget, activeProject };
}
