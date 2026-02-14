/**
 * Sound Manager Service
 *
 * Centralized service for playing event-based sounds in the Maestro UI.
 * Supports multiple instruments with per-project configuration.
 */

import type { InstrumentType, ProjectSoundConfig, SoundCategoryType } from '../app/types/maestro';

export type { InstrumentType };
export type SoundCategory = SoundCategoryType;

export type EventSoundType =
  // WebSocket Events
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'session:created'
  | 'session:updated'
  | 'session:deleted'
  | 'session:task_added'
  | 'session:task_removed'
  | 'task:session_added'
  | 'task:session_removed'
  | 'subtask:created'
  | 'subtask:updated'
  | 'subtask:deleted'
  // Timeline Events
  | 'session_started'
  | 'session_stopped'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_skipped'
  | 'task_blocked'
  | 'needs_input'
  | 'progress'
  | 'error'
  | 'milestone'
  | 'doc_added'
  // Notification Events
  | 'notification:error'
  | 'notification:notice'
  | 'notification:critical'
  // Notify Events (dedicated notification sounds)
  | 'notify:task_completed'
  | 'notify:task_failed'
  | 'notify:task_blocked'
  | 'notify:task_session_completed'
  | 'notify:task_session_failed'
  | 'notify:session_completed'
  | 'notify:session_failed'
  | 'notify:needs_input'
  | 'notify:progress'
  // Status Changes
  | 'status:spawning'
  | 'status:idle'
  | 'status:working'
  | 'status:completed'
  | 'status:failed'
  | 'status:stopped'
  | 'status:todo'
  | 'status:in_progress'
  | 'status:cancelled'
  | 'status:blocked';

interface SoundNote {
  note: string;
  delay?: number; // Delay in ms before playing this note
}

// Map event types to sound categories
const EVENT_SOUND_MAP: Record<EventSoundType, SoundCategory> = {
  // WebSocket Events
  'task:created': 'creation',
  'task:updated': 'update',
  'task:deleted': 'deletion',
  'session:created': 'creation',
  'session:updated': 'update',
  'session:deleted': 'deletion',
  'session:task_added': 'link',
  'session:task_removed': 'unlink',
  'task:session_added': 'link',
  'task:session_removed': 'unlink',
  'subtask:created': 'creation',
  'subtask:updated': 'update',
  'subtask:deleted': 'deletion',
  // Timeline Events
  'session_started': 'success',
  'session_stopped': 'neutral',
  'task_started': 'action',
  'task_completed': 'success',
  'task_failed': 'error',
  'task_skipped': 'neutral',
  'task_blocked': 'warning',
  'needs_input': 'attention',
  'progress': 'progress',
  'error': 'error',
  'milestone': 'achievement',
  'doc_added': 'creation',
  // Notification Events
  'notification:error': 'error',
  'notification:notice': 'success',
  'notification:critical': 'critical_error',
  // Notify Events
  'notify:task_completed': 'notify_task_completed',
  'notify:task_failed': 'notify_task_failed',
  'notify:task_blocked': 'notify_task_blocked',
  'notify:task_session_completed': 'notify_task_session_completed',
  'notify:task_session_failed': 'notify_task_session_failed',
  'notify:session_completed': 'notify_session_completed',
  'notify:session_failed': 'notify_session_failed',
  'notify:needs_input': 'notify_needs_input',
  'notify:progress': 'notify_progress',
  // Status Changes
  'status:spawning': 'loading',
  'status:idle': 'loading',
  'status:working': 'action',
  'status:completed': 'success',
  'status:failed': 'error',
  'status:stopped': 'neutral',
  'status:todo': 'loading',
  'status:in_progress': 'action',
  'status:cancelled': 'neutral',
  'status:blocked': 'warning',
};

