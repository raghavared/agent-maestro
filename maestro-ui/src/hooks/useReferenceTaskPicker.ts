import { useState, useEffect } from "react";
import { MaestroTask } from "../app/types/maestro";
import { maestroClient } from "../utils/MaestroClient";

type RefTaskCandidate = MaestroTask & { docCount: number };

export function useReferenceTaskPicker(projectId: string | undefined) {
    const [selectedReferenceTasks, setSelectedReferenceTasks] = useState<MaestroTask[]>([]);
    const [showPicker, setShowPicker] = useState(false);
    const [candidates, setCandidates] = useState<RefTaskCandidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [displayCount, setDisplayCount] = useState(5);

    // Fetch tasks with docs when picker opens
    useEffect(() => {
        if (!showPicker || !projectId) return;
        let cancelled = false;
        setLoading(true);

        (async () => {
            try {
                const tasks = await maestroClient.getTasks(projectId);
                const sorted = tasks.sort((a, b) => b.updatedAt - a.updatedAt);
                const withDocs: RefTaskCandidate[] = [];
                for (const t of sorted) {
                    if (cancelled) return;
                    try {
                        const docs = await maestroClient.getTaskDocs(t.id);
                        if (docs.length > 0) {
                            withDocs.push({ ...t, docCount: docs.length });
                        }
                    } catch {
                        // skip tasks where docs fetch fails
                    }
                    if (withDocs.length >= 20) break;
                }
                if (!cancelled) {
                    setCandidates(withDocs);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [showPicker, projectId]);

    const togglePicker = () => {
        setShowPicker(prev => !prev);
        setDisplayCount(5);
    };

    const closePicker = () => setShowPicker(false);

    const toggleSelection = (task: MaestroTask) => {
        setSelectedReferenceTasks(prev => {
            const exists = prev.some(t => t.id === task.id);
            return exists ? prev.filter(t => t.id !== task.id) : [...prev, task];
        });
    };

    const removeTask = (taskId: string) => {
        setSelectedReferenceTasks(prev => prev.filter(t => t.id !== taskId));
    };

    const loadMore = () => setDisplayCount(prev => prev + 5);

    const reset = () => {
        setSelectedReferenceTasks([]);
        setShowPicker(false);
        setCandidates([]);
        setDisplayCount(5);
    };

    return {
        selectedReferenceTasks,
        setSelectedReferenceTasks,
        showPicker,
        candidates,
        loading,
        displayCount,
        togglePicker,
        closePicker,
        toggleSelection,
        removeTask,
        loadMore,
        reset,
    };
}
