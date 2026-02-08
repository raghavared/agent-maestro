import { useState, useCallback } from 'react';

/**
 * Hook for optimistic updates with automatic rollback on failure
 *
 * @param applyAction - The async action to execute (e.g., API call)
 * @returns Object with execute function, pending state, and error
 *
 * @example
 * const { execute, isPending } = useOptimistic(removeTaskFromSession);
 *
 * execute(
 *   () => setSessions(prev => prev.filter(s => s.id !== sessionId)),
 *   () => setSessions(prev => [...prev, removedSession]),
 *   sessionId,
 *   taskId
 * );
 */
export function useOptimistic<A extends any[]>(
    applyAction: (...args: A) => Promise<void>
) {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (
            optimisticUpdate: () => void,
            rollback: () => void,
            ...args: A
        ) => {
            setIsPending(true);
            setError(null);

            // Apply optimistic update immediately
            optimisticUpdate();

            try {
                // Execute the actual action
                await applyAction(...args);
                // Success - WebSocket will confirm the change
            } catch (err) {
                // Rollback optimistic update on failure
                rollback();
                const error = err instanceof Error ? err : new Error(String(err));
                setError(error);
                console.error('[useOptimistic] Action failed, rolled back:', error);
                throw error; // Re-throw for caller to handle
            } finally {
                setIsPending(false);
            }
        },
        [applyAction]
    );

    return { execute, isPending, error };
}
