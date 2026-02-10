import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import type { DocEntry } from "../../app/types/maestro";
import { DocViewer } from "./DocViewer";

interface DocsListProps {
  docs: DocEntry[];
  title?: string;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getFileExtension(filePath: string): string {
  const parts = filePath.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function DocsList({ docs, title = "Docs" }: DocsListProps) {
  const [selectedDoc, setSelectedDoc] = useState<DocEntry | null>(null);

  const sortedDocs = useMemo(() => {
    return [...docs].sort((a, b) => b.addedAt - a.addedAt);
  }, [docs]);

  if (docs.length === 0) {
    return null;
  }

  return (
    <>
      <h3 className="terminalModalSectionTitle">
        ▸ {title}
        <span className="terminalModalSubtaskCount">
          ({docs.length} doc{docs.length !== 1 ? "s" : ""})
        </span>
      </h3>

      <div className="docsListGrid">
        {sortedDocs.map((doc) => {
          const ext = getFileExtension(doc.filePath);
          const fileName = doc.filePath.split("/").pop() || doc.filePath;

          return (
            <button
              key={doc.id}
              className="docsListCard"
              onClick={() => setSelectedDoc(doc)}
            >
              <div className="docsListCardIcon">
                {["md", "mdx", "markdown"].includes(ext) ? "M\u2193" : "{ }"}
              </div>
              <div className="docsListCardBody">
                <span className="docsListCardTitle">{doc.title}</span>
                <span className="docsListCardFile">
                  {fileName}
                  {ext && <span className="docsListCardExt">.{ext}</span>}
                </span>
              </div>
              <div className="docsListCardRight">
                {doc.sessionName && (
                  <span className="docsListCardSession">{doc.sessionName}</span>
                )}
                <span className="docsListCardTime">{formatTimeAgo(doc.addedAt)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedDoc && createPortal(
        <DocViewer doc={selectedDoc} onClose={() => setSelectedDoc(null)} />,
        document.body
      )}
    </>
  );
}
