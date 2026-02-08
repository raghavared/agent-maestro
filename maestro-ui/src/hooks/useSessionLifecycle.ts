import { useRef, useCallback, MutableRefObject } from "react";
import { TerminalSession } from "../app/types/session";
import {
  detectProcessEffect,
  getProcessEffectById,
} from "../processEffects";
import { hasMeaningfulOutput } from "../services/terminalService";

interface UseSessionLifecycleProps {
  sessions: TerminalSession[];
  setSessions: React.Dispatch<React.SetStateAction<TerminalSession[]>>;
  sessionsRef: MutableRefObject<TerminalSession[]>;
  activeIdRef: MutableRefObject<string | null>;
}

export function useSessionLifecycle({
  setSessions,
  sessionsRef,
  activeIdRef,
}: UseSessionLifecycleProps) {
  const agentIdleTimersRef = useRef<Map<string, number>>(new Map());
  const commandLifecycleSessionsRef = useRef<Set<string>>(new Set());
  const lastResizeAtRef = useRef<Map<string, number>>(new Map());

  const RESIZE_OUTPUT_SUPPRESS_MS = 900;

  function clearAgentIdleTimer(id: string) {
    const existing = agentIdleTimersRef.current.get(id);
    if (existing !== undefined) {
      window.clearTimeout(existing);
      agentIdleTimersRef.current.delete(id);
    }
  }

  function scheduleAgentIdle(id: string, effectId: string | null) {
    clearAgentIdleTimer(id);
    if (!effectId) return;
    const effect = getProcessEffectById(effectId);
    const idleAfterMs = effect?.idleAfterMs ?? 2000;
    const timeout = window.setTimeout(() => {
      agentIdleTimersRef.current.delete(id);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          if (!s.agentWorking) return s;
          return { ...s, agentWorking: false };
        }),
      );
    }, idleAfterMs);
    agentIdleTimersRef.current.set(id, timeout);
  }

  function markAgentWorkingFromOutput(id: string, data: string) {
    const session = sessionsRef.current.find((s) => s.id === id);
    if (!session) return;
    if (!session.effectId || session.exited || session.closing) return;

    if (!data) return;

    const lastResizeAt = lastResizeAtRef.current.get(id);
    if (lastResizeAt !== undefined && Date.now() - lastResizeAt < RESIZE_OUTPUT_SUPPRESS_MS) {
      return;
    }
    if (!hasMeaningfulOutput(data)) return;

    if (session.persistent && !session.agentWorking && activeIdRef.current !== id) return;

    if (!session.agentWorking) {
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, agentWorking: true } : s)));
    }
    scheduleAgentIdle(id, session.effectId);
  }

  const onSessionResize = useCallback((id: string) => {
    lastResizeAtRef.current.set(id, Date.now());
  }, []);

  function onCwdChange(id: string, cwd: string) {
    const trimmed = cwd.trim();
    if (!trimmed) return;

    commandLifecycleSessionsRef.current.add(id);
    clearAgentIdleTimer(id);

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const nextCwd = s.cwd !== trimmed ? trimmed : s.cwd;
        if (nextCwd === s.cwd && !s.agentWorking && !s.effectId) return s;
        return { ...s, cwd: nextCwd, effectId: null, agentWorking: false, processTag: null };
      }),
    );
  }

  function onCommandChange(id: string, commandLine: string, source: "osc" | "input" = "input") {
    const trimmed = commandLine.trim();

    if (source === "osc") {
      commandLifecycleSessionsRef.current.add(id);

      if (!trimmed) {
        clearAgentIdleTimer(id);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s;
            if (!s.effectId && !s.agentWorking) return s;
            return { ...s, effectId: null, agentWorking: false, processTag: null };
          }),
        );
        return;
      }

      const effect = detectProcessEffect({ command: trimmed, name: null });
      const nextEffectId = effect?.id ?? null;
      clearAgentIdleTimer(id);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const nextRestoreCommand = effect && !s.persistent ? trimmed : null;
          if (
            s.effectId === nextEffectId &&
            (s.restoreCommand ?? null) === nextRestoreCommand &&
            !s.agentWorking
          ) {
            return s;
          }
          return {
            ...s,
            effectId: nextEffectId,
            agentWorking: false,
            restoreCommand: nextRestoreCommand,
            processTag: null,
          };
        }),
      );
      return;
    }

    if (commandLifecycleSessionsRef.current.has(id)) return;
    if (!trimmed) return;

    const effect = detectProcessEffect({ command: trimmed, name: null });
    const nextEffectId = effect?.id ?? null;
    clearAgentIdleTimer(id);
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const nextRestoreCommand = effect && !s.persistent ? trimmed : null;
        if (s.effectId === nextEffectId && (s.restoreCommand ?? null) === nextRestoreCommand && !s.agentWorking)
          return s;
        return {
          ...s,
          effectId: nextEffectId,
          agentWorking: false,
          restoreCommand: nextRestoreCommand,
          processTag: null,
        };
      }),
    );
  }

  return {
    onCwdChange,
    onCommandChange,
    onSessionResize,
    clearAgentIdleTimer,
    markAgentWorkingFromOutput,
    lastResizeAtRef,
    agentIdleTimersRef,
    commandLifecycleSessionsRef,
  };
}
