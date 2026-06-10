import React, { useState } from "react";
import type { SessionPrompt } from "../../app/types/maestro";
import { StatIcon } from "./SessionStatsIcons";

// Mirrors the formatters in SessionStatsView — kept local so this component
// is self-contained and can be lifted into Huddles (Phase 2) without rework.
const AGENT_HUES = [
  "#ff6b6b", "#ffa94d", "#ffd43b", "#a9e34b", "#69db7c",
  "#38d9a9", "#3bc9db", "#74c0fc", "#748ffc", "#9775fa",
  "#da77f2", "#f783ac",
];

function hueFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AGENT_HUES[h % AGENT_HUES.length];
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "··";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TRUNCATE_LIMIT = 220;

export interface PromptRowProps {
  prompt: SessionPrompt;
  /**
   * The id of the session whose perspective this row is rendered for. Used
   * to derive direction (sent vs received) and which counterpart to show.
   */
  perspectiveSessionId: string;
  onCounterpartClick?: (sessionId: string) => void;
}

export function PromptRow({ prompt, perspectiveSessionId, onCounterpartClick }: PromptRowProps) {
  const isSent = prompt.fromSessionId === perspectiveSessionId;
  const counterpartMember = isSent ? prompt.toTeamMember : prompt.fromTeamMember;
  const counterpartSessionId = isSent ? prompt.toSessionId : prompt.fromSessionId;
  const counterpartSessionName = isSent ? prompt.toSessionName : prompt.fromSessionName;
  const counterpartName = counterpartMember?.name ?? counterpartSessionName ?? counterpartSessionId.slice(0, 10);
  const avatarChar = counterpartMember?.avatar?.trim() || initialsOf(counterpartName);

  const [expanded, setExpanded] = useState(false);
  const content = prompt.content ?? "";
  const isTruncatable = content.length > TRUNCATE_LIMIT;
  const shown = expanded || !isTruncatable ? content : content.slice(0, TRUNCATE_LIMIT).trimEnd() + "…";

  const directionLabel = isSent ? "Sent" : "Received";
  const directionArrow = isSent ? "→" : "←";

  const handleClick = () => {
    if (isTruncatable) setExpanded((v) => !v);
  };

  const handleCounterpartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCounterpartClick?.(counterpartSessionId);
  };

  return (
    <div
      className={`ssv-prompt-row ssv-prompt-row-${isSent ? "sent" : "received"}`}
      onClick={handleClick}
      role={isTruncatable ? "button" : undefined}
      tabIndex={isTruncatable ? 0 : undefined}
      aria-expanded={isTruncatable ? expanded : undefined}
    >
      <span
        className="ssv-prompt-av"
        style={{ background: hueFor(counterpartName) }}
        onClick={onCounterpartClick ? handleCounterpartClick : undefined}
        title={`Session ${counterpartSessionId}`}
      >
        {avatarChar.length === 1 || avatarChar.length === 2
          ? avatarChar
          : initialsOf(counterpartName)}
      </span>
      <div className="ssv-prompt-meta">
        <div className="ssv-prompt-head">
          <span className="ssv-prompt-dir">
            {directionLabel} {directionArrow}
          </span>
          <span className="ssv-prompt-name">{counterpartName}</span>
          {counterpartMember?.role && (
            <span className="ssv-prompt-role">{counterpartMember.role}</span>
          )}
          <span className="ssv-prompt-when">{formatTimeAgo(prompt.timestamp)}</span>
        </div>
        <div className="ssv-prompt-text">{shown}</div>
        {isTruncatable && (
          <div className="ssv-prompt-expand">
            <StatIcon name="chevron-right" size={11} className={`ssv-chev${expanded ? " open" : ""}`} />
            {expanded ? "Show less" : "Show more"}
          </div>
        )}
      </div>
    </div>
  );
}

export interface PromptListProps {
  prompts: SessionPrompt[];
  perspectiveSessionId: string;
  onCounterpartClick?: (sessionId: string) => void;
  emptyLabel?: string;
}

export function PromptList({ prompts, perspectiveSessionId, onCounterpartClick, emptyLabel }: PromptListProps) {
  if (prompts.length === 0) {
    return emptyLabel ? <div className="ssv-prompt-empty">{emptyLabel}</div> : null;
  }
  // Server returns prompts sorted by timestamp ascending; reverse for newest-first display.
  const ordered = [...prompts].reverse();
  return (
    <div className="ssv-card ssv-prompt-list">
      {ordered.map((p) => (
        <PromptRow
          key={p.id}
          prompt={p}
          perspectiveSessionId={perspectiveSessionId}
          onCounterpartClick={onCounterpartClick}
        />
      ))}
    </div>
  );
}
