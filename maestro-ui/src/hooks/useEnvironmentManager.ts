import { useState, useRef, Dispatch, SetStateAction } from "react";
import { EnvironmentConfig } from "../app/types/app";
import { MaestroProject } from "../app/types/maestro";
import { makeId } from "../app/utils/id";

interface UseEnvironmentManagerProps {
    projects: MaestroProject[];
    setProjects: Dispatch<SetStateAction<MaestroProject[]>>;
    projectEnvironmentId: string;
    setProjectEnvironmentId: Dispatch<SetStateAction<string>>;
    showNotice: (message: string, duration?: number) => void;
}

export function useEnvironmentManager({
    projects,
    setProjects,
    projectEnvironmentId,
    setProjectEnvironmentId,
    showNotice,
}: UseEnvironmentManagerProps) {
    const [environments, setEnvironments] = useState<EnvironmentConfig[]>([]);
    const [environmentsOpen, setEnvironmentsOpen] = useState(false);
    const [environmentEditorOpen, setEnvironmentEditorOpen] = useState(false);
    const [environmentEditorId, setEnvironmentEditorId] = useState<string | null>(null);
    const [environmentEditorName, setEnvironmentEditorName] = useState("");
    const [environmentEditorContent, setEnvironmentEditorContent] = useState("");
    const [environmentEditorLocked, setEnvironmentEditorLocked] = useState(false);
    const [confirmDeleteEnvironmentId, setConfirmDeleteEnvironmentId] = useState<string | null>(null);

    const envNameRef = useRef<HTMLInputElement | null>(null);

    function openEnvironmentEditor(env?: EnvironmentConfig) {
        setEnvironmentsOpen(false);
        setEnvironmentEditorId(env?.id ?? null);
        setEnvironmentEditorName(env?.name ?? "");
        const locked = Boolean((env?.content ?? "").trimStart().startsWith("enc:v1:"));
        setEnvironmentEditorLocked(locked);
        setEnvironmentEditorContent(locked ? "" : env?.content ?? "");
        setEnvironmentEditorOpen(true);
        window.setTimeout(() => envNameRef.current?.focus(), 0);
    }

    function closeEnvironmentEditor() {
        setEnvironmentEditorOpen(false);
        setEnvironmentEditorId(null);
        setEnvironmentEditorName("");
        setEnvironmentEditorContent("");
        setEnvironmentEditorLocked(false);
    }

    function saveEnvironmentFromEditor() {
        if (environmentEditorLocked) return;
        const name = environmentEditorName.trim();
        if (!name) return;
        const content = environmentEditorContent;
        const now = Date.now();
        const id = environmentEditorId ?? makeId();
        const next: EnvironmentConfig = { id, name, content, createdAt: now };

        setEnvironments((prev) => {
            if (!environmentEditorId) return [...prev, next].sort((a, b) => b.createdAt - a.createdAt);
            return prev
                .map((e) => (e.id === environmentEditorId ? { ...e, name, content } : e))
                .sort((a, b) => b.createdAt - a.createdAt);
        });
        closeEnvironmentEditor();
    }

    function requestDeleteEnvironment(id: string) {
        setConfirmDeleteEnvironmentId(id);
    }

    function confirmDeleteEnvironment() {
        const id = confirmDeleteEnvironmentId;
        setConfirmDeleteEnvironmentId(null);
        if (!id) return;

        const env = environments.find((e) => e.id === id);
        const label = env?.name?.trim() ? env.name.trim() : "environment";

        if (environmentEditorId === id) closeEnvironmentEditor();
        setEnvironments((prev) => prev.filter((e) => e.id !== id));
        setProjects((prev) =>
            prev.map((p) => (p.environmentId === id ? { ...p, environmentId: null } : p)),
        );
        if (projectEnvironmentId === id) setProjectEnvironmentId("");
        showNotice(`Deleted environment "${label}"`);
    }

    return {
        environments,
        setEnvironments,
        environmentsOpen,
        setEnvironmentsOpen,
        environmentEditorOpen,
        setEnvironmentEditorOpen,
        environmentEditorId,
        setEnvironmentEditorId,
        environmentEditorName,
        setEnvironmentEditorName,
        environmentEditorContent,
        setEnvironmentEditorContent,
        environmentEditorLocked,
        setEnvironmentEditorLocked,
        confirmDeleteEnvironmentId,
        setConfirmDeleteEnvironmentId,
        envNameRef,
        openEnvironmentEditor,
        closeEnvironmentEditor,
        saveEnvironmentFromEditor,
        requestDeleteEnvironment,
        confirmDeleteEnvironment,
    };
}
