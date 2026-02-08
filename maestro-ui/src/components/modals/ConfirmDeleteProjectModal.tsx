import React from "react";

type ConfirmDeleteProjectModalProps = {
  isOpen: boolean;
  projectTitle: string;
  error: string | null;
  onClose: () => void;
  onConfirmDelete: () => void;
};

export function ConfirmDeleteProjectModal({
  isOpen,
  projectTitle,
  error,
  onClose,
  onConfirmDelete,
}: ConfirmDeleteProjectModalProps) {
  if (!isOpen) return null;

  return (
    <div className="themedModalBackdrop" onClick={onClose}>
      <div className="themedModal" onClick={(e) => e.stopPropagation()}>
        <div className="themedModalHeader">
          <span className="themedModalTitle">[ DELETE PROJECT ]</span>
          <button className="themedModalClose" onClick={onClose}>×</button>
        </div>

        {error ? (
          <>
            <div className="themedWarning" style={{ margin: '16px' }}>
              {error}
            </div>
            <div className="themedFormActions">
              <button type="button" className="themedBtn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="themedModalContent" style={{ fontSize: '12px', color: 'rgba(var(--theme-primary-rgb), 0.7)' }}>
              Delete "{projectTitle}"? This action cannot be undone.
            </div>
            <div className="themedFormActions">
              <button type="button" className="themedBtn" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="themedBtn themedBtnDanger" onClick={onConfirmDelete}>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
