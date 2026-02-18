import React, { useState } from 'react';
import type { ContextCategory } from '../../utils/claude-log';

interface ContextPanelProps {
  categories: ContextCategory[];
  totalTokens: number;
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function ContextPanel({ categories, totalTokens }: ContextPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (label: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (categories.length === 0) {
    return <div className="sessionLogContextEmpty">No context data available</div>;
  }

  return (
    <div className="sessionLogContext">
      <div className="sessionLogContextHeader">
        <span className="sessionLogContextTitle">Context Breakdown</span>
        <span className="sessionLogContextTotal">
          ~{formatTokenCount(totalTokens)} tokens total
        </span>
      </div>
      <div className="sessionLogContextSections">
        {categories.map((cat) => {
          const isExpanded = expandedSections.has(cat.label);
          const pct = totalTokens > 0 ? Math.round((cat.tokenCount / totalTokens) * 100) : 0;

          return (
            <div key={cat.label} className="sessionLogContextSection">
              <div
                className="sessionLogContextSectionHeader"
                onClick={() => toggleSection(cat.label)}
              >
                <span className="sessionLogToolCardChevron">{isExpanded ? '▾' : '▸'}</span>
                <span className="sessionLogContextSectionLabel">{cat.label}</span>
                <span className="sessionLogContextSectionBar">
                  <span
                    className="sessionLogContextSectionBarFill"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </span>
                <span className="sessionLogContextSectionTokens">
                  ~{formatTokenCount(cat.tokenCount)}
                </span>
                <span className="sessionLogContextSectionPct">{pct}%</span>
              </div>
              {isExpanded && (
                <div className="sessionLogContextSectionBody">
                  {cat.items.map((item, i) => (
                    <div key={i} className="sessionLogContextItem">
                      <span className="sessionLogContextItemName">{item.name}</span>
                      {item.count > 1 && (
                        <span className="sessionLogContextItemCount">x{item.count}</span>
                      )}
                      {item.tokens > 0 && (
                        <span className="sessionLogContextItemTokens">
                          ~{formatTokenCount(item.tokens)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
