/**
 * ProjectSoundSettings Component
 *
 * Embedded in the project create/edit dialog.
 * Provides template picker, instrument selector, per-category overrides,
 * save-as-template, and reset-to-global.
 */

import React, { useState, useCallback } from 'react';
import type { InstrumentType, ProjectSoundConfig, SoundCategoryType } from '../../app/types/maestro';
import { soundManager } from '../../services/soundManager';
import type { SoundCategory } from '../../services/soundManager';
import {
  getTemplates,
  getTemplateById,
  saveTemplate,
  deleteTemplate,
  templateToProjectConfig,
} from '../../services/soundTemplates';

const INSTRUMENTS: { value: InstrumentType; label: string }[] = [
  { value: 'piano', label: 'Piano' },
  { value: 'guitar', label: 'Guitar' },
  { value: 'violin', label: 'Violin' },
  { value: 'trumpet', label: 'Trumpet' },
  { value: 'drums', label: 'Drums' },
];

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

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as SoundCategoryType[];

const CATEGORY_GROUPS: { name: string; categories: SoundCategoryType[] }[] = [
  { name: 'High Priority', categories: ['success', 'error', 'critical_error', 'warning', 'attention', 'achievement'] },
  { name: 'Activity', categories: ['action', 'progress', 'loading'] },
  { name: 'Changes', categories: ['creation', 'deletion', 'update'] },
  { name: 'Relationships', categories: ['link', 'unlink'] },
  { name: 'Notifications', categories: [
    'notify_task_completed', 'notify_task_failed', 'notify_task_blocked',
    'notify_task_session_completed', 'notify_task_session_failed',
    'notify_session_completed', 'notify_session_failed',
    'notify_needs_input', 'notify_progress',
  ]},
];

interface ProjectSoundSettingsProps {
  config: ProjectSoundConfig | undefined;
  onChange: (config: ProjectSoundConfig | undefined) => void;
}

