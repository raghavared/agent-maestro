import { useCallback } from 'react';
import { useSpellStore } from '../stores/useSpellStore';
import { useProjectStore } from '../stores/useProjectStore';
import type { SpellEntityType } from '../app/types/maestro';

/**
 * Hook for invoking spells programmatically (e.g., from keyboard shortcuts or drag-drop).
 */
export function useSpellInvocation() {
  const invokeSpell = useSpellStore((s) => s.invokeSpell);
  const invoking = useSpellStore((s) => s.invoking);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const invoke = useCallback(
    (entityType: SpellEntityType, entityId: string, spellName: string, targetSessionId: string) => {
      return invokeSpell({ entityType, entityId, spellName, targetSessionId, projectId: activeProjectId });
    },
    [invokeSpell, activeProjectId]
  );

  return { invoke, invoking };
}
