import { useState, useRef, RefObject } from "react";
import { makeId } from "../app/utils/id";
import type { Prompt } from "../app/types/app-state";

interface UsePromptManagerProps {
    showNotice: (message: string, timeoutMs?: number) => void;
}

export function usePromptManager({ showNotice }: UsePromptManagerProps) {
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [promptsOpen, setPromptsOpen] = useState(false);
    const [promptEditorOpen, setPromptEditorOpen] = useState(false);
    const [promptEditorId, setPromptEditorId] = useState<string | null>(null);
    const [promptEditorTitle, setPromptEditorTitle] = useState("");
    const [promptEditorContent, setPromptEditorContent] = useState("");
    const [confirmDeletePromptId, setConfirmDeletePromptId] = useState<string | null>(null);

    const promptTitleRef = useRef<HTMLInputElement | null>(null);

    function openPromptEditor(prompt?: Prompt) {
        setPromptsOpen(false);
        setPromptEditorId(prompt?.id ?? null);
        setPromptEditorTitle(prompt?.title ?? "");
        setPromptEditorContent(prompt?.content ?? "");
        setPromptEditorOpen(true);
        // Use a small timeout to allow layout to settle before focusing
        window.setTimeout(() => promptTitleRef.current?.focus(), 0);
    }

    function closePromptEditor() {
        setPromptEditorOpen(false);
        setPromptEditorId(null);
        setPromptEditorTitle("");
        setPromptEditorContent("");
    }

    function savePromptFromEditor() {
        const title = promptEditorTitle.trim();
        if (!title) return;
        const content = promptEditorContent;
        const now = Date.now();
        const id = promptEditorId ?? makeId();
        const next: Prompt = { id, title, content, createdAt: now };

        setPrompts((prev) => {
            if (!promptEditorId) return [...prev, next].sort((a, b) => b.createdAt - a.createdAt);
            return prev
                .map((p) => (p.id === promptEditorId ? { ...p, title, content } : p))
                .sort((a, b) => b.createdAt - a.createdAt);
        });
        closePromptEditor();
    }

    function requestDeletePrompt(id: string) {
        setConfirmDeletePromptId(id);
    }

    function confirmDeletePrompt() {
        const id = confirmDeletePromptId;
        setConfirmDeletePromptId(null);
        if (!id) return;

        const prompt = prompts.find((p) => p.id === id);
        const label = prompt?.title?.trim() ? prompt.title.trim() : "prompt";

        if (promptEditorId === id) closePromptEditor();
        setPrompts((prev) => prev.filter((p) => p.id !== id));
        showNotice(`Deleted prompt "${label}"`);
    }

    function togglePromptPin(id: string) {
        setPrompts((prev) => {
            const prompt = prev.find((p) => p.id === id);
            if (!prompt) return prev;

            if (prompt.pinned) {
                // Unpin: remove pinned status
                return prev.map((p) => (p.id === id ? { ...p, pinned: false, pinOrder: undefined } : p));
            } else {
                // Pin: add to end of pinned list
                const maxPinOrder = Math.max(0, ...prev.filter((p) => p.pinned).map((p) => p.pinOrder ?? 0));
                return prev.map((p) => (p.id === id ? { ...p, pinned: true, pinOrder: maxPinOrder + 1 } : p));
            }
        });
    }

    return {
        prompts,
        setPrompts,
        promptsOpen,
        setPromptsOpen,
        promptEditorOpen,
        setPromptEditorOpen,
        promptEditorId,
        setPromptEditorId,
        promptEditorTitle,
        setPromptEditorTitle,
        promptEditorContent,
        setPromptEditorContent,
        confirmDeletePromptId,
        setConfirmDeletePromptId,
        promptTitleRef,
        openPromptEditor,
        closePromptEditor,
        savePromptFromEditor,
        requestDeletePrompt,
        confirmDeletePrompt,
        togglePromptPin,
    };
}
