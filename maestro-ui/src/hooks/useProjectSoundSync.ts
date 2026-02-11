/**
 * useProjectSoundSync Hook
 *
 * Synchronizes sound manager instrument with active project settings.
 * When the active project changes, updates the sound manager to use
 * that project's configured instrument.
 */

import { useEffect } from 'react';
import { useProjectStore } from '../stores/useProjectStore';
import { soundManager } from '../services/soundManager';

export function useProjectSoundSync() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projects = useProjectStore((state) => state.projects);

  useEffect(() => {
    if (!activeProjectId) return;

    const activeProject = projects.find((p) => p.id === activeProjectId);
    if (!activeProject) return;

    // Get the project's configured instrument (default to 'piano')
    const instrument = activeProject.soundInstrument || 'piano';

    // Update sound manager to use this instrument
    soundManager.setInstrument(instrument as any);

    console.log(`[useProjectSoundSync] Switched to project "${activeProject.name}" with instrument: ${instrument}`);
  }, [activeProjectId, projects]);
}