// Map sound categories to piano notes (used for note-based instruments)
const CATEGORY_NOTES: Record<SoundCategory, SoundNote[]> = {
  success: [
    { note: 'C5' },
    { note: 'E5', delay: 80 },
    { note: 'G5', delay: 160 },
  ],
  error: [
    { note: 'C2' },
    { note: 'Eb2', delay: 100 },
    { note: 'Gb2', delay: 200 },
  ],
  critical_error: [
    { note: 'C2' },
    { note: 'C2', delay: 150 },
    { note: 'C2', delay: 300 },
  ],
  warning: [
    { note: 'F3' },
    { note: 'F3', delay: 150 },
  ],
  attention: [
    { note: 'A4' },
  ],
  action: [
    { note: 'G4' },
  ],
  creation: [
    { note: 'C4' },
    { note: 'E4', delay: 100 },
  ],
  deletion: [
    { note: 'E4' },
    { note: 'C4', delay: 100 },
  ],
  update: [
    { note: 'D4' },
  ],
  progress: [
    { note: 'C4' },
    { note: 'D4', delay: 60 },
    { note: 'E4', delay: 120 },
  ],
  achievement: [
    { note: 'C5' },
    { note: 'E5', delay: 80 },
    { note: 'G5', delay: 160 },
    { note: 'C6', delay: 240 },
  ],
  neutral: [
    { note: 'A3' },
  ],
  link: [
    { note: 'C4' },
    { note: 'G4', delay: 50 },
  ],
  unlink: [
    { note: 'G4' },
    { note: 'C4', delay: 100 },
  ],
  loading: [
    { note: 'C4' },
    { note: 'G4', delay: 100 },
  ],
  // Notify-specific categories
  notify_task_completed: [
    { note: 'C5' },
    { note: 'E5', delay: 80 },
    { note: 'G5', delay: 160 },
  ],
  notify_task_failed: [
    { note: 'C2' },
    { note: 'Eb2', delay: 100 },
  ],
  notify_task_blocked: [
    { note: 'F3' },
    { note: 'Ab3', delay: 100 },
  ],
  notify_task_session_completed: [
    { note: 'G4' },
    { note: 'B4', delay: 80 },
  ],
  notify_task_session_failed: [
    { note: 'Eb2' },
    { note: 'Gb2', delay: 100 },
  ],
  notify_session_completed: [
    { note: 'C5' },
    { note: 'E5', delay: 80 },
    { note: 'G5', delay: 160 },
    { note: 'C6', delay: 240 },
  ],
  notify_session_failed: [
    { note: 'C2' },
    { note: 'Eb2', delay: 100 },
    { note: 'Gb2', delay: 200 },
  ],
  notify_needs_input: [
    { note: 'A4' },
    { note: 'A5', delay: 100 },
  ],
  notify_progress: [
    { note: 'D4' },
  ],
};

// ── Instrument Configuration Registry ──

interface InstrumentConfig {
  basePath: string;
  format: 'mp3' | 'wav';
  /** Available note names for this instrument (files on disk) */
  availableNotes: string[];
  /** For percussion-type instruments, map categories directly to file stems */
  percussionMap?: Record<string, string>;
}

