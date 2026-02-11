import React, { useMemo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocEntry } from "../../app/types/maestro";

interface DocViewerProps {
  doc: DocEntry;
  onClose: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileExtension(filePath: string): string {
  const parts = filePath.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function isMarkdown(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ["md", "mdx", "markdown"].includes(ext);
}

export function DocViewer({ doc, onClose }: DocViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileExt = useMemo(() => getFileExtension(doc.filePath), [doc.filePath]);
  const shouldRenderMarkdown = useMemo(() => isMarkdown(doc.filePath), [doc.filePath]);
  const fileName = useMemo(() => {
    const parts = doc.filePath.split("/");
    return parts[parts.length - 1];
  }, [doc.filePath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, onClose]);

  return (
    <div className={`docViewerOverlay ${isFullscreen ? 'docViewerOverlay--fullscreen' : ''}`} onClick={onClose}>
      <div className={`docViewerPanel ${isFullscreen ? 'docViewerPanel--fullscreen' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header bar */}
        <div className="docViewerHeader">
          <div className="docViewerHeaderLeft">
            <span className="docViewerIcon">
              {shouldRenderMarkdown ? "M↓" : "{ }"}
            </span>
            <div className="docViewerHeaderInfo">
              <h3 className="docViewerTitle">{doc.title}</h3>
              <div className="docViewerPathRow">
                <span className="docViewerFileName">{fileName}</span>
                {fileExt && (
                  <span className="docViewerExtBadge">.{fileExt}</span>
                )}
              </div>
            </div>
          </div>
          <div className="docViewerHeaderActions">
            <button
              className="docViewerFullscreenBtn"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 1v3H1" /><path d="M12 1v3h3" /><path d="M4 15v-3H1" /><path d="M12 15v-3h3" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 1h4v4" /><path d="M15 1h-4v4" /><path d="M1 15h4v-4" /><path d="M15 15h-4v-4" />
                </svg>
              )}
            </button>
            <button className="docViewerCloseBtn" onClick={onClose} title="Close (Esc)">
              ✕
            </button>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="docViewerMeta">
          <span className="docViewerMetaItem">
            <span className="docViewerMetaLabel">Path</span>
            <span className="docViewerMetaValue" title={doc.filePath}>{doc.filePath}</span>
          </span>
          <span className="docViewerMetaItem">
            <span className="docViewerMetaLabel">Added</span>
            <span className="docViewerMetaValue">{formatDate(doc.addedAt)}</span>
          </span>
          {doc.addedBy && (
            <span className="docViewerMetaItem">
              <span className="docViewerMetaLabel">By</span>
              <span className="docViewerMetaValue">{doc.addedBy}</span>
            </span>
          )}
          {doc.sessionName && (
            <span className="docViewerMetaItem">
              <span className="docViewerMetaLabel">Session</span>
              <span className="docViewerMetaSessionBadge">{doc.sessionName}</span>
            </span>
          )}
        </div>

        {/* Content body */}
        <div className="docViewerBody">
          {doc.content ? (
            shouldRenderMarkdown ? (
              <div className="docViewerMarkdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {doc.content}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="docViewerCode"><code>{doc.content}</code></pre>
            )
          ) : (
            <div className="docViewerEmpty">
              <span className="docViewerEmptyIcon">○</span>
              <span>No content available</span>
              <span className="docViewerEmptyPath">{doc.filePath}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
