import React, { useState } from "react";
import { WorkerStrategy } from "../../app/types/maestro";

type ExecutionBarProps = {
    isActive: boolean;
    onActivate: () => void;
    onCancel: () => void;
    onExecute: (strategy: WorkerStrategy) => void;
    selectedCount: number;
};

const STRATEGIES: { key: WorkerStrategy; label: string; description: string }[] = [
    { key: "simple", label: "simple", description: "One agent per task" },
    { key: "queue", label: "queue", description: "Queue-based execution" },
];

export function ExecutionBar({
    isActive,
    onActivate,
    onCancel,
    onExecute,
    selectedCount,
}: ExecutionBarProps) {
    const [strategy, setStrategy] = useState<WorkerStrategy>("simple");

    if (!isActive) {
        return (
            <div className="executionBar">
                <button
                    className="terminalCmd terminalCmdPrimary"
                    onClick={onActivate}
                >
                    <span className="terminalPrompt">$</span> execute
                </button>
            </div>
        );
    }

    return (
        <div className="executionBar executionBar--active">
            <div className="executionBarStrategy">
                {STRATEGIES.map((s) => (
                    <button
                        key={s.key}
                        className={`executionBarStrategyChip ${strategy === s.key ? "executionBarStrategyChip--selected" : ""}`}
                        onClick={() => setStrategy(s.key)}
                        title={s.description}
                    >
                        {s.label}
                    </button>
                ))}
            </div>
            <div className="executionBarActions">
                <button
                    className="terminalCmd"
                    onClick={onCancel}
                >
                    cancel
                </button>
                <button
                    className="terminalCmd terminalCmdPrimary"
                    onClick={() => onExecute(strategy)}
                    disabled={selectedCount === 0}
                >
                    <span className="terminalPrompt">$</span> execute ({selectedCount} task{selectedCount !== 1 ? "s" : ""})
                </button>
            </div>
        </div>
    );
}