const INSTRUMENT_CONFIGS: Record<InstrumentType, InstrumentConfig> = {
  piano: {
    basePath: '/music/piano-mp3',
    format: 'mp3',
    // Full chromatic range — original piano-mp3 files
    availableNotes: [
      'A0','Bb0','B0',
      'C1','Db1','D1','Eb1','E1','F1','Gb1','G1','Ab1','A1','Bb1','B1',
      'C2','Db2','D2','Eb2','E2','F2','Gb2','G2','Ab2','A2','Bb2','B2',
      'C3','Db3','D3','Eb3','E3','F3','Gb3','G3','Ab3','A3','Bb3','B3',
      'C4','Db4','D4','Eb4','E4','F4','Gb4','G4','Ab4','A4','Bb4','B4',
      'C5','Db5','D5','Eb5','E5','F5','Gb5','G5','Ab5','A5','Bb5','B5',
      'C6','Db6','D6','Eb6','E6','F6','Gb6','G6','Ab6','A6','Bb6','B6',
      'C7','Db7','D7','Eb7','E7','F7','Gb7','G7',
    ],
  },
  guitar: {
    basePath: '/music/guitar',
    format: 'wav',
    availableNotes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  },
  violin: {
    basePath: '/music/violin',
    format: 'wav',
    availableNotes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  },
  trumpet: {
    basePath: '/music/trumpet',
    format: 'wav',
    availableNotes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  },
  drums: {
    basePath: '/music/drums',
    format: 'wav',
    availableNotes: [],
    percussionMap: {
      success: 'drums_crash',
      error: 'drums_tom',
      critical_error: 'drums_kick',
      warning: 'drums_snare',
      attention: 'drums_ride',
      action: 'drums_hihat',
      creation: 'drums_snare',
      deletion: 'drums_tom',
      update: 'drums_hihat',
      progress: 'drums_hihat',
      achievement: 'drums_crash',
      neutral: 'drums_ride',
      link: 'drums_hihat',
      unlink: 'drums_snare',
      loading: 'drums_ride',
      notify_task_completed: 'drums_crash',
      notify_task_failed: 'drums_tom',
      notify_task_blocked: 'drums_snare',
      notify_task_session_completed: 'drums_crash',
      notify_task_session_failed: 'drums_tom',
      notify_session_completed: 'drums_crash',
      notify_session_failed: 'drums_tom',
      notify_needs_input: 'drums_ride',
      notify_progress: 'drums_hihat',
    },
  },
};

/**
 * Map a chromatic note name (e.g. "C5", "Eb2") to a simple letter note
 * for instruments that only have A-G WAV files.
 */
function chromaticToSimpleNote(note: string): string {
  // Strip octave and accidentals: "Eb2" -> "E", "C5" -> "C", "Gb2" -> "G"
  const match = note.match(/^([A-G])/);
  return match ? match[1] : 'C';
}

/**
 * Drums category note sequences — percussion maps categories to drum sounds
 */
function getDrumNotesForCategory(category: SoundCategory): SoundNote[] {
  const percMap = INSTRUMENT_CONFIGS.drums.percussionMap!;
  const baseStem = percMap[category] || 'drums_kick';

  // Use the same timing pattern as the original category notes
  const originalNotes = CATEGORY_NOTES[category];
  if (!originalNotes) return [{ note: baseStem }];

  // Map each note in the sequence to a drum sound, alternating between sounds
  const drumSounds = Object.values(percMap);
  return originalNotes.map((sn, i) => ({
    note: i === 0 ? baseStem : (drumSounds[(drumSounds.indexOf(baseStem) + i) % drumSounds.length] || baseStem),
    delay: sn.delay,
  }));
}

interface SoundManagerConfig {
  enabled: boolean;
  volume: number;
  maxConcurrentSounds: number;
  enabledCategories: Set<SoundCategory>;
  currentInstrument: InstrumentType;
}

class SoundManager {
  private static instance: SoundManager;
  private audioContext: Map<string, HTMLAudioElement> = new Map();
  private activeSounds: Set<HTMLAudioElement> = new Set();
  private config: SoundManagerConfig = {
    enabled: true,
    volume: 0.3,
    maxConcurrentSounds: 5,
    currentInstrument: 'piano',
    enabledCategories: new Set([
      'success',
      'error',
      'critical_error',
      'warning',
      'attention',
      'achievement',
      'notify_task_completed',
      'notify_task_failed',
      'notify_task_blocked',
      'notify_task_session_completed',
      'notify_task_session_failed',
      'notify_session_completed',
      'notify_session_failed',
      'notify_needs_input',
      'notify_progress',
    ]),
  };

  // Project-level configs
  private projectConfigs: Map<string, ProjectSoundConfig> = new Map();
  private activeProjectId: string | null = null;

