import React from "react";

type ConfirmActionModalProps = {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDanger?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmActionModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDanger,
  busy,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="themedModalBackdrop"
      onClick={() => {
        if (busy) return;
        onClose();
      }}
    >
      <div className="themedModal" onClick={(e) => e.stopPropagation()}>
        <div className="themedModalHeader">
          <span className="themedModalTitle">{title}</span>
          <button className="themedModalClose" onClick={onClose} disabled={busy}>×</button>
        </div>
        <div className="themedModalContent">
          <div className="themedFormHint">
            {message}
          </div>
        </div>
        <div className="themedFormActions">
          <button type="button" className="themedBtn" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`themedBtn ${confirmDanger ? "themedBtnDanger" : "themedBtnPrimary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
