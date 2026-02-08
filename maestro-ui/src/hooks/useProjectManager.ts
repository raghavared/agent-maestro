import { useState, useRef, useEffect, MutableRefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MaestroProject } from "../app/types/maestro";
import { TerminalSession } from "../app/types/session";
import { EnvironmentConfig } from "../app/types/app";
import { defaultProjectState, envVarsForProjectId } from "../app/utils/env";
import * as DEFAULTS from "../app/constants/defaults";
import { maestroClient } from "../utils/MaestroClient";
import { createSession } from "../services/sessionService";

interface UseProjectManagerProps {
    sessions: TerminalSession[];
    setSessions: React.Dispatch<React.SetStateAction<TerminalSession[]>>;
    activeId: string | null;
    setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
    homeDirRef: MutableRefObject<string | null>;
    processNewSession: (session: TerminalSession) => TerminalSession;
    cleanupSessionResources: (sessionId: string) => void;
    showNotice: (message: string, duration?: number) => void;
    reportError: (title: string, error: unknown) => void;
    setError: (error: string | null) => void;
    setNewOpen: (open: boolean) => void;
}

export function useProjectManager({
    sessions,
    setSessions,
    activeId,
    setActiveId,
    homeDirRef,
    processNewSession,
    cleanupSessionResources,
    showNotice,
    reportError,
    setError,
    setNewOpen,
}: UseProjectManagerProps) {
    const [initialProjectState] = useState(() => defaultProjectState());
    const [projects, setProjects] = useState<MaestroProject[]>(initialProjectState.projects);
    const [activeProjectId, setActiveProjectId] = useState<string>(initialProjectState.activeProjectId);
    const [activeSessionByProject, setActiveSessionByProject] = useState<Record<string, string>>({});

    // Project Modal State
    const [projectOpen, setProjectOpen] = useState(false);
    const [projectMode, setProjectMode] = useState<"new" | "rename">("new");
    const [projectTitle, setProjectTitle] = useState("");
    const [projectBasePath, setProjectBasePath] = useState("");
    const [projectEnvironmentId, setProjectEnvironmentId] = useState<string>("");
    const [projectAssetsEnabled, setProjectAssetsEnabled] = useState(true);
    const [confirmDeleteProjectOpen, setConfirmDeleteProjectOpen] = useState(false);

    const projectTitleRef = useRef<HTMLInputElement | null>(null);
    const activeProjectIdRef = useRef<string>(activeProjectId);
    const lastActiveByProject = useRef<Map<string, string>>(new Map());

    // Sync activeProjectIdRef
    useEffect(() => {
        activeProjectIdRef.current = activeProjectId;
    }, [activeProjectId]);

    // Focus project title input
    useEffect(() => {
        if (!projectOpen) return;
        window.setTimeout(() => {
            projectTitleRef.current?.focus();
        }, 0);
    }, [projectOpen]);

    // Persist projects
    useEffect(() => {
        try {
            localStorage.setItem(
                DEFAULTS.STORAGE_PROJECTS_KEY,
                JSON.stringify(projects.map((p) => ({ id: p.id, name: p.name }))),
            );
            localStorage.setItem(DEFAULTS.STORAGE_ACTIVE_PROJECT_KEY, activeProjectId);
        } catch {
            // Best-effort
        }
    }, [activeProjectId, projects]);

    // Track last active session by project
    useEffect(() => {
        if (!activeId) return;
        const s = sessions.find((s) => s.id === activeId);
        if (!s) return;
        lastActiveByProject.current.set(s.projectId, s.id);
        setActiveSessionByProject((prev) => {
            if (prev[s.projectId] === s.persistId) return prev;
            return { ...prev, [s.projectId]: s.persistId };
        });
    }, [activeId, sessions]);

    // Clean up activeSessionByProject when projects change
    useEffect(() => {
        const valid = new Set(projects.map((p) => p.id));
        setActiveSessionByProject((prev) => {
            let changed = false;
            const next: Record<string, string> = {};
            for (const [projectId, persistId] of Object.entries(prev)) {
                if (valid.has(projectId)) next[projectId] = persistId;
                else changed = true;
            }
            return changed ? next : prev;
        });
    }, [projects]);

    function pickActiveSessionId(projectId: string): string | null {
        const last = lastActiveByProject.current.get(projectId);
        if (last && sessions.some((s) => s.id === last)) return last;
        const first = sessions.find((s) => s.projectId === projectId);
        return first ? first.id : null;
    }

    // Ensure active session is valid for project
    useEffect(() => {
        const active = activeId;
        if (active) {
            const session = sessions.find((s) => s.id === active);
            if (session && session.projectId === activeProjectId) return;
        }
        setActiveId(pickActiveSessionId(activeProjectId));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId]);

    function selectProject(projectId: string) {
        setActiveProjectId(projectId);
        setActiveId(pickActiveSessionId(projectId));
    }

    function moveProject(projectId: string, targetProjectId: string, position: "before" | "after") {
        setProjects((prev) => {
            if (projectId === targetProjectId) return prev;
            const project = prev.find((p) => p.id === projectId);
            if (!project) return prev;

            const next = prev.filter((p) => p.id !== projectId);
            const targetIndex = next.findIndex((p) => p.id === targetProjectId);
            if (targetIndex < 0) return prev;
            const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
            next.splice(insertIndex, 0, project);

            const unchanged =
                prev.length === next.length && prev.every((p, index) => p.id === next[index]?.id);
            return unchanged ? prev : next;
        });
    }

    function openNewProject() {
        setNewOpen(false);
        setProjectMode("new");
        setProjectTitle("");
        // We can't access active?.cwd easily here without passing it in or fetching from sessions
        // Using a safe fallback or passing it as argument? 
        // For simplicity, using homeDir ref. The user can browse.
        setProjectBasePath(homeDirRef.current ?? "");
        setProjectEnvironmentId("");
        setProjectAssetsEnabled(true);
        setProjectOpen(true);
    }

    function openProjectSettings(projectId: string) {
        const project = projects.find((p) => p.id === projectId);
        if (!project) return;

        setNewOpen(false);
        setProjectMode("rename");
        setProjectTitle(project.name);
        setProjectBasePath(project.basePath ?? "");
        setProjectEnvironmentId(project.environmentId ?? "");
        setProjectAssetsEnabled(project.assetsEnabled ?? true);
        setProjectOpen(true);
        window.setTimeout(() => projectTitleRef.current?.focus(), 0);
    }

    function openRenameProject() {
        openProjectSettings(activeProjectId);
    }

    async function onProjectSubmit(
        e: React.FormEvent,
        deps: {
            ensureAutoAssets: (baseDir: string, projectId: string, enabledOverride?: boolean) => Promise<void>;
            environments: EnvironmentConfig[];
        }
    ) {
        e.preventDefault();
        const title = projectTitle.trim();
        if (!title) return;

        const desiredBasePath =
            projectBasePath.trim() || homeDirRef.current || "";
        const validatedBasePath = await invoke<string | null>("validate_directory", {
            path: desiredBasePath,
        }).catch(() => null);
        if (!validatedBasePath) {
            setError("Project base path must be an existing directory.");
            return;
        }

        const environmentId = projectEnvironmentId && deps.environments.some((e) => e.id === projectEnvironmentId)
            ? projectEnvironmentId
            : null;

        if (projectMode === "rename") {
            try {
                // Update project on maestro-server
                await maestroClient.updateProject(activeProjectId, {
                    name: title,
                    workingDir: validatedBasePath,
                });

                // Update local state
                setProjects((prev) =>
                    prev.map((p) =>
                        p.id === activeProjectId
                            ? {
                                ...p,
                                title,
                                basePath: validatedBasePath,
                                environmentId,
                                assetsEnabled: projectAssetsEnabled,
                            }
                            : p,
                    ),
                );
                setProjectOpen(false);
            } catch (err) {
                reportError("Failed to update project", err);
            }
            return;
        }

        // Create project on maestro-server first
        try {
            const serverProject = await maestroClient.createProject({
                name: title,
                workingDir: validatedBasePath,
                description: '',
            });

            // Use the server's project ID
            const project: MaestroProject = {
                id: serverProject.id,
                name: serverProject.name,
                workingDir: serverProject.workingDir,
                createdAt: serverProject.createdAt,
                updatedAt: serverProject.updatedAt,
                basePath: serverProject.workingDir,
                environmentId,
                assetsEnabled: projectAssetsEnabled,
            };

            setProjects((prev) => [...prev, project]);
            setProjectOpen(false);
            setActiveProjectId(serverProject.id);

            try {
                await deps.ensureAutoAssets(validatedBasePath, serverProject.id, projectAssetsEnabled);
                const createdRaw = await createSession({
                    projectId: serverProject.id,
                    cwd: validatedBasePath,
                    envVars: envVarsForProjectId(serverProject.id, [...projects, project], deps.environments),
                });
                const s = processNewSession(createdRaw);
                setSessions((prev) => [...prev, s]);
                setActiveId(s.id);
            } catch (err) {
                reportError("Failed to create session", err);
                setActiveId(null);
            }
        } catch (err) {
            reportError("Failed to create project on server", err);
        }
    }

    async function deleteActiveProject(
        deps: {
            ensureAutoAssets: (baseDir: string, projectId: string, enabledOverride?: boolean) => Promise<void>;
            environments: EnvironmentConfig[];
        }
    ) {
        const project = projects.find((p) => p.id === activeProjectId);
        if (!project) return;

        const idsToClose = sessions
            .filter((s) => s.projectId === activeProjectId)
            .map((s) => s.id);

        for (const id of idsToClose) {
            cleanupSessionResources(id);
        }

        setSessions((prev) => prev.filter((s) => s.projectId !== activeProjectId));
        lastActiveByProject.current.delete(activeProjectId);
        setActiveSessionByProject((prev) => {
            if (!(activeProjectId in prev)) return prev;
            const next = { ...prev };
            delete next[activeProjectId];
            return next;
        });

        // Delete project from maestro-server
        try {
            await maestroClient.deleteProject(activeProjectId);
        } catch (err) {
            reportError("Failed to delete project on server", err);
            // Continue with local deletion even if server deletion fails
        }

        const remaining = projects.filter((p) => p.id !== activeProjectId);
        if (remaining.length === 0) {
            // Create a fallback project on the server
            try {
                const serverProject = await maestroClient.createProject({
                    name: "Default",
                    workingDir: homeDirRef.current || '',
                    description: '',
                });

                const fallback: MaestroProject = {
                    id: serverProject.id,
                    name: serverProject.name,
                    workingDir: serverProject.workingDir,
                    createdAt: serverProject.createdAt,
                    updatedAt: serverProject.updatedAt,
                    basePath: serverProject.workingDir,
                    environmentId: null,
                    assetsEnabled: true,
                };
                setProjects([fallback]);
                setActiveProjectId(fallback.id);

                try {
                    const createdRaw = await createSession({
                        projectId: fallback.id,
                        cwd: fallback.basePath ?? null,
                        envVars: envVarsForProjectId(fallback.id, [fallback], deps.environments),
                    });
                    const s = processNewSession(createdRaw);
                    setSessions([s]);
                    setActiveId(s.id);
                } catch (err) {
                    reportError("Failed to create session", err);
                    setActiveId(null);
                }
            } catch (err) {
                reportError("Failed to create fallback project on server", err);
            }
            return;
        }

        setProjects(remaining);
        const nextProjectId = remaining[0].id;
        setActiveProjectId(nextProjectId);
        setActiveId(pickActiveSessionId(nextProjectId));
    }

    return {
        projects,
        setProjects,
        activeProjectId,
        setActiveProjectId,
        activeSessionByProject,
        setActiveSessionByProject,
        projectOpen,
        setProjectOpen,
        projectMode,
        projectTitle,
        setProjectTitle,
        projectBasePath,
        setProjectBasePath,
        projectEnvironmentId,
        setProjectEnvironmentId,
        projectAssetsEnabled,
        setProjectAssetsEnabled,
        confirmDeleteProjectOpen,
        setConfirmDeleteProjectOpen,
        projectTitleRef,
        lastActiveByProject,

        selectProject,
        moveProject,
        openNewProject,
        openProjectSettings,
        openRenameProject,
        onProjectSubmit,
        deleteActiveProject,
    };
}
