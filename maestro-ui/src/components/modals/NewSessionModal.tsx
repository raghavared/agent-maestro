import React from "react";
import { createPortal } from "react-dom";

type NewSessionModalProps = {
  isOpen: boolean;
  projectName: string | null;
  name: string;
  nameInputRef: React.RefObject<HTMLInputElement>;
  onChangeName: (value: string) => void;
  command: string;
  onChangeCommand: (value: string) => void;
  commandSuggestions?: string[];
  cwd: string;
  onChangeCwd: (value: string) => void;
  cwdPlaceholder: string;
  onBrowseCwd: () => void;
  canUseProjectBase: boolean;
  onUseProjectBase: () => void;
  canUseCurrentTab: boolean;
  onUseCurrentTab: () => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function NewSessionModal({
  isOpen,
  projectName,
  name,
  nameInputRef,
  onChangeName,
  command,
  onChangeCommand,
  commandSuggestions,
  cwd,
  onChangeCwd,
  cwdPlaceholder,
  onBrowseCwd,
  canUseProjectBase,
  onUseProjectBase,
  canUseCurrentTab,
  onUseCurrentTab,
  onClose,
  onSubmit,
}: NewSessionModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="themedModalBackdrop" onClick={onClose}>
      <div className="themedModal" onClick={(e) => e.stopPropagation()}>
        <div className="themedModalHeader">
          <span className="themedModalTitle">[ NEW TERMINAL ]</span>
          <button className="themedModalClose" onClick={onClose}>×</button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="themedModalContent">
            <div className="themedFormHint" style={{ marginBottom: '10px' }}>
              Enter a name for your new terminal session
            </div>

            <div className="themedFormRow">
              <div className="themedFormLabel">Terminal Name</div>
              <input
                className="themedFormInput"
                ref={nameInputRef}
                value={name}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="e.g., main shell"
              />
            </div>
          </div>

          <div className="themedFormActions">
            <button type="button" className="themedBtn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="themedBtn themedBtnPrimary">
              Create Terminal
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
