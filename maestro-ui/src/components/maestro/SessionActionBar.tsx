import React from 'react';
import { useSpellStore } from '../../stores/useSpellStore';
import { Icon } from '../Icon';

interface SessionActionBarProps {
  maestroSessionId: string;
  onAttach: () => void;
  onDraw: () => void;
}

export const SessionActionBar = React.memo(function SessionActionBar({
  maestroSessionId,
  onAttach,
  onDraw,
}: SessionActionBarProps) {
  const openPicker = useSpellStore((s) => s.openPicker);

  return (
    <div className="sessionActionBar">
      <button
        type="button"
        className="sessionActionBtn"
        onClick={onAttach}
        title="Attach files — inject @paths into session"
        aria-label="Attach files"
      >
        <Icon name="paperclip" size={16} />
      </button>
      <button
        type="button"
        className="sessionActionBtn"
        onClick={onDraw}
        title="Draw — sketch and inject the drawing into session"
        aria-label="Open drawing board"
      >
        <Icon name="pencil" size={16} />
      </button>
      <button
        type="button"
        className="sessionActionBtn"
        onClick={() => openPicker(maestroSessionId)}
        title="Cast spell — inject prompt into session"
        aria-label="Open spell picker"
      >
        <span className="sessionActionBtn__icon">✦</span>
      </button>
    </div>
  );
});
