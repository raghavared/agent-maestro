/**
 * Sound Manager Service
 *
 * Centralized service for playing event-based sounds in the Maestro UI.
 * Supports multiple instruments with per-project configuration.
 */

export type InstrumentType = 'piano' | 'guitar' | 'strings' | 'bells' | 'marimba';

export type SoundCategory =
  | 'success'
  | 'error'
  | 'critical_error'
  | 'warning'
  | 'attention'
  | 'action'
  | 'creation'
  | 'deletion'
  | 'update'
  | 'progress'
  | 'achievement'
  | 'neutral'
  | 'link'
  | 'unlink'
  | 'loading'
  // Notify-specific categories (unique piano tone signatures)
  | 'notify_task_completed'
  | 'notify_task_failed'
  | 'notify_task_blocked'
  | 'notify_task_session_completed'
  | 'notify_task_session_failed'
  | 'notify_session_completed'
  | 'notify_session_failed'
  | 'notify_needs_input'
  | 'notify_progress';

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

// Map sound categories to piano notes
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
  // Notify-specific categories (piano tone mapping from plan)
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
    volume: 0.3, // 30% volume by default
    maxConcurrentSounds: 5,
    currentInstrument: 'piano',
    enabledCategories: new Set([
      'success',
      'error',
      'critical_error',
      'warning',
      'attention',
      'achievement',
      // Notify categories (all enabled by default)
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

  // Debounce map to prevent sound spam
  private lastPlayedTime: Map<string, number> = new Map();
  private debounceMs = 100; // Minimum time between same sound events

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Load configuration from localStorage
   */
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

  /**
   * Save configuration to localStorage
   */
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

  /**
   * Get or create an audio element for a specific note with current instrument
   */
  private getAudioElement(note: string): HTMLAudioElement {
    const instrument = this.config.currentInstrument;
    const key = `${instrument}:${note}`;

    if (!this.audioContext.has(key)) {
      // Use piano-mp3 for all instruments for now (can be extended later)
      const audio = new Audio(`/music/${instrument}-mp3/${note}.mp3`);
      audio.volume = this.config.volume;

      // Fallback to piano if instrument file doesn't exist
      audio.addEventListener('error', () => {
        if (instrument !== 'piano') {
          console.warn(`[SoundManager] ${instrument} not found, falling back to piano`);
          const fallback = new Audio(`/music/piano-mp3/${note}.mp3`);
          fallback.volume = this.config.volume;
          this.audioContext.set(key, fallback);
        }
      }, { once: true });

      this.audioContext.set(key, audio);
    }

    return this.audioContext.get(key)!;
  }

  /**
   * Play a single note
   */
  private async playNote(note: string): Promise<void> {
    if (!this.config.enabled) return;
    if (this.activeSounds.size >= this.config.maxConcurrentSounds) {
      console.warn('[SoundManager] Max concurrent sounds reached, skipping');
      return;
    }

    try {
      // Clone the audio element to allow overlapping sounds
      const original = this.getAudioElement(note);
      console.log(`[SoundManager] 🎵 Playing note ${note}, src=${original.src}, volume=${this.config.volume}`);
      const audio = original.cloneNode(true) as HTMLAudioElement;
      audio.volume = this.config.volume;

      this.activeSounds.add(audio);

      audio.addEventListener('ended', () => {
        this.activeSounds.delete(audio);
      });

      audio.addEventListener('error', (e) => {
        console.error(`[SoundManager] ❌ Audio error for note ${note}:`, e);
      });

      await audio.play();
      console.log(`[SoundManager] ✅ Note ${note} playing`);
    } catch (error) {
      console.error(`[SoundManager] ❌ Failed to play note ${note}:`, error);
    }
  }

  /**
   * Play a sequence of notes with delays
   */
  private async playNotes(notes: SoundNote[]): Promise<void> {
    for (const { note, delay = 0 } of notes) {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      await this.playNote(note);
    }
  }

  /**
   * Check if enough time has passed since last play (debounce)
   */
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
   * Play sound for a specific event type
   */
  public async playEventSound(eventType: EventSoundType): Promise<void> {
    if (!this.config.enabled) {
      console.log(`[SoundManager] ⛔ Sound disabled globally, skipping: ${eventType}`);
      return;
    }
    if (this.shouldDebounce(eventType)) {
      console.log(`[SoundManager] ⛔ Debounced, skipping: ${eventType}`);
      return;
    }

    const category = EVENT_SOUND_MAP[eventType];
    if (!category) {
      console.warn(`[SoundManager] No sound category for event: ${eventType}`);
      return;
    }

    if (!this.config.enabledCategories.has(category)) {
      console.log(`[SoundManager] ⛔ Category "${category}" is muted, skipping: ${eventType}`);
      return;
    }

    const notes = CATEGORY_NOTES[category];
    if (!notes) {
      console.warn(`[SoundManager] No notes defined for category: ${category}`);
      return;
    }

    console.log(`[SoundManager] 🔊 Playing ${eventType} -> category="${category}", notes=[${notes.map(n => n.note).join(', ')}]`);
    await this.playNotes(notes);
  }

  /**
   * Play sound for a specific category directly
   */
  public async playCategorySound(category: SoundCategory): Promise<void> {
    if (!this.config.enabled) return;
    if (!this.config.enabledCategories.has(category)) return;

    const notes = CATEGORY_NOTES[category];
    if (!notes) {
      console.warn(`[SoundManager] No notes defined for category: ${category}`);
      return;
    }

    await this.playNotes(notes);
  }

  // Configuration methods

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

    // Update volume for all cached audio elements
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

    console.log(`[SoundManager] Switching instrument from ${this.config.currentInstrument} to ${instrument}`);
    this.config.currentInstrument = instrument;

    // Clear audio cache to force reload with new instrument
    this.audioContext.clear();
    this.saveConfig();
  }

  public getInstrument(): InstrumentType {
    return this.config.currentInstrument;
  }

  /**
   * Stop all currently playing sounds
   */
  public stopAll(): void {
    this.activeSounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.activeSounds.clear();
  }

  /**
   * Preload commonly used sounds
   */
  public preloadSounds(): void {
    const commonNotes = new Set<string>();

    // Collect all unique notes from all categories
    Object.values(CATEGORY_NOTES).forEach(notes => {
      notes.forEach(({ note }) => commonNotes.add(note));
    });

    // Preload each note
    commonNotes.forEach(note => {
      this.getAudioElement(note);
    });

    console.log(`[SoundManager] Preloaded ${commonNotes.size} sound files`);
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
