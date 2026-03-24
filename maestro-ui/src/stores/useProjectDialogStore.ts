import { create } from 'zustand';
import { ProjectSoundConfig } from '../app/types/maestro';
import { DEFAULT_SOUND_INSTRUMENT } from '../app/constants/defaults';

interface ProjectDialogState {
  projectOpen: boolean;
  projectMode: 'new' | 'rename';
  projectTitle: string;
  projectBasePath: string;
  projectEnvironmentId: string;
  projectAssetsEnabled: boolean;
  projectSoundInstrument: string;
  projectSoundConfig: ProjectSoundConfig | undefined;
  confirmDeleteProjectOpen: boolean;
  deleteProjectError: string | null;
  deleteProjectId: string | null;
  setProjectOpen: (open: boolean) => void;
  setProjectMode: (mode: 'new' | 'rename') => void;
  setProjectTitle: (title: string) => void;
  setProjectBasePath: (path: string) => void;
  setProjectEnvironmentId: (id: string) => void;
  setProjectAssetsEnabled: (enabled: boolean) => void;
  setProjectSoundInstrument: (instrument: string) => void;
  setProjectSoundConfig: (config: ProjectSoundConfig | undefined) => void;
  setConfirmDeleteProjectOpen: (open: boolean) => void;
}

export const useProjectDialogStore = create<ProjectDialogState>((set) => ({
  projectOpen: false,
  projectMode: 'new',
  projectTitle: '',
  projectBasePath: '',
  projectEnvironmentId: '',
  projectAssetsEnabled: true,
  projectSoundInstrument: DEFAULT_SOUND_INSTRUMENT,
  projectSoundConfig: undefined,
  confirmDeleteProjectOpen: false,
  deleteProjectError: null,
  deleteProjectId: null,

  setProjectOpen: (open) => set({ projectOpen: open }),
  setProjectMode: (mode) => set({ projectMode: mode }),
  setProjectTitle: (title) => set({ projectTitle: title }),
  setProjectBasePath: (path) => set({ projectBasePath: path }),
  setProjectEnvironmentId: (id) => set({ projectEnvironmentId: id }),
  setProjectAssetsEnabled: (enabled) => set({ projectAssetsEnabled: enabled }),
  setProjectSoundInstrument: (instrument) => set({ projectSoundInstrument: instrument }),
  setProjectSoundConfig: (config) => set({ projectSoundConfig: config }),
  setConfirmDeleteProjectOpen: (open) => set({ confirmDeleteProjectOpen: open }),
}));