export function ProjectSoundSettings({ config, onChange }: ProjectSoundSettingsProps) {
  const [showOverrides, setShowOverrides] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const templates = getTemplates();

  const currentInstrument: InstrumentType = config?.instrument ?? 'piano';
  const enabledCategories = new Set<SoundCategoryType>(
    config?.enabledCategories ?? ALL_CATEGORIES
  );
  const categoryOverrides = config?.categoryOverrides ?? {};

  const updateConfig = useCallback((updates: Partial<ProjectSoundConfig>) => {
    const base: ProjectSoundConfig = config ?? { instrument: 'piano' };
    onChange({ ...base, ...updates });
  }, [config, onChange]);

  const handleTemplateChange = (templateId: string) => {
    if (templateId === '') {
      onChange(undefined);
      return;
    }
    const template = getTemplateById(templateId);
    if (template) {
      onChange(templateToProjectConfig(template));
    }
  };

  const handleInstrumentChange = (instrument: InstrumentType) => {
    updateConfig({ instrument, templateId: undefined });
  };

  const handleCategoryToggle = (category: SoundCategoryType) => {
    const newEnabled = new Set(enabledCategories);
    if (newEnabled.has(category)) {
      newEnabled.delete(category);
    } else {
      newEnabled.add(category);
    }
    updateConfig({ enabledCategories: Array.from(newEnabled) });
  };

  const handleCategoryInstrumentOverride = (category: SoundCategoryType, instrument: InstrumentType | '') => {
    const newOverrides = { ...categoryOverrides };
    if (instrument === '' || instrument === currentInstrument) {
      // Remove the override
      if (newOverrides[category]) {
        const { instrument: _, ...rest } = newOverrides[category];
        if (Object.keys(rest).length === 0) {
          delete newOverrides[category];
        } else {
          newOverrides[category] = rest;
        }
      }
    } else {
      newOverrides[category] = {
        ...newOverrides[category],
        instrument,
      };
    }
    updateConfig({
      categoryOverrides: Object.keys(newOverrides).length > 0 ? newOverrides : undefined,
    });
  };

  const handleTestSound = (category: SoundCategoryType) => {
    const instrument = categoryOverrides[category]?.instrument || currentInstrument;
    soundManager.playCategorySound(category, instrument);
  };

  const handleSaveTemplate = () => {
    if (!saveTemplateName.trim() || !config) return;
    saveTemplate({
      name: saveTemplateName.trim(),
      instrument: config.instrument,
      enabledCategories: config.enabledCategories ?? [...ALL_CATEGORIES],
      categoryOverrides: config.categoryOverrides,
    });
    setSaveTemplateName('');
    setShowSaveTemplate(false);
  };

  const handleDeleteCustomTemplate = (templateId: string) => {
    deleteTemplate(templateId);
    if (config?.templateId === templateId) {
      updateConfig({ templateId: undefined });
    }
  };

  const handleResetToGlobal = () => {
    onChange(undefined);
  };

  return (
    <div className="projectSoundSettings">
      {/* Template Picker */}
      <div className="projectSoundRow">
        <label className="projectSoundLabel">Template</label>
        <select
          className="themedFormSelect"
          value={config?.templateId ?? ''}
          onChange={(e) => handleTemplateChange(e.target.value)}
        >
          <option value="">Use Global Defaults</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.builtIn ? '' : ' (custom)'}
            </option>
          ))}
        </select>
      </div>

      {/* Instrument Selector */}
      <div className="projectSoundRow">
        <label className="projectSoundLabel">Instrument</label>
        <div className="projectSoundInstruments">
          {INSTRUMENTS.map((inst) => (
            <label key={inst.value} className="projectSoundInstrumentOption">
              <input
                type="radio"
                name="projectInstrument"
                value={inst.value}
                checked={currentInstrument === inst.value}
                onChange={() => handleInstrumentChange(inst.value)}
              />
              <span>{inst.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Per-Category Overrides */}
      <div className="projectSoundRow">
        <button
          type="button"
          className="themedBrowseToggle"
          onClick={() => setShowOverrides((v) => !v)}
        >
          <span className={`themedBrowseToggleArrow${showOverrides ? " themedBrowseToggleArrow--open" : ""}`}>
            &#9654;
          </span>
          Per-Category Overrides
        </button>
      </div>

      {showOverrides && (
        <div className="projectSoundOverrides">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.name} className="projectSoundGroup">
              <div className="projectSoundGroupTitle">{group.name}</div>
              {group.categories.map((category) => (
                <div key={category} className="projectSoundCategoryRow">
                  <label className="projectSoundCategoryToggle">
                    <input
                      type="checkbox"
                      checked={enabledCategories.has(category)}
                      onChange={() => handleCategoryToggle(category)}
                    />
                    <span>{CATEGORY_LABELS[category]}</span>
                  </label>
                  <select
                    className="projectSoundCategoryInstrument"
                    value={categoryOverrides[category]?.instrument ?? ''}
                    onChange={(e) => handleCategoryInstrumentOverride(category, e.target.value as InstrumentType | '')}
                    title="Override instrument for this category"
                  >
                    <option value="">Default ({currentInstrument})</option>
                    {INSTRUMENTS.filter((i) => i.value !== currentInstrument).map((inst) => (
                      <option key={inst.value} value={inst.value}>{inst.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="soundTestBtn"
                    onClick={() => handleTestSound(category)}
                    title="Preview sound"
                    disabled={!enabledCategories.has(category)}
                  >
                    &#9654;
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="projectSoundActions">
        {config && (
          <>
            <button
              type="button"
              className="themedBtn"
              onClick={() => setShowSaveTemplate((v) => !v)}
            >
              Save as Template
            </button>
            <button
              type="button"
              className="themedBtn"
              onClick={handleResetToGlobal}
            >
              Reset to Global
            </button>
          </>
        )}
      </div>

      {/* Save Template Dialog */}
      {showSaveTemplate && (
        <div className="projectSoundSaveTemplate">
          <input
            className="themedFormInput"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            placeholder="Template name..."
          />
          <button
            type="button"
            className="themedBtn themedBtnPrimary"
            onClick={handleSaveTemplate}
            disabled={!saveTemplateName.trim()}
          >
            Save
          </button>
          <button
            type="button"
            className="themedBtn"
            onClick={() => setShowSaveTemplate(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Custom Template Management */}
      {templates.filter((t) => !t.builtIn).length > 0 && (
        <div className="projectSoundCustomTemplates">
          <div className="projectSoundLabel">Custom Templates</div>
          {templates.filter((t) => !t.builtIn).map((t) => (
            <div key={t.id} className="projectSoundCustomTemplateRow">
              <span>{t.name} ({t.instrument})</span>
              <button
                type="button"
                className="themedBtn projectSoundDeleteBtn"
                onClick={() => handleDeleteCustomTemplate(t.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
