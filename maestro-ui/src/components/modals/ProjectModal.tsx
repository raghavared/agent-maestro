import React, { useState } from "react";
import { DirectoryListing } from "../../app/types/app-state";
import { InlineFolderBrowser } from "../InlineFolderBrowser";

type EnvironmentConfig = {
  id: string;
  name: string;
};

type ProjectModalProps = {
  isOpen: boolean;
  mode: "new" | "rename";
  title: string;
  titleInputRef: React.RefObject<HTMLInputElement>;
  onChangeTitle: (value: string) => void;
  basePath: string;
  onChangeBasePath: (value: string) => void;
  basePathPlaceholder: string;
  canUseCurrentTab: boolean;
  onUseCurrentTab: () => void;
  canUseHome: boolean;
  onUseHome: () => void;
  environments: EnvironmentConfig[];
  selectedEnvironmentId: string;
  onChangeEnvironmentId: (value: string) => void;
  onOpenEnvironments: () => void;
  assetsEnabled: boolean;
  onChangeAssetsEnabled: (value: boolean) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  browserListing: DirectoryListing | null;
  browserLoading: boolean;
  browserError: string | null;
  onBrowserNavigate: (path: string | null) => void;
  onBrowserSelect: (path: string) => void;
};

export function ProjectModal({
  isOpen,
  mode,
  title,
  titleInputRef,
  onChangeTitle,
  basePath,
  onChangeBasePath,
  basePathPlaceholder,
  canUseCurrentTab,
  onUseCurrentTab,
  canUseHome,
  onUseHome,
  environments,
  selectedEnvironmentId,
  onChangeEnvironmentId,
  onOpenEnvironments,
  assetsEnabled,
  onChangeAssetsEnabled,
  onClose,
  onSubmit,
  browserListing,
  browserLoading,
  browserError,
  onBrowserNavigate,
  onBrowserSelect,
}: ProjectModalProps) {
  const [browserExpanded, setBrowserExpanded] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="themedModalBackdrop" onClick={onClose}>
      <div className="themedModal themedModal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="themedModalHeader">
          <span className="themedModalTitle">
            [ {mode === "new" ? "NEW PROJECT" : "PROJECT SETTINGS"} ]
          </span>
          <button className="themedModalClose" onClick={onClose}>×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="themedModalContent">
            <div className="themedFormRow">
              <div className="themedFormLabel">Title</div>
              <input
                className="themedFormInput"
                ref={titleInputRef}
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder="e.g. my-repo"
              />
            </div>
            <div className="themedFormRow">
              <div className="themedFormLabel">Base path</div>
              <input
                className="themedFormInput"
                value={basePath}
                onChange={(e) => onChangeBasePath(e.target.value)}
                placeholder={basePathPlaceholder}
              />
              <div className="themedPathActions">
                <button
                  type="button"
                  className="themedBtn"
                  onClick={onUseCurrentTab}
                  disabled={!canUseCurrentTab}
                >
                  Use current tab
                </button>
                <button type="button" className="themedBtn" onClick={onUseHome} disabled={!canUseHome}>
                  Home
                </button>
              </div>
              <button
                type="button"
                className="themedBrowseToggle"
                onClick={() => setBrowserExpanded((v) => !v)}
              >
                <span className={`themedBrowseToggleArrow${browserExpanded ? " themedBrowseToggleArrow--open" : ""}`}>
                  &#9654;
                </span>
                Browse
              </button>
              {browserExpanded && (
                <InlineFolderBrowser
                  listing={browserListing}
                  loading={browserLoading}
                  error={browserError}
                  onNavigate={onBrowserNavigate}
                  onSelect={onBrowserSelect}
                />
              )}
              <div className="themedFormHint">New sessions in this project start here.</div>
            </div>
            <div className="themedFormRow">
              <div className="themedFormLabel">Environment (.env)</div>
              <div className="themedPathRow">
                <select
                  className="themedFormSelect"
                  value={selectedEnvironmentId}
                  onChange={(e) => onChangeEnvironmentId(e.target.value)}
                >
                  <option value="">None</option>
                  {environments
                    .slice()
                    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                    .map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                      </option>
                    ))}
                </select>
                <button type="button" className="themedBtn" onClick={onOpenEnvironments}>
                  Manage
                </button>
              </div>
              <div className="themedFormHint">Applied to new sessions in this project.</div>
            </div>
            <div className="themedFormRow">
              <div className="themedFormLabel">Assets</div>
              <label className="themedCheckRow">
                <input
                  type="checkbox"
                  checked={assetsEnabled}
                  onChange={(e) => onChangeAssetsEnabled(e.target.checked)}
                />
                Auto-create enabled assets on new sessions
              </label>
              <div className="themedFormHint">Manage templates in the Assets panel.</div>
            </div>
          </div>
          <div className="themedFormActions">
            <button type="button" className="themedBtn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="themedBtn themedBtnPrimary">
              {mode === "new" ? "Create" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
