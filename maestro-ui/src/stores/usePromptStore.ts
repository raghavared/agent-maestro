import { create } from 'zustand';
import { makeId } from '../app/utils/id';
import type { Prompt } from '../app/types/app-state';
import { useUIStore } from './useUIStore';

interface PromptState {
  prompts: Prompt[];
  promptsOpen: boolean;
  promptEditorOpen: boolean;
  promptEditorId: string | null;
  promptEditorTitle: string;
  promptEditorContent: string;
  confirmDeletePromptId: string | null;
  setPrompts: (prompts: Prompt[] | ((prev: Prompt[]) => Prompt[])) => void;
  setPromptsOpen: (open: boolean) => void;
  setPromptEditorOpen: (open: boolean) => void;
  setPromptEditorId: (id: string | null) => void;
  setPromptEditorTitle: (title: string) => void;
  setPromptEditorContent: (content: string) => void;
  setConfirmDeletePromptId: (id: string | null) => void;
  openPromptEditor: (prompt?: Prompt) => void;
  closePromptEditor: () => void;
  savePromptFromEditor: () => void;
  requestDeletePrompt: (id: string) => void;
  confirmDeletePrompt: () => void;
  togglePromptPin: (id: string) => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  promptsOpen: false,
  promptEditorOpen: false,
  promptEditorId: null,
  promptEditorTitle: '',
  promptEditorContent: '',
  confirmDeletePromptId: null,
  setPrompts: (prompts) =>
    set((state) => ({
      prompts: typeof prompts === 'function' ? prompts(state.prompts) : prompts,
    })),
  setPromptsOpen: (open) => set({ promptsOpen: open }),
  setPromptEditorOpen: (open) => set({ promptEditorOpen: open }),
  setPromptEditorId: (id) => set({ promptEditorId: id }),
  setPromptEditorTitle: (title) => set({ promptEditorTitle: title }),
  setPromptEditorContent: (content) => set({ promptEditorContent: content }),
  setConfirmDeletePromptId: (id) => set({ confirmDeletePromptId: id }),
  openPromptEditor: (prompt) => {
    set({
      promptsOpen: false,
      promptEditorId: prompt?.id ?? null,
      promptEditorTitle: prompt?.title ?? '',
      promptEditorContent: prompt?.content ?? '',
      promptEditorOpen: true,
    });
  },
  closePromptEditor: () => {
    set({
      promptEditorOpen: false,
      promptEditorId: null,
      promptEditorTitle: '',
      promptEditorContent: '',
    });
  },
  savePromptFromEditor: () => {
    const { promptEditorTitle, promptEditorContent, promptEditorId, prompts } = get();
    const title = promptEditorTitle.trim();
    if (!title) return;
    const content = promptEditorContent;
    const now = Date.now();
    const id = promptEditorId ?? makeId();
    const next: Prompt = { id, title, content, createdAt: now };

    const updated = promptEditorId
      ? prompts
          .map((p) => (p.id === promptEditorId ? { ...p, title, content } : p))
          .sort((a, b) => b.createdAt - a.createdAt)
      : [...prompts, next].sort((a, b) => b.createdAt - a.createdAt);

    set({
      prompts: updated,
      promptEditorOpen: false,
      promptEditorId: null,
      promptEditorTitle: '',
      promptEditorContent: '',
    });
  },
  requestDeletePrompt: (id) => set({ confirmDeletePromptId: id }),
  confirmDeletePrompt: () => {
    const { confirmDeletePromptId: id, prompts, promptEditorId } = get();
    if (!id) return;

    const prompt = prompts.find((p) => p.id === id);
    const label = prompt?.title?.trim() ? prompt.title.trim() : 'prompt';

    const updates: Partial<PromptState> = {
      confirmDeletePromptId: null,
      prompts: prompts.filter((p) => p.id !== id),
    };
    if (promptEditorId === id) {
      updates.promptEditorOpen = false;
      updates.promptEditorId = null;
      updates.promptEditorTitle = '';
      updates.promptEditorContent = '';
    }
    set(updates as PromptState);

    // Cross-store: show notice
    try {
      useUIStore.getState().showNotice(`Deleted prompt "${label}"`);
    } catch {
      // best-effort
    }
  },
  togglePromptPin: (id) =>
    set((state) => {
      const prompt = state.prompts.find((p) => p.id === id);
      if (!prompt) return state;

      if (prompt.pinned) {
        return {
          prompts: state.prompts.map((p) =>
            p.id === id ? { ...p, pinned: false, pinOrder: undefined } : p,
          ),
        };
      }

      const maxPinOrder = Math.max(
        0,
        ...state.prompts.filter((p) => p.pinned).map((p) => p.pinOrder ?? 0),
      );
      return {
        prompts: state.prompts.map((p) =>
          p.id === id ? { ...p, pinned: true, pinOrder: maxPinOrder + 1 } : p,
        ),
      };
    }),
}));
