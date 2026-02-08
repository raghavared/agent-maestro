import { useMemo } from "react";
import { TerminalSession } from "../app/types/session";
import { isSshCommandLine, sshTargetFromCommandLine } from "../app/utils/ssh";

export function useActive({
    sessions,
    activeId,
    activeProjectId,
}: {
    sessions: TerminalSession[];
    activeId: string;
    activeProjectId: string;
}) {
    const active = useMemo(() => {
        return sessions.find((s) => s.id === activeId) ?? null;
    }, [sessions, activeId]);

    const activeIsSsh = useMemo(() => {
        if (!active) return false;
        return isSshCommandLine(active.launchCommand ?? active.restoreCommand ?? null);
    }, [active]);

    const activeSshTarget = useMemo(() => {
        if (!activeIsSsh || !active) return null;
        return active.sshTarget?.trim() ?? sshTargetFromCommandLine(active.launchCommand ?? active.restoreCommand ?? null);
    }, [active, activeIsSsh]);

    return {
        active,
        activeIsSsh,
        activeSshTarget,
    };
}