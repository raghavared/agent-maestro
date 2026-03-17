import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSpellStore } from '../stores/useSpellStore';
import type { SpellEntityType } from '../app/types/maestro';

/**
 * Hook to access spell entities with optional type filtering.
 */
export function useSpells(filterType?: SpellEntityType) {
  const { entities, entitiesByType, fetchEntities } = useSpellStore(
    useShallow((s) => ({
      entities: s.entities,
      entitiesByType: s.entitiesByType,
      fetchEntities: s.fetchEntities,
    }))
  );

  // Fetch on mount
  useEffect(() => {
    if (entities.length === 0) {
      fetchEntities();
    }
  }, [entities.length, fetchEntities]);

  const filtered = useMemo(() => {
    if (!filterType) return entities;
    return entitiesByType[filterType] ?? [];
  }, [entities, entitiesByType, filterType]);

  return { entities: filtered, allEntities: entities };
}
