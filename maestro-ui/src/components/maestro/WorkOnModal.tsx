import React, { useState } from 'react';
import { MaestroTask, MaestroProject, WorkerStrategy } from '../../app/types/maestro';
import { StrategySelector } from './StrategySelector';
import { Icon } from '../Icon';

interface WorkOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: MaestroTask;
  project: MaestroProject;
  onConfirm: (strategy: WorkerStrategy) => void;
}

export const WorkOnModal: React.FC<WorkOnModalProps> = ({
  isOpen,
  onClose,
  task,
  project,
  onConfirm,
}) => {
  const [strategy, setStrategy] = useState<WorkerStrategy>('simple');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(strategy);
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

          <StrategySelector
            value={strategy}
            onChange={setStrategy}
          />

          {strategy === 'queue' && (
            <div className="workOnModalHint">
              <div className="workOnModalHintIcon">i</div>
              <div className="workOnModalHintText">
                With queue strategy, the agent will use <code>maestro queue</code> commands
                to process tasks one at a time in order.
              </div>
            </div>
          )}

          {/* Tree strategy not yet implemented
          {strategy === 'tree' && (
            <div className="workOnModalHint">
              <div className="workOnModalHintIcon">i</div>
              <div className="workOnModalHintText">
                With tree strategy, the agent receives the full task tree and works through
                all subtasks holistically, deciding the order based on dependencies.
              </div>
            </div>
          )}
          */}
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
            {isLoading ? 'Starting...' : 'Start Working'}
          </button>
        </div>
      </div>
    </div>
  );
};
