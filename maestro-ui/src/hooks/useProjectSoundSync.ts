/**
 * useProjectSoundSync Hook
 *
 * Synchronizes sound manager with active project's sound configuration.
 * When the active project changes, loads the full ProjectSoundConfig
 * into the sound manager (instrument + category overrides).
 */

import { useEffect } from 'react';
import { useProjectStore } from '../stores/useProjectStore';
import { soundManager } from '../services/soundManager';
import type { InstrumentType } from '../app/types/maestro';

export function useProjectSoundSync() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projects = useProjectStore((state) => state.projects);

  useEffect(() => {
    if (!activeProjectId) {
      soundManager.setActiveProject(null);
      return;
    }

    const activeProject = projects.find((p) => p.id === activeProjectId);
    if (!activeProject) {
      soundManager.setActiveProject(null);
      return;
    }

    // Set the active project so the sound manager resolves project-level config
    soundManager.setActiveProject(activeProjectId);

    // If the project has a full soundConfig, load it into the sound manager
    if (activeProject.soundConfig) {
      soundManager.setProjectConfig(activeProjectId, activeProject.soundConfig);
    } else if (activeProject.soundInstrument) {
      // Legacy fallback: use the old soundInstrument field
      soundManager.setInstrument(activeProject.soundInstrument as InstrumentType);
    }

    console.log(
      `[useProjectSoundSync] Switched to project "${activeProject.name}"`,
      activeProject.soundConfig
        ? `with soundConfig (instrument: ${activeProject.soundConfig.instrument})`
        : `with instrument: ${activeProject.soundInstrument || 'piano (default)'}`,
    );
  }, [activeProjectId, projects]);
}
