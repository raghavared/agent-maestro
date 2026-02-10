/**
 * useSoundEffects Hook
 *
 * React hook that integrates the sound manager with the Maestro UI event system.
 * Automatically plays sounds for WebSocket events, timeline events, and notifications.
 */

import { useEffect, useCallback } from 'react';
import { soundManager, type EventSoundType } from '../services/soundManager';
import type { SessionTimelineEventType } from '../app/types/maestro';

interface UseSoundEffectsOptions {
  /**
   * Enable sound effects
   * @default true
   */
  enabled?: boolean;

  /**
   * Enable sounds for WebSocket events
   * @default true
   */
  enableWebSocketEvents?: boolean;

  /**
   * Enable sounds for timeline events
   * @default true
   */
  enableTimelineEvents?: boolean;

  /**
   * Enable sounds for notifications
   * @default true
   */
  enableNotifications?: boolean;
}

export function useSoundEffects(options: UseSoundEffectsOptions = {}) {
  const {
    enabled = true,
    enableWebSocketEvents = true,
    enableTimelineEvents = true,
    enableNotifications = true,
  } = options;

  // Initialize and preload sounds on mount
  useEffect(() => {
    if (enabled) {
      soundManager.setEnabled(true);
      soundManager.preloadSounds();
    }

    return () => {
      soundManager.stopAll();
    };
  }, [enabled]);

  /**
   * Play sound for a WebSocket event
   */
  const playWebSocketEvent = useCallback((eventType: string) => {
    if (!enabled || !enableWebSocketEvents) return;

    // Map WebSocket event names to sound event types
    const soundEventType = eventType as EventSoundType;
    soundManager.playEventSound(soundEventType);
  }, [enabled, enableWebSocketEvents]);

  /**
   * Play sound for a timeline event
   */
  const playTimelineEvent = useCallback((eventType: SessionTimelineEventType) => {
    if (!enabled || !enableTimelineEvents) return;

    // Timeline event types map directly to sound event types
    const soundEventType = eventType as EventSoundType;
    soundManager.playEventSound(soundEventType);
  }, [enabled, enableTimelineEvents]);

  /**
   * Play sound for a notification
   */
  const playNotification = useCallback((type: 'error' | 'notice' | 'critical') => {
    if (!enabled || !enableNotifications) return;

    const soundEventType = `notification:${type}` as EventSoundType;
    soundManager.playEventSound(soundEventType);
  }, [enabled, enableNotifications]);

  /**
   * Play sound for a status change
   */
  const playStatusChange = useCallback((status: string) => {
    if (!enabled) return;

    const soundEventType = `status:${status}` as EventSoundType;
    soundManager.playEventSound(soundEventType);
  }, [enabled]);

  return {
    playWebSocketEvent,
    playTimelineEvent,
    playNotification,
    playStatusChange,
    soundManager,
  };
}
