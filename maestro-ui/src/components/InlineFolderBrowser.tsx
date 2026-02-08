import React from "react";
import { DirectoryListing } from "../app/types/app-state";

type InlineFolderBrowserProps = {
  listing: DirectoryListing | null;
  loading: boolean;
  error: string | null;
  onNavigate: (path: string | null) => void;
  onSelect: (path: string) => void;
};

function parseBreadcrumbs(fullPath: string): Array<{ label: string; path: string }> {
  const segments = fullPath.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; path: string }> = [{ label: "/", path: "/" }];
  let accumulated = "";
  for (const seg of segments) {
    accumulated += "/" + seg;
    crumbs.push({ label: seg, path: accumulated });
  }
  return crumbs;
}

export function InlineFolderBrowser({
  listing,
  loading,
  error,
  onNavigate,
  onSelect,
}: InlineFolderBrowserProps) {
  const crumbs = listing ? parseBreadcrumbs(listing.path) : [];

  return (
    <div className="themedFolderBrowser">
      {/* Breadcrumb bar */}
      {listing && (
        <div className="themedBreadcrumb">
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <span className="themedBreadcrumbSeparator">/</span>}
              <button
                type="button"
                className="themedBreadcrumbSegment"
                onClick={() => {
                  onSelect(crumb.path);
                  onNavigate(crumb.path);
                }}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Up button toolbar */}
      {listing && (
        <div className="themedFolderToolbar">
          <button
            type="button"
            className="themedBtn"
            disabled={!listing.parent || loading}
            onClick={() => {
              if (listing.parent) {
                onSelect(listing.parent);
                onNavigate(listing.parent);
              }
            }}
          >
            Up
          </button>
        </div>
      )}

      {/* Error */}
      {error && <div className="themedFolderError">{error}</div>}

      {/* Folder list */}
      <div className="themedFolderList">
        {loading ? (
          <div className="themedFolderEmpty">Loading…</div>
        ) : listing && listing.entries.length === 0 ? (
          <div className="themedFolderEmpty">No subfolders.</div>
        ) : (
          listing?.entries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className="themedFolderItem"
              title={entry.path}
              onClick={() => {
                onSelect(entry.path);
                onNavigate(entry.path);
              }}
            >
              {entry.name}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
