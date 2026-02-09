import React from 'react';
import { OrchestratorStrategy } from '../../app/types/maestro';

interface OrchestratorStrategySelectorProps {
  value: OrchestratorStrategy;
  onChange: (strategy: OrchestratorStrategy) => void;
}

export const OrchestratorStrategySelector: React.FC<OrchestratorStrategySelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="strategySelector">
      <div className="strategySelectorTitle">Orchestrator Strategy</div>
      <div className="strategySelectorOptions">
        <label
          className={`strategySelectorOption ${value === 'default' ? 'strategySelectorOption--selected' : ''}`}
        >
          <input
            type="radio"
            name="orchestratorStrategy"
            value="default"
            checked={value === 'default'}
            onChange={() => onChange('default')}
          />
          <div className="strategySelectorOptionContent">
            <div className="strategySelectorOptionTitle">
              <span className="strategySelectorOptionIcon">&#9670;</span>
              Default
              <span className="strategySelectorOptionDefault">(Default)</span>
            </div>
            <div className="strategySelectorOptionDesc">
              Full autonomy to analyze, decompose, and delegate tasks to workers.
            </div>
          </div>
        </label>

        <label
          className={`strategySelectorOption ${value === 'intelligent-batching' ? 'strategySelectorOption--selected' : ''}`}
        >
          <input
            type="radio"
            name="orchestratorStrategy"
            value="intelligent-batching"
            checked={value === 'intelligent-batching'}
            onChange={() => onChange('intelligent-batching')}
          />
          <div className="strategySelectorOptionContent">
            <div className="strategySelectorOptionTitle">
              <span className="strategySelectorOptionIcon">&#9638;</span>
              Intelligent Batching
            </div>
            <div className="strategySelectorOptionDesc">
              Groups related tasks into optimal batches for parallel execution.
            </div>
          </div>
        </label>

        <label
          className={`strategySelectorOption ${value === 'dag' ? 'strategySelectorOption--selected' : ''}`}
        >
          <input
            type="radio"
            name="orchestratorStrategy"
            value="dag"
            checked={value === 'dag'}
            onChange={() => onChange('dag')}
          />
          <div className="strategySelectorOptionContent">
            <div className="strategySelectorOptionTitle">
              <span className="strategySelectorOptionIcon">&#9700;</span>
              DAG
            </div>
            <div className="strategySelectorOptionDesc">
              Directed acyclic graph execution with topological ordering and parallel branches.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};
