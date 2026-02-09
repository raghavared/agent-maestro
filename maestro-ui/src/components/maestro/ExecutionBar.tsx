import React, { useState } from "react";
import { WorkerStrategy, OrchestratorStrategy } from "../../app/types/maestro";

type ExecutionMode = 'none' | 'execute' | 'orchestrate';

type ExecutionBarProps = {
    isActive: boolean;
    onActivate: () => void;
    onCancel: () => void;
    onExecute: (strategy: WorkerStrategy) => void;
    onOrchestrate: (strategy: OrchestratorStrategy) => void;
    selectedCount: number;
    activeMode?: ExecutionMode;
    onActivateOrchestrate: () => void;
};

const WORKER_STRATEGIES: { key: WorkerStrategy; label: string; description: string }[] = [
    { key: "simple", label: "simple", description: "One agent per task" },
    { key: "queue", label: "queue", description: "Queue-based execution" },
];

const ORCHESTRATOR_STRATEGIES: { key: OrchestratorStrategy; label: string; description: string }[] = [
    { key: "default", label: "default", description: "Full autonomy to analyze, decompose, and delegate" },
    { key: "intelligent-batching", label: "batching", description: "Groups related tasks for parallel execution" },
    { key: "dag", label: "dag", description: "DAG with topological ordering and parallel branches" },
];

export function ExecutionBar({
    isActive,
    onActivate,
    onCancel,
    onExecute,
    onOrchestrate,
    selectedCount,
    activeMode = 'none',
    onActivateOrchestrate,
}: ExecutionBarProps) {
    const [workerStrategy, setWorkerStrategy] = useState<WorkerStrategy>("simple");
    const [orchestratorStrategy, setOrchestratorStrategy] = useState<OrchestratorStrategy>("default");

    if (!isActive) {
        return (
            <div className="executionBar">
                <button
                    className="terminalCmd terminalCmdPrimary"
                    onClick={onActivate}
                >
                    <span className="terminalPrompt">$</span> execute
                </button>
                <button
                    className="terminalCmd terminalCmdOrchestrate"
                    onClick={onActivateOrchestrate}
                >
                    <span className="terminalPrompt">$</span> orchestrate
                </button>
            </div>
        );
    }

    if (activeMode === 'orchestrate') {
        return (
            <div className="executionBar executionBar--active executionBar--orchestrate">
                <div className="executionBarStrategy">
                    {ORCHESTRATOR_STRATEGIES.map((s) => (
                        <button
                            key={s.key}
                            className={`executionBarStrategyChip ${orchestratorStrategy === s.key ? "executionBarStrategyChip--selected" : ""}`}
                            onClick={() => setOrchestratorStrategy(s.key)}
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
                        className="terminalCmd terminalCmdOrchestrate"
                        onClick={() => onOrchestrate(orchestratorStrategy)}
                        disabled={selectedCount === 0}
                    >
                        <span className="terminalPrompt">$</span> orchestrate ({selectedCount} task{selectedCount !== 1 ? "s" : ""})
                    </button>
                </div>
            </div>
        );
    }

    // Default: execute mode
    return (
        <div className="executionBar executionBar--active">
            <div className="executionBarStrategy">
                {WORKER_STRATEGIES.map((s) => (
                    <button
                        key={s.key}
                        className={`executionBarStrategyChip ${workerStrategy === s.key ? "executionBarStrategyChip--selected" : ""}`}
                        onClick={() => setWorkerStrategy(s.key)}
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
                    onClick={() => onExecute(workerStrategy)}
                    disabled={selectedCount === 0}
                >
                    <span className="terminalPrompt">$</span> execute ({selectedCount} task{selectedCount !== 1 ? "s" : ""})
                </button>
            </div>
        </div>
    );
}
