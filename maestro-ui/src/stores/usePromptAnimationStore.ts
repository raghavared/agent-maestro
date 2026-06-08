import { create } from 'zustand';

export type PromptSurface = 'tree' | 'rail' | 'bar';

export interface PromptAnimation {
  id: string;
  surface: PromptSurface;
  senderMaestroSessionId: string | null;
  targetMaestroSessionId: string;
  senderProjectId?: string | null;
  targetProjectId?: string | null;
  content: string;
  accent?: string; // sender team color, hex
  senderName?: string;
  targetName?: string;
  senderInitial?: string; // for rail puck
  edgeTravel?: boolean; // tree: sender/target are a parent/child pair
  direction?: 'forward' | 'reply';
  timestamp: number;
}

interface PromptAnimationState {
  animations: PromptAnimation[];
  addAnimation: (anim: Omit<PromptAnimation, 'id' | 'timestamp'>) => void;
  removeAnimation: (id: string) => void;
}

// Cap concurrent packets to avoid a visual storm during coordinator fan-out.
const MAX_ACTIVE = 6;
const AUTO_REMOVE_MS = 1500;

let nextId = 0;

/**
 * Decide which surface a message animates on, given the sender/target projects.
 * - `bar`  → different projects (animate along the top project bar)
 * - `rail` → same project and the Spaces rail is visible (animate in the rail)
 * - `tree` → same project, rail not visible (animate in the session tree)
 */
export function selectPromptSurface(
  senderProjectId: string | null | undefined,
  targetProjectId: string | null | undefined,
  railVisible: boolean,
): PromptSurface {
  if (senderProjectId && targetProjectId && senderProjectId !== targetProjectId) {
    return 'bar';
  }
  return railVisible ? 'rail' : 'tree';
}

export const usePromptAnimationStore = create<PromptAnimationState>((set) => ({
  animations: [],
  addAnimation: (anim) => {
    const id = `prompt-anim-${++nextId}`;
    set((prev) => {
      const next = [...prev.animations, { ...anim, id, timestamp: Date.now() }];
      // Drop oldest beyond the concurrency cap.
      return { animations: next.length > MAX_ACTIVE ? next.slice(next.length - MAX_ACTIVE) : next };
    });
    // Auto-remove after the animation completes (travel + buffer).
    setTimeout(() => {
      set((prev) => ({
        animations: prev.animations.filter((a) => a.id !== id),
      }));
    }, AUTO_REMOVE_MS);
  },
  removeAnimation: (id) => {
    set((prev) => ({
      animations: prev.animations.filter((a) => a.id !== id),
    }));
  },
}));
