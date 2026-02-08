import React from "react";
import { DirectoryListing } from "../../app/types/app-state";
import { InlineFolderBrowser } from "../InlineFolderBrowser";

type PathPickerModalProps = {
  isOpen: boolean;
  listing: DirectoryListing | null;
  loading: boolean;
  error: string | null;
  onLoad: (path: string | null) => void;
  onClose: () => void;
  onSelect: () => void;
};

export function PathPickerModal({
  isOpen,
  listing,
  loading,
  error,
  onLoad,
  onClose,
  onSelect,
}: PathPickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="themedModalBackdrop" onClick={onClose}>
      <div className="themedModal themedModal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="themedModalHeader">
          <span className="themedModalTitle">[ SELECT FOLDER ]</span>
          <button className="themedModalClose" onClick={onClose}>×</button>
        </div>
        <div className="themedModalContent">
          <InlineFolderBrowser
            listing={listing}
            loading={loading}
            error={error}
            onNavigate={onLoad}
            onSelect={() => {}}
          />
        </div>
        <div className="themedFormActions">
          <button type="button" className="themedBtn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="themedBtn themedBtnPrimary" disabled={!listing} onClick={onSelect}>
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
