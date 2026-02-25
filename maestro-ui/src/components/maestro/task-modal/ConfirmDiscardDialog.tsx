import React from "react";

type ConfirmDiscardDialogProps = {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDiscardDialog({ isOpen, onConfirm, onCancel }: ConfirmDiscardDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="themedModalBackdrop" onClick={onCancel}>
            <div className="themedModal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="themedModalHeader">
                    <span className="themedModalTitle">[ UNSAVED CHANGES ]</span>
                </div>
                <div className="themedModalContent">
                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(var(--theme-primary-rgb), 0.7)' }}>
                        You have unsaved task details. Are you sure you want to discard them?
                    </p>
                </div>
                <div className="themedFormActions">
                    <button type="button" className="themedBtn" onClick={onCancel}>
                        Keep Editing
                    </button>
                    <button type="button" className="themedBtn themedBtnDanger" onClick={onConfirm}>
                        Discard
                    </button>
                </div>
            </div>
        </div>
    );
}