  // Debounce map to prevent sound spam
  private lastPlayedTime: Map<string, number> = new Map();
  private debounceMs = 100;

  private constructor() {
    this.loadConfig();
    this.loadProjectConfigs();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('maestro-sound-config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = {
          ...this.config,
          ...parsed,
          enabledCategories: new Set(parsed.enabledCategories || []),
        };
      }
    } catch (error) {
      console.error('[SoundManager] Failed to load config:', error);
    }
  }

  private saveConfig(): void {
    try {
      const toSave = {
        ...this.config,
        enabledCategories: Array.from(this.config.enabledCategories),
      };
      localStorage.setItem('maestro-sound-config', JSON.stringify(toSave));
    } catch (error) {
      console.error('[SoundManager] Failed to save config:', error);
    }
  }

  private loadProjectConfigs(): void {
    try {
      const stored = localStorage.getItem('maestro-project-sound-configs');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, ProjectSoundConfig>;
        this.projectConfigs = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('[SoundManager] Failed to load project configs:', error);
    }
  }

  private saveProjectConfigs(): void {
    try {
      const obj: Record<string, ProjectSoundConfig> = {};
      this.projectConfigs.forEach((config, id) => { obj[id] = config; });
      localStorage.setItem('maestro-project-sound-configs', JSON.stringify(obj));
    } catch (error) {
      console.error('[SoundManager] Failed to save project configs:', error);
    }
  }

  /**
   * Resolve the effective instrument and enabled categories for the current context.
   * Project config overrides global config.
   */
  private getEffectiveConfig(): { instrument: InstrumentType; enabledCategories: Set<SoundCategory> } {
    if (this.activeProjectId) {
      const projectConfig = this.projectConfigs.get(this.activeProjectId);
      if (projectConfig) {
        return {
          instrument: projectConfig.instrument,
          enabledCategories: projectConfig.enabledCategories
            ? new Set(projectConfig.enabledCategories)
            : this.config.enabledCategories,
        };
      }
    }
    return {
      instrument: this.config.currentInstrument,
      enabledCategories: this.config.enabledCategories,
    };
  }

  /**
   * Resolve instrument for a specific category (checking category overrides).
   */
  private getEffectiveInstrumentForCategory(category: SoundCategory): InstrumentType {
    if (this.activeProjectId) {
      const projectConfig = this.projectConfigs.get(this.activeProjectId);
      if (projectConfig?.categoryOverrides?.[category]?.instrument) {
        return projectConfig.categoryOverrides[category].instrument!;
      }
      if (projectConfig) {
        return projectConfig.instrument;
      }
    }
    return this.config.currentInstrument;
  }

  /**
   * Check if a category is enabled (checking project-level category overrides).
   */
  private isCategoryEffectivelyEnabled(category: SoundCategory): boolean {
    if (this.activeProjectId) {
      const projectConfig = this.projectConfigs.get(this.activeProjectId);
      if (projectConfig?.categoryOverrides?.[category]) {
        const override = projectConfig.categoryOverrides[category];
        if (typeof override.enabled === 'boolean') {
          return override.enabled;
        }
      }
      if (projectConfig?.enabledCategories) {
        return projectConfig.enabledCategories.includes(category);
      }
    }
    return this.config.enabledCategories.has(category);
  }

  /**
   * Get or create an audio element for a specific note with a specific instrument.
   */
  private getAudioElement(note: string, instrument: InstrumentType): HTMLAudioElement {
    const key = `${instrument}:${note}`;

    if (!this.audioContext.has(key)) {
      const config = INSTRUMENT_CONFIGS[instrument];
      let src: string;

      if (instrument === 'piano') {
        // Piano has full chromatic MP3 files
        src = `${config.basePath}/${note}.${config.format}`;
      } else if (instrument === 'drums') {
        // Drums: note IS the file stem (e.g. "drums_crash")
        src = `${config.basePath}/${note}.${config.format}`;
      } else {
        // Guitar, violin, trumpet: WAV files named {instrument}_{letter}.wav
        const simpleLetter = chromaticToSimpleNote(note);
        src = `${config.basePath}/${instrument}_${simpleLetter}.${config.format}`;
      }

      const audio = new Audio(src);
      audio.volume = this.config.volume;

      // Fallback to piano if instrument file doesn't exist
      audio.addEventListener('error', () => {
        if (instrument !== 'piano') {
          console.warn(`[SoundManager] ${instrument} file not found (${src}), falling back to piano`);
          const fallback = new Audio(`/music/piano-mp3/${note}.mp3`);
          fallback.volume = this.config.volume;
          this.audioContext.set(key, fallback);
        }
      }, { once: true });

      this.audioContext.set(key, audio);
    }

    return this.audioContext.get(key)!;
  }

  private async playNote(note: string, instrument: InstrumentType): Promise<void> {
    if (!this.config.enabled) return;
    if (this.activeSounds.size >= this.config.maxConcurrentSounds) {
      console.warn('[SoundManager] Max concurrent sounds reached, skipping');
      return;
    }

    try {
      const original = this.getAudioElement(note, instrument);
      console.log(`[SoundManager] Playing note ${note} (${instrument}), src=${original.src}`);
      const audio = original.cloneNode(true) as HTMLAudioElement;
      audio.volume = this.config.volume;

      this.activeSounds.add(audio);

      audio.addEventListener('ended', () => {
        this.activeSounds.delete(audio);
      });

      audio.addEventListener('error', (e) => {
        console.error(`[SoundManager] Audio error for note ${note}:`, e);
        this.activeSounds.delete(audio);
      });

      await audio.play();
    } catch (error) {
      console.error(`[SoundManager] Failed to play note ${note}:`, error);
    }
  }

  private async playNotes(notes: SoundNote[], instrument: InstrumentType): Promise<void> {
    for (const { note, delay = 0 } of notes) {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      await this.playNote(note, instrument);
    }
  }

  private shouldDebounce(eventType: string): boolean {
    const now = Date.now();
    const lastPlayed = this.lastPlayedTime.get(eventType);

    if (lastPlayed && now - lastPlayed < this.debounceMs) {
      return true;
    }

    this.lastPlayedTime.set(eventType, now);
    return false;
  }

  /**
   * Get the note sequence for a category, adapted for the given instrument.
   */
  private getNotesForCategory(category: SoundCategory, instrument: InstrumentType): SoundNote[] {
    if (instrument === 'drums') {
      return getDrumNotesForCategory(category);
    }
    return CATEGORY_NOTES[category] || [];
  }

  /**
   * Play sound for a specific event type
   */
  public async playEventSound(eventType: EventSoundType): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    if (this.shouldDebounce(eventType)) {
      return;
    }

    const category = EVENT_SOUND_MAP[eventType];
    if (!category) {
      console.warn(`[SoundManager] No sound category for event: ${eventType}`);
      return;
    }

    if (!this.isCategoryEffectivelyEnabled(category)) {
      return;
    }

    const instrument = this.getEffectiveInstrumentForCategory(category);
    const notes = this.getNotesForCategory(category, instrument);
    if (!notes.length) {
      console.warn(`[SoundManager] No notes defined for category: ${category}`);
      return;
    }

    console.log(`[SoundManager] Playing ${eventType} -> category="${category}", instrument=${instrument}`);
    await this.playNotes(notes, instrument);
  }

  /**
   * Play sound for a specific category directly
   */
  public async playCategorySound(category: SoundCategory, instrumentOverride?: InstrumentType): Promise<void> {
    if (!this.config.enabled) return;
    if (!instrumentOverride && !this.isCategoryEffectivelyEnabled(category)) return;

    const instrument = instrumentOverride || this.getEffectiveInstrumentForCategory(category);
    const notes = this.getNotesForCategory(category, instrument);
    if (!notes.length) {
      console.warn(`[SoundManager] No notes defined for category: ${category}`);
      return;
    }

    await this.playNotes(notes, instrument);
  }

  // ── Project config methods ──

  public setProjectConfig(projectId: string, config: ProjectSoundConfig): void {
    this.projectConfigs.set(projectId, config);
    this.saveProjectConfigs();
    // Clear audio cache if this is the active project (instrument may have changed)
    if (this.activeProjectId === projectId) {
      this.audioContext.clear();
    }
  }

  public getProjectConfig(projectId: string): ProjectSoundConfig | undefined {
    return this.projectConfigs.get(projectId);
  }

  public removeProjectConfig(projectId: string): void {
    this.projectConfigs.delete(projectId);
    this.saveProjectConfigs();
  }

  public setActiveProject(projectId: string | null): void {
    if (this.activeProjectId === projectId) return;
    this.activeProjectId = projectId;
    // Clear audio cache to force reload with potentially different instrument
    this.audioContext.clear();
    console.log(`[SoundManager] Active project set to: ${projectId}`);
  }

  public getActiveProjectId(): string | null {
    return this.activeProjectId;
  }

  // ── Global config methods ──

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
    this.saveConfig();

    this.audioContext.forEach(audio => {
      audio.volume = this.config.volume;
    });
  }

  public getVolume(): number {
    return this.config.volume;
  }

  public setCategoryEnabled(category: SoundCategory, enabled: boolean): void {
    if (enabled) {
      this.config.enabledCategories.add(category);
    } else {
      this.config.enabledCategories.delete(category);
    }
    this.saveConfig();
  }

  public isCategoryEnabled(category: SoundCategory): boolean {
    return this.config.enabledCategories.has(category);
  }

  public getEnabledCategories(): SoundCategory[] {
    return Array.from(this.config.enabledCategories);
  }

  public setMaxConcurrentSounds(max: number): void {
    this.config.maxConcurrentSounds = Math.max(1, max);
    this.saveConfig();
  }

  public getConfig(): Readonly<SoundManagerConfig> {
    return {
      ...this.config,
      enabledCategories: new Set(this.config.enabledCategories),
    };
  }

  public setInstrument(instrument: InstrumentType): void {
    if (this.config.currentInstrument === instrument) return;

    console.log(`[SoundManager] Switching global instrument from ${this.config.currentInstrument} to ${instrument}`);
    this.config.currentInstrument = instrument;

    this.audioContext.clear();
    this.saveConfig();
  }

  public getInstrument(): InstrumentType {
    return this.config.currentInstrument;
  }

  public stopAll(): void {
    this.activeSounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.activeSounds.clear();
  }

  public preloadSounds(): void {
    const { instrument } = this.getEffectiveConfig();
    const commonNotes = new Set<string>();

    if (instrument === 'drums') {
      const percMap = INSTRUMENT_CONFIGS.drums.percussionMap!;
      Object.values(percMap).forEach(stem => commonNotes.add(stem));
    } else {
      Object.values(CATEGORY_NOTES).forEach(notes => {
        notes.forEach(({ note }) => commonNotes.add(note));
      });
    }

    commonNotes.forEach(note => {
      this.getAudioElement(note, instrument);
    });

    console.log(`[SoundManager] Preloaded ${commonNotes.size} sound files for ${instrument}`);
  }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance();

// Helper function for easy imports
export function playEventSound(eventType: EventSoundType): void {
  soundManager.playEventSound(eventType).catch(err => {
    console.error('[SoundManager] Error playing event sound:', err);
  });
}

export function playCategorySound(category: SoundCategory): void {
  soundManager.playCategorySound(category).catch(err => {
    console.error('[SoundManager] Error playing category sound:', err);
  });
}
