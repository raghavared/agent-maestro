import React from "react";
import { Icon } from "../maestro/redesign/kit";

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
      <div className="pn-dlg" onClick={(e) => e.stopPropagation()}>
        <div className="pn-dlg__hd">
          <span className={`pn-dlg__icon ${confirmDanger ? "pn-dlg__icon--danger" : "pn-dlg__icon--warn"}`}>
            <Icon name="alert" size={18} />
          </span>
          <span className="pn-dlg__title">{title}</span>
        </div>
        <div className="pn-dlg__body">
          <div className="pn-dlg__msg">
            {message}
          </div>
        </div>
        <div className="pn-dlg__foot">
          <span className="pn-head-spacer" />
          <button type="button" className="pn-btn pn-btn--ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`pn-btn${confirmDanger ? "" : " pn-btn--primary"}`}
            style={confirmDanger ? { background: "var(--pn-block)", color: "#fff", borderColor: "var(--pn-block)" } : undefined}
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
