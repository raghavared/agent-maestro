export type TerminalSessionInfo = {
  id: string;
  name: string;
  command: string;
  cwd?: string | null;
};

export type TerminalSession = TerminalSessionInfo & {
  projectId: string;
  persistId: string;
  persistent: boolean;
  createdAt: number;
  launchCommand: string | null;
  restoreCommand?: string | null;
  sshTarget: string | null;
  sshRootDir: string | null;
  lastRecordingId?: string | null;
  recordingActive?: boolean;
  cwd: string | null;
  effectId?: string | null;
  agentWorking?: boolean;
  processTag?: string | null;
  exited?: boolean;
  closing?: boolean;
  exitCode?: number | null;
  maestroSessionId?: string | null;
};

export type PersistedTerminalSession = {
  persistId: string;
  projectId: string;
  name: string;
  launchCommand: string | null;
  restoreCommand?: string | null;
  sshTarget?: string | null;
  sshRootDir?: string | null;
  lastRecordingId?: string | null;
  cwd: string | null;
  persistent?: boolean;
  createdAt: number;
  maestroSessionId?: string | null;
  backendSessionId?: string;
};
