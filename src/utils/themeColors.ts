export interface ThemeColorPreset {
  id: string;
  name: string;
  primary: string; // Tailwind color
  primaryHex: string; // Hex for CSS vars
  darkHex: string;
  lightHex: string;
}

export const THEME_COLOR_PRESETS: ThemeColorPreset[] = [
  {
    id: 'blue',
    name: 'Blauw',
    primary: 'blue',
    primaryHex: '#3B82F6',
    darkHex: '#1E40AF',
    lightHex: '#DBEAFE',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    primary: 'indigo',
    primaryHex: '#6366F1',
    darkHex: '#4338CA',
    lightHex: '#E0E7FF',
  },
  {
    id: 'purple',
    name: 'Paars',
    primary: 'purple',
    primaryHex: '#A855F7',
    darkHex: '#7E22CE',
    lightHex: '#F3E8FF',
  },
  {
    id: 'pink',
    name: 'Roze',
    primary: 'pink',
    primaryHex: '#EC4899',
    darkHex: '#BE185D',
    lightHex: '#FCE7F3',
  },
  {
    id: 'rose',
    name: 'Roos',
    primary: 'rose',
    primaryHex: '#F43F5E',
    darkHex: '#BE123C',
    lightHex: '#FFE4E6',
  },
  {
    id: 'red',
    name: 'Rood',
    primary: 'red',
    primaryHex: '#EF4444',
    darkHex: '#B91C1C',
    lightHex: '#FEE2E2',
  },
  {
    id: 'orange',
    name: 'Oranje',
    primary: 'orange',
    primaryHex: '#F97316',
    darkHex: '#C2410C',
    lightHex: '#FFEDD5',
  },
  {
    id: 'amber',
    name: 'Amber',
    primary: 'amber',
    primaryHex: '#F59E0B',
    darkHex: '#B45309',
    lightHex: '#FEF3C7',
  },
  {
    id: 'yellow',
    name: 'Geel',
    primary: 'yellow',
    primaryHex: '#EAB308',
    darkHex: '#A16207',
    lightHex: '#FEF9C3',
  },
  {
    id: 'lime',
    name: 'Limoen',
    primary: 'lime',
    primaryHex: '#84CC16',
    darkHex: '#4D7C0F',
    lightHex: '#ECFCCB',
  },
  {
    id: 'green',
    name: 'Groen',
    primary: 'green',
    primaryHex: '#22C55E',
    darkHex: '#15803D',
    lightHex: '#DCFCE7',
  },
  {
    id: 'emerald',
    name: 'Smaragd',
    primary: 'emerald',
    primaryHex: '#10B981',
    darkHex: '#047857',
    lightHex: '#D1FAE5',
  },
  {
    id: 'teal',
    name: 'Teal',
    primary: 'teal',
    primaryHex: '#14B8A6',
    darkHex: '#0F766E',
    lightHex: '#CCFBF1',
  },
  {
    id: 'cyan',
    name: 'Cyaan',
    primary: 'cyan',
    primaryHex: '#06B6D4',
    darkHex: '#0E7490',
    lightHex: '#CFFAFE',
  },
  {
    id: 'sky',
    name: 'Hemelsblauw',
    primary: 'sky',
    primaryHex: '#0EA5E9',
    darkHex: '#0369A1',
    lightHex: '#E0F2FE',
  },
];

export const getThemeColorPreset = (colorId?: string): ThemeColorPreset => {
  if (!colorId) return THEME_COLOR_PRESETS[0]; // Default to blue
  return THEME_COLOR_PRESETS.find(c => c.id === colorId) || THEME_COLOR_PRESETS[0];
};

export const applyThemeColor = (colorId?: string) => {
  const preset = getThemeColorPreset(colorId);
  const root = document.documentElement;

  // Apply CSS variables
  root.style.setProperty('--color-primary', preset.primaryHex);
  root.style.setProperty('--color-primary-dark', preset.darkHex);
  root.style.setProperty('--color-primary-light', preset.lightHex);
};
