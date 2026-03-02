/**
 * useTeamMemberSoundSync Hook
 *
 * Synchronizes team member instruments with the SoundManager registry.
 * When team members are loaded or updated, their soundInstrument is registered
 * so that session-level sound combination knows which voice each member plays.
 *
 * Also unregisters members that have been removed from the store to prevent
 * stale instrument mappings.
 */

import { useEffect, useRef } from 'react';
import { soundManager } from '../services/soundManager';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { InstrumentType } from '../app/types/maestro';

export function useTeamMemberSoundSync() {
  const teamMembers = useMaestroStore((state) => state.teamMembers);
  const previousIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set<string>();

    // Register all current team members' instruments
    teamMembers.forEach((member) => {
      currentIds.add(member.id);
      if (member.soundInstrument) {
        soundManager.registerTeamMember(member.id, member.soundInstrument as InstrumentType);
      }
    });

    // Unregister members that were previously tracked but are no longer present
    previousIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        soundManager.unregisterTeamMember(id);
      }
    });

    previousIdsRef.current = currentIds;
  }, [teamMembers]);
}
