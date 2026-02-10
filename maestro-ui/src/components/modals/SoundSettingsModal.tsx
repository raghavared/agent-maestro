/**
 * Sound Settings Modal
 *
 * UI component for managing sound effect preferences in Maestro.
 */

import React, { useState, useEffect } from 'react';
import { soundManager, type SoundCategory } from '../../services/soundManager';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<SoundCategory, string> = {
  success: 'Success',
  error: 'Errors',
  critical_error: 'Critical Errors',
  warning: 'Warnings',
  attention: 'Attention Required',
  action: 'Actions',
  creation: 'Creation',
  deletion: 'Deletion',
  update: 'Updates',
  progress: 'Progress',
  achievement: 'Achievements',
  neutral: 'Neutral Events',
  link: 'Link Events',
  unlink: 'Unlink Events',
  loading: 'Loading',
  // Notify categories
  notify_task_completed: 'Task Completed (notify)',
  notify_task_failed: 'Task Failed (notify)',
  notify_task_blocked: 'Task Blocked (notify)',
  notify_task_session_completed: 'Session Task Completed (notify)',
  notify_task_session_failed: 'Session Task Failed (notify)',
  notify_session_completed: 'Session Completed (notify)',
  notify_session_failed: 'Session Failed (notify)',
  notify_needs_input: 'Needs Input (notify)',
  notify_progress: 'Progress (notify)',
};

const CATEGORY_DESCRIPTIONS: Record<SoundCategory, string> = {
  success: 'Task completions, session starts, successful operations',
  error: 'Task failures, errors, failed operations',
  critical_error: 'Unexpected errors and unhandled rejections',
  warning: 'Blocked tasks and warning conditions',
  attention: 'Events requiring user input or attention',
  action: 'Task starts and active work',
  creation: 'Creating tasks, sessions, and documents',
  deletion: 'Deleting tasks, sessions, and documents',
  update: 'Task and session updates',
  progress: 'Progress updates during work',
  achievement: 'Milestones and major accomplishments',
  neutral: 'Neutral events like session stops',
  link: 'Linking tasks and sessions',
  unlink: 'Unlinking tasks and sessions',
  loading: 'Loading states and spawning',
  // Notify categories
  notify_task_completed: 'Bright ascending major triad when a task completes',
  notify_task_failed: 'Low minor third when a task is cancelled',
  notify_task_blocked: 'Mid-range minor third when a task is blocked',
  notify_task_session_completed: 'Gentle major third when a session finishes its task',
  notify_task_session_failed: 'Low diminished when a session fails a task',
  notify_session_completed: 'Major chord + octave when a session completes',
  notify_session_failed: 'Diminished triad when a session fails',
  notify_needs_input: 'Bell-like octave jump when input is needed',
  notify_progress: 'Single soft note for progress updates',
};

// Group categories for better organization
const CATEGORY_GROUPS = {
  'High Priority': ['success', 'error', 'critical_error', 'warning', 'attention', 'achievement'] as SoundCategory[],
  'Activity': ['action', 'progress', 'loading'] as SoundCategory[],
  'Changes': ['creation', 'deletion', 'update'] as SoundCategory[],
  'Relationships': ['link', 'unlink'] as SoundCategory[],
  'Other': ['neutral'] as SoundCategory[],
  'Notifications': [
    'notify_task_completed', 'notify_task_failed', 'notify_task_blocked',
    'notify_task_session_completed', 'notify_task_session_failed',
    'notify_session_completed', 'notify_session_failed',
    'notify_needs_input', 'notify_progress',
  ] as SoundCategory[],
};

export function SoundSettingsContent() {
  const [enabled, setEnabled] = useState(soundManager.isEnabled());
  const [volume, setVolume] = useState(soundManager.getVolume());
  const [enabledCategories, setEnabledCategories] = useState<Set<SoundCategory>>(
    new Set(soundManager.getEnabledCategories())
  );

  // Sync state with sound manager on mount
  useEffect(() => {
    setEnabled(soundManager.isEnabled());
    setVolume(soundManager.getVolume());
    setEnabledCategories(new Set(soundManager.getEnabledCategories()));
  }, []);

  const handleEnabledChange = (value: boolean) => {
    setEnabled(value);
    soundManager.setEnabled(value);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    soundManager.setVolume(newVolume);
  };

  const handleCategoryToggle = (category: SoundCategory) => {
    const newEnabled = !enabledCategories.has(category);
    soundManager.setCategoryEnabled(category, newEnabled);

    const newSet = new Set(enabledCategories);
    if (newEnabled) {
      newSet.add(category);
    } else {
      newSet.delete(category);
    }
    setEnabledCategories(newSet);

    // Play a preview sound
    if (newEnabled && enabled) {
      soundManager.playCategorySound(category);
    }
  };

  const handleTestSound = (category: SoundCategory) => {
    if (enabled) {
      soundManager.playCategorySound(category);
    }
  };

  const handleEnableAll = () => {
    const allCategories = Object.keys(CATEGORY_LABELS) as SoundCategory[];
    allCategories.forEach(cat => soundManager.setCategoryEnabled(cat, true));
    setEnabledCategories(new Set(allCategories));
  };

  const handleDisableAll = () => {
    const allCategories = Object.keys(CATEGORY_LABELS) as SoundCategory[];
    allCategories.forEach(cat => soundManager.setCategoryEnabled(cat, false));
    setEnabledCategories(new Set());
  };

  return (
    <div className="soundSettingsContent">
      {/* Master Enable/Disable */}
      <div className="soundSettingSection">
        <div className="soundSettingRow soundMasterToggle">
          <label className="soundSettingLabel">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => handleEnabledChange(e.target.checked)}
            />
            <span className="soundSettingTitle">Enable Sound Effects</span>
          </label>
        </div>
      </div>

      {/* Volume Control */}
      <div className="soundSettingSection">
        <div className="soundSettingRow">
          <label className="soundSettingLabel">
            <span className="soundSettingTitle">Volume</span>
            <div className="soundSettingVolume">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                disabled={!enabled}
                className="soundVolumeSlider"
              />
              <span className="soundVolumeValue">{Math.round(volume * 100)}%</span>
            </div>
          </label>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="soundSettingSection">
        <div className="soundBulkActions">
          <button
            onClick={handleEnableAll}
            disabled={!enabled}
            className="soundBulkBtn"
          >
            Enable All
          </button>
          <button
            onClick={handleDisableAll}
            disabled={!enabled}
            className="soundBulkBtn"
          >
            Disable All
          </button>
        </div>
      </div>

      {/* Category Groups */}
      {Object.entries(CATEGORY_GROUPS).map(([groupName, categories]) => (
        <div key={groupName} className="soundSettingSection">
          <h3 className="soundSettingGroupTitle">{groupName}</h3>
          {categories.map(category => (
            <div key={category} className="soundSettingRow">
              <label className="soundSettingLabel">
                <input
                  type="checkbox"
                  checked={enabledCategories.has(category)}
                  onChange={() => handleCategoryToggle(category)}
                  disabled={!enabled}
                />
                <div className="soundSettingInfo">
                  <span className="soundSettingTitle">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className="soundSettingDescription">
                    {CATEGORY_DESCRIPTIONS[category]}
                  </span>
                </div>
              </label>
              <button
                onClick={() => handleTestSound(category)}
                disabled={!enabled || !enabledCategories.has(category)}
                className="soundTestBtn"
                title="Test sound"
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SoundSettingsModal({ isOpen, onClose }: SoundSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sound-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sound Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <SoundSettingsContent />
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
