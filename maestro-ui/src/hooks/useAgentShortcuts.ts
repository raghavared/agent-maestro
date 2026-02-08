import { useState, useCallback } from "react";
import * as DEFAULTS from "../app/constants/defaults";
import { cleanAgentShortcutIds } from "../utils/formatters";

export function useAgentShortcuts() {
  const [agentShortcutIds, setAgentShortcutIds] = useState<string[]>(DEFAULTS.DEFAULT_AGENT_SHORTCUT_IDS);
  const [agentShortcutsOpen, setAgentShortcutsOpen] = useState(false);

  const addAgentShortcut = useCallback((id: string) => {
    setAgentShortcutIds((prev) => cleanAgentShortcutIds([...prev, id]));
  }, []);

  const removeAgentShortcut = useCallback((id: string) => {
    setAgentShortcutIds((prev) => cleanAgentShortcutIds(prev.filter((x) => x !== id)));
  }, []);

  const moveAgentShortcut = useCallback((id: string, direction: -1 | 1) => {
    setAgentShortcutIds((prev) => {
      const cleaned = cleanAgentShortcutIds(prev);
      const index = cleaned.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0) return cleaned;
      if (nextIndex < 0 || nextIndex >= cleaned.length) return cleaned;
      const next = cleaned.slice();
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }, []);

  const resetAgentShortcuts = useCallback(() => {
    setAgentShortcutIds(cleanAgentShortcutIds(DEFAULTS.DEFAULT_AGENT_SHORTCUT_IDS));
  }, []);

  return {
    agentShortcutIds,
    setAgentShortcutIds,
    agentShortcutsOpen,
    setAgentShortcutsOpen,
    addAgentShortcut,
    removeAgentShortcut,
    moveAgentShortcut,
    resetAgentShortcuts,
  };
}
