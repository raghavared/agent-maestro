/**
 * Sound Templates Service
 *
 * Built-in and custom sound templates for per-project sound configuration.
 */

import type { InstrumentType, SoundTemplate, SoundCategoryType } from '../app/types/maestro';

const ALL_CATEGORIES: SoundCategoryType[] = [
  'success', 'error', 'critical_error', 'warning', 'attention',
  'action', 'creation', 'deletion', 'update', 'progress',
  'achievement', 'neutral', 'link', 'unlink', 'loading',
  'notify_task_completed', 'notify_task_failed', 'notify_task_blocked',
  'notify_task_session_completed', 'notify_task_session_failed',
  'notify_session_completed', 'notify_session_failed',
  'notify_needs_input', 'notify_progress',
];

export const BUILT_IN_TEMPLATES: SoundTemplate[] = [
  {
    id: 'builtin-piano',
    name: 'Classic Piano',
    builtIn: true,
    instrument: 'piano',
    enabledCategories: [...ALL_CATEGORIES],
  },
  {
    id: 'builtin-guitar',
    name: 'Acoustic Guitar',
    builtIn: true,
    instrument: 'guitar',
    enabledCategories: [...ALL_CATEGORIES],
  },
  {
    id: 'builtin-violin',
    name: 'Orchestral Violin',
    builtIn: true,
    instrument: 'violin',
    enabledCategories: [...ALL_CATEGORIES],
  },
  {
    id: 'builtin-trumpet',
    name: 'Jazz Trumpet',
    builtIn: true,
    instrument: 'trumpet',
    enabledCategories: [...ALL_CATEGORIES],
  },
  {
    id: 'builtin-drums',
    name: 'Percussion Kit',
    builtIn: true,
    instrument: 'drums',
    enabledCategories: [...ALL_CATEGORIES],
  },
];

const STORAGE_KEY = 'maestro-sound-templates';

function loadCustomTemplates(): SoundTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as SoundTemplate[];
    }
  } catch {
  }
  return [];
}

function saveCustomTemplates(templates: SoundTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
  }
}

export function getTemplates(): SoundTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...loadCustomTemplates()];
}

export function getBuiltInTemplates(): SoundTemplate[] {
  return [...BUILT_IN_TEMPLATES];
}

export function getCustomTemplates(): SoundTemplate[] {
  return loadCustomTemplates();
}

export function getTemplateById(id: string): SoundTemplate | undefined {
  return getTemplates().find(t => t.id === id);
}

export function saveTemplate(template: Omit<SoundTemplate, 'id' | 'builtIn'>): SoundTemplate {
  const custom = loadCustomTemplates();
  const newTemplate: SoundTemplate = {
    ...template,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    builtIn: false,
  };
  custom.push(newTemplate);
  saveCustomTemplates(custom);
  return newTemplate;
}

export function updateTemplate(id: string, updates: Partial<Omit<SoundTemplate, 'id' | 'builtIn'>>): void {
  const custom = loadCustomTemplates();
  const index = custom.findIndex(t => t.id === id);
  if (index >= 0) {
    custom[index] = { ...custom[index], ...updates };
    saveCustomTemplates(custom);
  }
}

export function deleteTemplate(id: string): void {
  const custom = loadCustomTemplates();
  saveCustomTemplates(custom.filter(t => t.id !== id));
}

export function templateToProjectConfig(template: SoundTemplate): {
  instrument: InstrumentType;
  enabledCategories: SoundCategoryType[];
  categoryOverrides?: Record<string, { instrument?: InstrumentType; enabled?: boolean }>;
  templateId: string;
} {
  return {
    instrument: template.instrument,
    enabledCategories: [...template.enabledCategories],
    categoryOverrides: template.categoryOverrides ? { ...template.categoryOverrides } : undefined,
    templateId: template.id,
  };
}
