import { useState, useEffect, useRef, useCallback } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave({
    changeVersion,
    hasChanges,
    saveFn,
    debounceMs = 1000,
    enabled = true,
}: {
    changeVersion: number;
    hasChanges: boolean;
    saveFn: () => Promise<void>;
    debounceMs?: number;
    enabled?: boolean;
}) {
    const [status, setStatus] = useState<AutoSaveStatus>("idle");
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveFnRef = useRef(saveFn);
    const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedVersionRef = useRef(changeVersion);
    const isSavingRef = useRef(false);

    saveFnRef.current = saveFn;

    useEffect(() => {
        if (changeVersion === 0) {
            lastSavedVersionRef.current = 0;
        }
    }, [changeVersion]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        };
    }, []);

    const doSave = useCallback(async () => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        setStatus("saving");
        try {
            await saveFnRef.current();
            setStatus("saved");
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
            fadeTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
        } catch (err) {
            setStatus("error");
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
            fadeTimerRef.current = setTimeout(() => setStatus("idle"), 3000);
        } finally {
            isSavingRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (!enabled || !hasChanges || changeVersion <= lastSavedVersionRef.current) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            lastSavedVersionRef.current = changeVersion;
            doSave();
        }, debounceMs);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [changeVersion, hasChanges, enabled, debounceMs, doSave]);

    const saveNow = useCallback(async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!hasChanges) return;
        lastSavedVersionRef.current = changeVersion;
        await doSave();
    }, [hasChanges, changeVersion, doSave]);

    return { status, saveNow };
}
