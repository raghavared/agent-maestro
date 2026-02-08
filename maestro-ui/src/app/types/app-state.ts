import { EnvironmentConfig } from "./app";
import { MaestroProject } from "./maestro";
import { PersistedTerminalSession } from "./session";

export type PtyOutput = { id: string; data: string };
export type PtyExit = { id: string; exit_code?: number | null };
export type AppInfo = { name: string; version: string; homepage?: string | null };
export type AppMenuEventPayload = { id: string };
export type StartupFlags = { clearData: boolean };
export type TrayMenuEventPayload = {
  id: string;
  effectId?: string | null;
  projectId?: string | null;
  persistId?: string | null;
};
export type RecentSessionKey = { projectId: string; persistId: string };
export  type TrayRecentSession = { label: string; projectId: string; persistId: string };

// Buffer for data that arrives before terminal is ready
export type PendingDataBuffer = Map<string, string[]>;

export type SecureStorageMode = "keychain" | "plaintext";

export type PersistedStateV1 = {
  schemaVersion: number;
  secureStorageMode?: SecureStorageMode;
  projects: MaestroProject[];
  activeProjectId: string;
  sessions: PersistedTerminalSession[];
  activeSessionByProject: Record<string, string>;
  prompts?: Prompt[];
  environments?: EnvironmentConfig[];
  assets?: AssetTemplate[];
  assetSettings?: AssetSettings;
  agentShortcutIds?: string[];
};

export type PersistedStateMetaV1 = {
  schemaVersion: number;
  environmentCount: number;
  encryptedEnvironmentCount: number;
  secureStorageMode?: SecureStorageMode;
};

export type DirectoryEntry = { name: string; path: string };
export type DirectoryListing = { path: string; parent: string | null; entries: DirectoryEntry[] };

export type PersistentSessionInfo = { persistId: string; sessionName: string };

export type Prompt = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  pinned?: boolean;
  pinOrder?: number;
};


export type AssetTemplate = {
  id: string;
  name: string;
  relativePath: string;
  content: string;
  createdAt: number;
  autoApply?: boolean;
};

export type AssetSettings = {
  autoApplyEnabled: boolean;
};

export type ApplyAssetTarget = "project" | "tab";

export  type ApplyAssetRequest = {
  assetId: string;
  target: ApplyAssetTarget;
  dir: string;
};
