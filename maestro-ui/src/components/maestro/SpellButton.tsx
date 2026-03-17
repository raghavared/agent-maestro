import React from 'react';
import { useSpellStore } from '../../stores/useSpellStore';

interface SpellButtonProps {
  maestroSessionId: string;
}

export const SpellButton = React.memo(function SpellButton({ maestroSessionId }: SpellButtonProps) {
  const openPicker = useSpellStore((s) => s.openPicker);

  return (
    <button
      type="button"
      className="spellButton"
      onClick={() => openPicker(maestroSessionId)}
      title="Cast spell — inject prompt into session"
      aria-label="Open spell picker"
    >
      <span className="spellButton__icon">✦</span>
    </button>
  );
});
