import React from 'react';
import { WorkerStrategy } from '../../app/types/maestro';

interface StrategySelectorProps {
  value: WorkerStrategy;
  onChange: (strategy: WorkerStrategy) => void;
}

export const StrategySelector: React.FC<StrategySelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="strategySelector">
      <div className="strategySelectorTitle">Worker Strategy</div>
      <div className="strategySelectorOptions">
        <label
          className={`strategySelectorOption ${value === 'simple' ? 'strategySelectorOption--selected' : ''}`}
        >
          <input
            type="radio"
            name="strategy"
            value="simple"
            checked={value === 'simple'}
            onChange={() => onChange('simple')}
          />
          <div className="strategySelectorOptionContent">
            <div className="strategySelectorOptionTitle">
              <span className="strategySelectorOptionIcon">○</span>
              Simple
              <span className="strategySelectorOptionDefault">(Default)</span>
            </div>
            <div className="strategySelectorOptionDesc">
              Agent works on all tasks freely. Standard behavior.
            </div>
          </div>
        </label>

        <label
          className={`strategySelectorOption ${value === 'queue' ? 'strategySelectorOption--selected' : ''}`}
        >
          <input
            type="radio"
            name="strategy"
            value="queue"
            checked={value === 'queue'}
            onChange={() => onChange('queue')}
          />
          <div className="strategySelectorOptionContent">
            <div className="strategySelectorOptionTitle">
              <span className="strategySelectorOptionIcon">☰</span>
              Queue
            </div>
            <div className="strategySelectorOptionDesc">
              Tasks processed one at a time (FIFO). Agent uses queue commands.
            </div>
          </div>
        </label>

        {/* Tree strategy not yet implemented - commented out
        <label
          className={`strategySelectorOption ${value === 'tree' ? 'strategySelectorOption--selected' : ''}`}
        >
          <input
            type="radio"
            name="strategy"
            value="tree"
            checked={value === 'tree'}
            onChange={() => onChange('tree')}
          />
          <div className="strategySelectorOptionContent">
            <div className="strategySelectorOptionTitle">
              <span className="strategySelectorOptionIcon">{'\u2325'}</span>
              Tree
            </div>
            <div className="strategySelectorOptionDesc">
              Agent works through a task tree (root + subtasks) holistically.
            </div>
          </div>
        </label>
        */}
      </div>
    </div>
  );
};
