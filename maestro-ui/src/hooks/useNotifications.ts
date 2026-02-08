import { useState, useRef, useEffect, useCallback } from "react";
import { formatError } from "../utils/formatters";

export interface UseNotificationsReturn {
    error: string | null;
    setError: (error: string | null) => void;
    notice: string | null;
    setNotice: (notice: string | null) => void;
    reportError: (prefix: string, err: unknown) => void;
    showNotice: (message: string, timeoutMs?: number) => void;
    dismissNotice: () => void;
}

export function useNotifications(): UseNotificationsReturn {
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const noticeTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (noticeTimerRef.current !== null) {
                window.clearTimeout(noticeTimerRef.current);
                noticeTimerRef.current = null;
            }
        };
    }, []);

    const reportError = useCallback((prefix: string, err: unknown) => {
        setError(`${prefix}: ${formatError(err)}`);
    }, []);

    const reportErrorRef = useRef(reportError);
    useEffect(() => {
        reportErrorRef.current = reportError;
    }, [reportError]);

    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            reportErrorRef.current("Unexpected error", event.error ?? event.message);
        };
        const handleRejection = (event: PromiseRejectionEvent) => {
            reportErrorRef.current("Unhandled promise rejection", event.reason);
        };
        window.addEventListener("error", handleError);
        window.addEventListener("unhandledrejection", handleRejection);
        return () => {
            window.removeEventListener("error", handleError);
            window.removeEventListener("unhandledrejection", handleRejection);
        };
    }, []);

    const dismissNotice = useCallback(() => {
        setNotice(null);
        if (noticeTimerRef.current !== null) {
            window.clearTimeout(noticeTimerRef.current);
            noticeTimerRef.current = null;
        }
    }, []);

    const showNotice = useCallback((message: string, timeoutMs = 4500) => {
        setNotice(message);
        if (noticeTimerRef.current !== null) {
            window.clearTimeout(noticeTimerRef.current);
        }
        noticeTimerRef.current = window.setTimeout(() => {
            noticeTimerRef.current = null;
            setNotice(null);
        }, timeoutMs);
    }, []);

    return {
        error,
        setError,
        notice,
        setNotice,
        reportError,
        showNotice,
        dismissNotice,
    };
}
