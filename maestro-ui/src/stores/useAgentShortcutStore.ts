import { create } from 'zustand';
import * as DEFAULTS from '../app/constants/defaults';
import { cleanAgentShortcutIds } from '../utils/formatters';

interface AgentShortcutState {
  agentShortcutIds: string[];
  agentShortcutsOpen: boolean;
  setAgentShortcutIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setAgentShortcutsOpen: (open: boolean) => void;
  addAgentShortcut: (id: string) => void;
  removeAgentShortcut: (id: string) => void;
  moveAgentShortcut: (id: string, direction: -1 | 1) => void;
  resetAgentShortcuts: () => void;
}

export const useAgentShortcutStore = create<AgentShortcutState>((set) => ({
  agentShortcutIds: DEFAULTS.DEFAULT_AGENT_SHORTCUT_IDS,
  agentShortcutsOpen: false,
  setAgentShortcutIds: (ids) =>
    set((state) => ({
      agentShortcutIds: typeof ids === 'function' ? ids(state.agentShortcutIds) : ids,
    })),
  setAgentShortcutsOpen: (open) => set({ agentShortcutsOpen: open }),
  addAgentShortcut: (id) =>
    set((state) => ({
      agentShortcutIds: cleanAgentShortcutIds([...state.agentShortcutIds, id]),
    })),
  removeAgentShortcut: (id) =>
    set((state) => ({
      agentShortcutIds: cleanAgentShortcutIds(state.agentShortcutIds.filter((x) => x !== id)),
    })),
  moveAgentShortcut: (id, direction) =>
    set((state) => {
      const cleaned = cleanAgentShortcutIds(state.agentShortcutIds);
      const index = cleaned.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= cleaned.length) {
        return { agentShortcutIds: cleaned };
      }
      const next = cleaned.slice();
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return { agentShortcutIds: next };
    }),
  resetAgentShortcuts: () =>
    set({
      agentShortcutIds: cleanAgentShortcutIds(DEFAULTS.DEFAULT_AGENT_SHORTCUT_IDS),
    }),
}));
