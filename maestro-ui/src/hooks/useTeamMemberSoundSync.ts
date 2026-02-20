/**
 * useTeamMemberSoundSync Hook
 *
 * Synchronizes team member instruments with the SoundManager registry.
 * When team members are loaded or updated, their soundInstrument is registered
 * so that session-level sound combination knows which voice each member plays.
 */

import { useEffect } from 'react';
import { soundManager } from '../services/soundManager';
import { useMaestroStore } from '../stores/useMaestroStore';
import type { InstrumentType } from '../app/types/maestro';

export function useTeamMemberSoundSync() {
  const teamMembers = useMaestroStore((state) => state.teamMembers);

  useEffect(() => {
    // Register all team members' instruments in the sound manager
    teamMembers.forEach((member) => {
      if (member.soundInstrument) {
        soundManager.registerTeamMember(member.id, member.soundInstrument as InstrumentType);
      }
    });

    // Note: we don't unregister members here because they may still be referenced
    // by session events. The registry is small and doesn't need cleanup on each render.
  }, [teamMembers]);
}
