export const palette = {
  primary: '#1B4965',
  primaryLight: '#2A6287',
  primaryDark: '#13354A',
  accent: '#62B6CB',
  accentLight: '#89C9D9',
  accentDark: '#4A9AAD',
  white: '#FFFFFF',
  black: '#0A1218',
} as const;

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  accentMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderSubtle: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  error: string;
  errorMuted: string;
  info: string;
  focus: string;
  overlay: string;
  disabled: string;
  disabledText: string;
}

/** Calm, high-contrast light palette tuned for dyslexia-friendly reading. */
export const lightColors: ColorPalette = {
  background: '#F5F8FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EEF3F6',
  primary: palette.primary,
  primaryMuted: palette.primaryLight,
  accent: palette.accent,
  accentMuted: palette.accentLight,
  text: '#1A2830',
  textSecondary: '#3D5260',
  textMuted: '#6B8290',
  textInverse: palette.white,
  border: '#C8D8E0',
  borderSubtle: '#E2EBF0',
  success: '#2D6A4F',
  successMuted: '#D8EDE3',
  warning: '#92680A',
  warningMuted: '#F5EACC',
  error: '#A83232',
  errorMuted: '#F5DEDE',
  info: palette.primary,
  focus: palette.accent,
  overlay: 'rgba(27, 73, 101, 0.45)',
  disabled: '#D4DEE3',
  disabledText: '#8A9BA5',
};

/** Soft dark palette — avoids pure black and harsh contrast jumps. */
export const darkColors: ColorPalette = {
  background: '#0F1923',
  surface: '#162028',
  surfaceElevated: '#1E2A35',
  surfaceMuted: '#1A252E',
  primary: palette.accent,
  primaryMuted: palette.accentLight,
  accent: palette.accent,
  accentMuted: palette.accentDark,
  text: '#E8EEF2',
  textSecondary: '#B0C4CE',
  textMuted: '#7A929E',
  textInverse: palette.black,
  border: '#2A3A47',
  borderSubtle: '#1E2D38',
  success: '#52B788',
  successMuted: '#1A3D2E',
  warning: '#E9C46A',
  warningMuted: '#3D3520',
  error: '#E76F51',
  errorMuted: '#3D2420',
  info: palette.accent,
  focus: palette.accent,
  overlay: 'rgba(0, 0, 0, 0.65)',
  disabled: '#2A3A47',
  disabledText: '#5A7080',
};
