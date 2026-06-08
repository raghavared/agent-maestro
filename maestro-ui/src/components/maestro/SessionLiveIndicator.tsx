import React from "react";
import { useSessionStore } from "../../stores/useSessionStore";
import type { MaestroSessionStatus } from "../../app/types/maestro";

interface SessionLiveIndicatorProps {
  maestroSessionId: string;
  status: MaestroSessionStatus;
  needsInput?: boolean;
  showLabel?: boolean;
}

// Surfaces real-time PTY activity for a maestro session. The authoritative
// "terminal is producing output right now" signal is `agentWorking` on the
// linked terminal session (toggled from raw pty-output with a 2s idle debounce
// in useSessionStore). Sessions with no local terminal attached (e.g. remote or
// coordinator sessions) fall back to the server-synced `status` field.
export function SessionLiveIndicator({
  maestroSessionId,
  status,
  needsInput = false,
  showLabel = true,
}: SessionLiveIndicatorProps) {
  const terminalLive = useSessionStore((s) => {
    const terminal = s.sessions.find((t) => t.maestroSessionId === maestroSessionId);
    if (!terminal) return null;
    if (terminal.exited || terminal.closing) return false;
    return Boolean(terminal.agentWorking);
  });

  // Only a terminal actively streaming bytes pulses. A session that is "working"
  // by server status but has no bytes flowing right now is a still dot.
  const streaming = terminalLive === true;
  const hasTerminal = terminalLive !== null;
  const isWorking = hasTerminal ? terminalLive : status === "working";

  const state = needsInput ? "needsInput" : isWorking ? "working" : "idle";
  const label = needsInput ? "Needs input" : streaming ? "Live" : isWorking ? "Working" : "Idle";

  return (
    <span className="sessionLiveIndicator" title={`Terminal ${label.toLowerCase()}`}>
      <span
        className={`sessionLiveIndicator__dot sessionLiveIndicator__dot--${state}${streaming ? " sessionLiveIndicator__dot--streaming" : ""}`}
      />
      {showLabel && <span className="sessionLiveIndicator__label">{label}</span>}
    </span>
  );
}
