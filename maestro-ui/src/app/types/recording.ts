
export type RecordingMeta = {
  schemaVersion: number;
  createdAt: number;
  name?: string | null;
  projectId: string;
  sessionPersistId: string;
  cwd: string | null;
  effectId?: string | null;
  bootstrapCommand?: string | null;
  encrypted?: boolean | null;
};

export type RecordingEvent = { t: number; data: string };

export type LoadedRecording = {
  recordingId: string;
  meta: RecordingMeta | null;
  events: RecordingEvent[];
};

export type RecordingIndexEntry = {
  recordingId: string;
  meta: RecordingMeta | null;
};
