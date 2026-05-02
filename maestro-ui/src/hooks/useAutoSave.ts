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
    const pendingVersionRef = useRef<number | null>(null);

    saveFnRef.current = saveFn;

    useEffect(() => {
        if (changeVersion === 0) {
            lastSavedVersionRef.current = 0;
            pendingVersionRef.current = null;
        }
    }, [changeVersion]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        };
    }, []);

    const doSave = useCallback(async (version: number) => {
        if (isSavingRef.current) {
            // Queue this version — will be retried after current save completes
            pendingVersionRef.current = version;
            return;
        }
        isSavingRef.current = true;
        pendingVersionRef.current = null;
        setStatus("saving");
        try {
            await saveFnRef.current();
            lastSavedVersionRef.current = version;
            setStatus("saved");
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
            fadeTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
            // Retry if a newer version was queued while we were saving
            const pending = pendingVersionRef.current;
            if (pending !== null && pending > version) {
                pendingVersionRef.current = null;
                isSavingRef.current = false;
                doSave(pending);
                return;
            }
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
            doSave(changeVersion);
        }, debounceMs);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [changeVersion, hasChanges, enabled, debounceMs, doSave]);

    const saveNow = useCallback(async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!hasChanges) return;
        await doSave(changeVersion);
    }, [hasChanges, changeVersion, doSave]);

    return { status, saveNow };
}
