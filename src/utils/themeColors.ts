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

  // Remove existing theme style if present
  const existingStyle = document.getElementById('dynamic-theme');
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create new style element with overrides for all primary-* classes
  const style = document.createElement('style');
  style.id = 'dynamic-theme';
  style.textContent = `
    /* Override Tailwind primary colors */
    .bg-primary-50 { background-color: ${preset.lightHex} !important; }
    .bg-primary-100 { background-color: ${preset.lightHex} !important; }
    .bg-primary-500 { background-color: ${preset.primaryHex} !important; }
    .bg-primary-600 { background-color: ${preset.primaryHex} !important; }
    .bg-primary-700 { background-color: ${preset.darkHex} !important; }

    .text-primary-50 { color: ${preset.lightHex} !important; }
    .text-primary-100 { color: ${preset.lightHex} !important; }
    .text-primary-500 { color: ${preset.primaryHex} !important; }
    .text-primary-600 { color: ${preset.primaryHex} !important; }
    .text-primary-700 { color: ${preset.darkHex} !important; }
    .text-primary-800 { color: ${preset.darkHex} !important; }
    .text-primary-900 { color: ${preset.darkHex} !important; }

    .border-primary-200 { border-color: ${preset.lightHex} !important; }
    .border-primary-500 { border-color: ${preset.primaryHex} !important; }
    .border-primary-600 { border-color: ${preset.primaryHex} !important; }

    .ring-primary-500 { --tw-ring-color: ${preset.primaryHex} !important; }

    .from-primary-50 { --tw-gradient-from: ${preset.lightHex} !important; }
    .from-primary-500 { --tw-gradient-from: ${preset.primaryHex} !important; }
    .from-primary-600 { --tw-gradient-from: ${preset.primaryHex} !important; }
    .to-primary-100 { --tw-gradient-to: ${preset.lightHex} !important; }
    .to-primary-500 { --tw-gradient-to: ${preset.primaryHex} !important; }
    .to-primary-700 { --tw-gradient-to: ${preset.darkHex} !important; }
    .via-primary-500 { --tw-gradient-via: ${preset.primaryHex} !important; }

    .hover\\:bg-primary-700:hover { background-color: ${preset.darkHex} !important; }
    .hover\\:bg-primary-50:hover { background-color: ${preset.lightHex} !important; }
    .hover\\:text-gray-700:hover { color: #374151 !important; }
    .hover\\:border-gray-300:hover { border-color: #d1d5db !important; }

    .focus\\:ring-primary-500:focus { --tw-ring-color: ${preset.primaryHex} !important; }
    .focus\\:border-primary-500:focus { border-color: ${preset.primaryHex} !important; }
  `;

  document.head.appendChild(style);
};
