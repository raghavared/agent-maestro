export type ThemeId = 'green' | 'blue' | 'purple' | 'amber' | 'cyan' | 'rose';

export interface ThemeColors {
  primary: string;
  primaryDim: string;
  primaryRgb: string;
  border: string;
  text: string;
  textDim: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  colors: ThemeColors;
}

export const THEMES: Record<ThemeId, Theme> = {
  green: {
    id: 'green',
    name: 'Matrix Green',
    colors: {
      primary: '#00ff41',
      primaryDim: '#00cc33',
      primaryRgb: '0, 255, 65',
      border: '#003300',
      text: '#00ff41',
      textDim: '#00aa2b',
    },
  },
  blue: {
    id: 'blue',
    name: 'Cyber Blue',
    colors: {
      primary: '#00d9ff',
      primaryDim: '#00a8cc',
      primaryRgb: '0, 217, 255',
      border: '#002233',
      text: '#00d9ff',
      textDim: '#0099bb',
    },
  },
  purple: {
    id: 'purple',
    name: 'Neon Purple',
    colors: {
      primary: '#a855f7',
      primaryDim: '#8b44cc',
      primaryRgb: '168, 85, 247',
      border: '#1a0033',
      text: '#a855f7',
      textDim: '#7c3aed',
    },
  },
  amber: {
    id: 'amber',
    name: 'Retro Amber',
    colors: {
      primary: '#ffb000',
      primaryDim: '#cc8c00',
      primaryRgb: '255, 176, 0',
      border: '#332200',
      text: '#ffb000',
      textDim: '#cc8c00',
    },
  },
  cyan: {
    id: 'cyan',
    name: 'Tron Cyan',
    colors: {
      primary: '#22d3ee',
      primaryDim: '#1aa8bc',
      primaryRgb: '34, 211, 238',
      border: '#002233',
      text: '#22d3ee',
      textDim: '#0ea5c7',
    },
  },
  rose: {
    id: 'rose',
    name: 'Hot Pink',
    colors: {
      primary: '#f472b6',
      primaryDim: '#c25a92',
      primaryRgb: '244, 114, 182',
      border: '#330022',
      text: '#f472b6',
      textDim: '#db2777',
    },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME_ID: ThemeId = 'green';
