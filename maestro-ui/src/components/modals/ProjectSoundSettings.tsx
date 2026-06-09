/**
 * ProjectSoundSettings Component
 *
 * Simplified project sound settings — template picker and instrument selector.
 * Per-category overrides are available as an advanced option but hidden by default
 * to keep the main UX simple and musical.
 */

import React, { useState, useCallback } from 'react';
import type { InstrumentType, ProjectSoundConfig, SoundCategoryType } from '../../app/types/maestro';
import { soundManager } from '../../services/soundManager';
import type { SoundCategory } from '../../services/soundManager';
import { Icon } from '../maestro/redesign/kit';
import {
  getTemplates,
  getTemplateById,
  saveTemplate,
  deleteTemplate,
  templateToProjectConfig,
  getInstrumentEmoji,
  getInstrumentRole,
} from '../../services/soundTemplates';

const INSTRUMENTS: InstrumentType[] = ['piano', 'guitar', 'violin', 'trumpet', 'drums'];

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
  notify_task_completed: 'Task Completed',
  notify_task_failed: 'Task Failed',
  notify_task_blocked: 'Task Blocked',
  notify_task_session_completed: 'Session Task Completed',
  notify_task_session_failed: 'Session Task Failed',
  notify_session_completed: 'Session Completed',
  notify_session_failed: 'Session Failed',
  notify_needs_input: 'Needs Input',
  notify_progress: 'Progress Update',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as SoundCategoryType[];

const CATEGORY_GROUPS: { name: string; categories: SoundCategoryType[] }[] = [
  { name: 'High Priority', categories: ['success', 'error', 'critical_error', 'warning', 'attention', 'achievement'] },
  { name: 'Activity', categories: ['action', 'progress', 'loading'] },
  { name: 'Changes', categories: ['creation', 'deletion', 'update'] },
  { name: 'Relationships', categories: ['link', 'unlink'] },
  { name: 'Neutral', categories: ['neutral'] },
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
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    // Preview the new instrument sound
    soundManager.playCategorySound('success', instrument);
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
    <div className="pn-fld">
      {/* Template Picker */}
      <div className="pn-fld">
        <label className="pn-flabel">Template</label>
        <select
          className="pn-select"
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

      {/* Instrument Selector — visual button picker */}
      <div className="pn-fld">
        <label className="pn-flabel">Instrument</label>
        <div className="pn-instr">
          {INSTRUMENTS.map((inst) => (
            <button
              key={inst}
              type="button"
              title={getInstrumentRole(inst)}
              onClick={() => handleInstrumentChange(inst)}
              className={`pn-instr-i${currentInstrument === inst ? ' pn-instr-i--active' : ''}`}
            >
              <span style={{ fontSize: '16px' }}>{getInstrumentEmoji(inst)}</span>
              <span className="pn-instr-i__name">{inst}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="pn-frow">
        {config && (
          <>
            <button
              type="button"
              className="pn-btn"
              onClick={() => setShowSaveTemplate((v) => !v)}
            >
              Save as Template
            </button>
            <button
              type="button"
              className="pn-btn"
              onClick={handleResetToGlobal}
            >
              Reset to Global
            </button>
          </>
        )}
      </div>

      {/* Save Template Dialog */}
      {showSaveTemplate && (
        <div className="pn-frow">
          <input
            className="pn-input"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            placeholder="Template name..."
          />
          <button
            type="button"
            className="pn-btn pn-btn--primary"
            onClick={handleSaveTemplate}
            disabled={!saveTemplateName.trim()}
          >
            Save
          </button>
          <button
            type="button"
            className="pn-btn"
            onClick={() => setShowSaveTemplate(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Advanced: Per-Category Overrides (collapsed by default) */}
      <div className="pn-fld">
        <button
          type="button"
          className="pn-btn pn-btn--ghost"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <Icon name={showAdvanced ? 'chevronD' : 'chevronR'} size={12} />
          Advanced: Per-Category Overrides
        </button>
      </div>

      {showAdvanced && (
        <div className="pn-fld">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.name} className="pn-fld">
              <div className="pn-flabel">{group.name}</div>
              <div className="pn-caps">
                {group.categories.map((category) => (
                  <div key={category} className="pn-cap">
                    <input
                      type="checkbox"
                      id={`pso-cat-${category}`}
                      className="sr-only"
                      checked={enabledCategories.has(category)}
                      onChange={() => handleCategoryToggle(category)}
                    />
                    <label
                      htmlFor={`pso-cat-${category}`}
                      className={`pn-switch${enabledCategories.has(category) ? ' pn-switch--on' : ''}`}
                      aria-label={CATEGORY_LABELS[category]}
                    />
                    <span className="pn-cap__name pn-cap__body">{CATEGORY_LABELS[category]}</span>
                    <select
                      className="pn-select"
                      value={categoryOverrides[category]?.instrument ?? ''}
                      onChange={(e) => handleCategoryInstrumentOverride(category, e.target.value as InstrumentType | '')}
                      title="Override instrument for this category"
                    >
                      <option value="">Default ({currentInstrument})</option>
                      {INSTRUMENTS.filter((i) => i !== currentInstrument).map((inst) => (
                        <option key={inst} value={inst}>{getInstrumentEmoji(inst)} {inst}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="pn-btn pn-btn--ghost"
                      onClick={() => handleTestSound(category)}
                      title="Preview sound"
                      disabled={!enabledCategories.has(category)}
                    >
                      <Icon name="play" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Template Management */}
      {templates.filter((t) => !t.builtIn).length > 0 && (
        <div className="pn-fld">
          <div className="pn-flabel">Custom Templates</div>
          <div className="pn-caps">
            {templates.filter((t) => !t.builtIn).map((t) => (
              <div key={t.id} className="pn-cap">
                <span className="pn-cap__name pn-cap__body">{getInstrumentEmoji(t.instrument)} {t.name}</span>
                <button
                  type="button"
                  className="pn-btn pn-btn--danger"
                  onClick={() => handleDeleteCustomTemplate(t.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
