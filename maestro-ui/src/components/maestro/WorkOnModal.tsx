import React, { useState } from 'react';
import { MaestroTask, MaestroProject, WorkerStrategy, OrchestratorStrategy } from '../../app/types/maestro';
import { StrategySelector } from './StrategySelector';
import { OrchestratorStrategySelector } from './OrchestratorStrategySelector';
import { Icon } from '../Icon';

export interface WorkOnModalResult {
  role: 'worker' | 'orchestrator';
  strategy: WorkerStrategy;
  orchestratorStrategy?: OrchestratorStrategy;
}

interface WorkOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: MaestroTask;
  project: MaestroProject;
  onConfirm: (result: WorkOnModalResult) => void;
}

export const WorkOnModal: React.FC<WorkOnModalProps> = ({
  isOpen,
  onClose,
  task,
  project,
  onConfirm,
}) => {
  const [role, setRole] = useState<'worker' | 'orchestrator'>('worker');
  const [strategy, setStrategy] = useState<WorkerStrategy>('simple');
  const [orchestratorStrategy, setOrchestratorStrategy] = useState<OrchestratorStrategy>('default');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm({
        role,
        strategy,
        ...(role === 'orchestrator' ? { orchestratorStrategy } : {}),
      });
      onClose();
    } catch (error) {
      console.error('Failed to start work:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="maestroModalOverlay terminalModal" onClick={onClose}>
      <div className="workOnModal terminalTheme" onClick={(e) => e.stopPropagation()}>
        <div className="workOnModalHeader">
          <div className="workOnModalHeaderContent">
            <div className="workOnModalIcon">
              <Icon name="play" />
            </div>
            <div>
              <h2 className="workOnModalTitle">Start Working</h2>
              <p className="workOnModalSubtitle">Choose how the agent should work on this task</p>
            </div>
          </div>
          <button className="workOnModalClose" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <div className="workOnModalBody">
          <div className="workOnModalTask">
            <div className="workOnModalTaskLabel">Task</div>
            <div className="workOnModalTaskTitle">{task.title}</div>
            <div className="workOnModalTaskId">{task.id}</div>
          </div>

          {/* Role Selector */}
          <div className="strategySelector">
            <div className="strategySelectorTitle">Role</div>
            <div className="strategySelectorOptions">
              <label
                className={`strategySelectorOption ${role === 'worker' ? 'strategySelectorOption--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value="worker"
                  checked={role === 'worker'}
                  onChange={() => setRole('worker')}
                />
                <div className="strategySelectorOptionContent">
                  <div className="strategySelectorOptionTitle">
                    <span className="strategySelectorOptionIcon">&#9881;</span>
                    Worker
                    <span className="strategySelectorOptionDefault">(Default)</span>
                  </div>
                  <div className="strategySelectorOptionDesc">
                    Agent implements tasks directly. Writes code, runs tests, makes changes.
                  </div>
                </div>
              </label>

              <label
                className={`strategySelectorOption ${role === 'orchestrator' ? 'strategySelectorOption--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value="orchestrator"
                  checked={role === 'orchestrator'}
                  onChange={() => setRole('orchestrator')}
                />
                <div className="strategySelectorOptionContent">
                  <div className="strategySelectorOptionTitle">
                    <span className="strategySelectorOptionIcon">&#9733;</span>
                    Orchestrator
                  </div>
                  <div className="strategySelectorOptionDesc">
                    Agent coordinates work by spawning and managing worker sessions. Never implements directly.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Strategy selectors based on role */}
          {role === 'worker' && (
            <StrategySelector
              value={strategy}
              onChange={setStrategy}
            />
          )}

          {role === 'orchestrator' && (
            <OrchestratorStrategySelector
              value={orchestratorStrategy}
              onChange={setOrchestratorStrategy}
            />
          )}

          {role === 'worker' && strategy === 'queue' && (
            <div className="workOnModalHint">
              <div className="workOnModalHintIcon">i</div>
              <div className="workOnModalHintText">
                With queue strategy, the agent will use <code>maestro queue</code> commands
                to process tasks one at a time in order.
              </div>
            </div>
          )}

          {role === 'orchestrator' && (
            <div className="workOnModalHint">
              <div className="workOnModalHintIcon">i</div>
              <div className="workOnModalHintText">
                The orchestrator will analyze, decompose, and delegate tasks to worker sessions.
                It will never implement changes directly.
              </div>
            </div>
          )}
        </div>

        <div className="workOnModalActions">
          <button
            className="workOnModalBtn workOnModalBtnSecondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="workOnModalBtn workOnModalBtnPrimary"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Starting...' : (role === 'orchestrator' ? 'Start Orchestrating' : 'Start Working')}
          </button>
        </div>
      </div>
    </div>
  );
};
