/**
 * Sound Templates Service
 *
 * Built-in and custom sound templates for per-project sound configuration.
 * Also provides auto-instrument assignment for new team members.
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

// ── Auto-assignment pool ──
//
// When a team member is created without an explicit instrument,
// assign one from the pool to diversify the ensemble.
// The pool cycles through all 5 instruments to maximize musical variety.

const INSTRUMENT_POOL: InstrumentType[] = ['piano', 'guitar', 'violin', 'trumpet', 'drums'];

/**
 * Return a random instrument that isn't already over-represented
 * in the existing team members' instruments.
 *
 * Preference order: least-used instruments first.
 * If all are equally represented, pick randomly.
 */
export function assignRandomInstrument(existingInstruments: InstrumentType[] = []): InstrumentType {
  // Count how many team members already use each instrument
  const counts: Record<InstrumentType, number> = {
    piano: 0, guitar: 0, violin: 0, trumpet: 0, drums: 0,
  };
  for (const inst of existingInstruments) {
    counts[inst] = (counts[inst] || 0) + 1;
  }

  // Find the minimum count
  const minCount = Math.min(...Object.values(counts));

  // Collect instruments with the minimum count
  const leastUsed = INSTRUMENT_POOL.filter(inst => counts[inst] === minCount);

  // Pick randomly from the least-used instruments
  return leastUsed[Math.floor(Math.random() * leastUsed.length)];
}

/**
 * Get all 5 instruments in a suggested order for a team.
 * Returns instruments sorted so the ensemble sounds balanced:
 * bass (piano) first, then tenor/alto/soprano, rhythm last.
 */
export function getSuggestedEnsembleOrder(): InstrumentType[] {
  return ['piano', 'guitar', 'violin', 'trumpet', 'drums'];
}

/**
 * Get a human-readable description of an instrument's role in the ensemble.
 */
export function getInstrumentRole(instrument: InstrumentType): string {
  const roles: Record<InstrumentType, string> = {
    piano:   'Bass — plays root notes and full arpeggios',
    guitar:  'Tenor — plays inner chord harmonies',
    violin:  'Alto — plays upper melodic voices',
    trumpet: 'Soprano — plays top notes and melody',
    drums:   'Rhythm — provides percussive accents',
  };
  return roles[instrument];
}

/**
 * Get an emoji icon for an instrument.
 */
export function getInstrumentEmoji(instrument: InstrumentType): string {
  const emojis: Record<InstrumentType, string> = {
    piano:   '🎹',
    guitar:  '🎸',
    violin:  '🎻',
    trumpet: '🎺',
    drums:   '🥁',
  };
  return emojis[instrument];
}

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
