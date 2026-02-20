import { create } from 'zustand';

export interface PromptAnimation {
  id: string;
  senderMaestroSessionId: string | null;
  targetMaestroSessionId: string;
  content: string;
  timestamp: number;
}

interface PromptAnimationState {
  animations: PromptAnimation[];
  addAnimation: (anim: Omit<PromptAnimation, 'id' | 'timestamp'>) => void;
  removeAnimation: (id: string) => void;
}

let nextId = 0;

export const usePromptAnimationStore = create<PromptAnimationState>((set) => ({
  animations: [],
  addAnimation: (anim) => {
    const id = `prompt-anim-${++nextId}`;
    set((prev) => ({
      animations: [...prev.animations, { ...anim, id, timestamp: Date.now() }],
    }));
    // Auto-remove after animation completes (1.2s animation + buffer)
    setTimeout(() => {
      set((prev) => ({
        animations: prev.animations.filter((a) => a.id !== id),
      }));
    }, 1500);
  },
  removeAnimation: (id) => {
    set((prev) => ({
      animations: prev.animations.filter((a) => a.id !== id),
    }));
  },
}));
