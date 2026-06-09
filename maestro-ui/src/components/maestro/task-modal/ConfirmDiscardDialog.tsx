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
            <div className="pn-mdl" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
                <div className="pn-mdl__hd">
                    <div className="pn-mdl__hdmain">
                        <div className="pn-mdl__crumb">Unsaved changes</div>
                    </div>
                </div>
                <div className="pn-mdl__body">
                    <p className="pn-fhint" style={{ margin: 0 }}>
                        You have unsaved task details. Are you sure you want to discard them?
                    </p>
                </div>
                <div className="pn-mdl__foot">
                    <div className="pn-mdl__footL"></div>
                    <div className="pn-mdl__footR">
                        <button type="button" className="pn-btn pn-btn--ghost" onClick={onCancel}>
                            Keep Editing
                        </button>
                        <button type="button" className="pn-btn pn-btn--primary" onClick={onConfirm}>
                            Discard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
