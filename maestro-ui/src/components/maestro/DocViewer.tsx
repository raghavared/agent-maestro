import React, { useMemo } from "react";
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
  const fileExt = useMemo(() => getFileExtension(doc.filePath), [doc.filePath]);
  const shouldRenderMarkdown = useMemo(() => isMarkdown(doc.filePath), [doc.filePath]);
  const fileName = useMemo(() => {
    const parts = doc.filePath.split("/");
    return parts[parts.length - 1];
  }, [doc.filePath]);

  return (
    <div className="docViewerOverlay" onClick={onClose}>
      <div className="docViewerPanel" onClick={(e) => e.stopPropagation()}>
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
          <button className="docViewerCloseBtn" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
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
