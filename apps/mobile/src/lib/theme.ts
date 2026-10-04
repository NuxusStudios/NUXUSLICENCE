import { useColorScheme } from 'react-native';

// Neutral civic palette. Swap these tokens for the issuing government's design
// system once the app is commissioned — no screen hard-codes colours.
const light = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F7',
  text: '#13202E',
  textMuted: '#5B6878',
  border: '#D9E0E8',
  primary: '#0B4F8A',
  primaryText: '#FFFFFF',
  accent: '#1B7F5E',
  danger: '#B42318',
  dangerBg: '#FDECEA',
  warning: '#9A5B00',
  warningBg: '#FFF4DE',
  success: '#1B7F5E',
  successBg: '#E3F4EC',
  card: '#0B4F8A',
  cardAlt: '#1C6BB0',
  watermark: 'rgba(180, 35, 24, 0.85)',
};

const dark: typeof light = {
  bg: '#0C131B',
  surface: '#16202B',
  surfaceAlt: '#1D2A37',
  text: '#E8EEF4',
  textMuted: '#9AA8B7',
  border: '#2A3846',
  primary: '#5AA6E8',
  primaryText: '#0C131B',
  accent: '#4CC79A',
  danger: '#FF8A80',
  dangerBg: '#3A1A18',
  warning: '#F5B655',
  warningBg: '#3A2A10',
  success: '#4CC79A',
  successBg: '#11302A',
  card: '#14467A',
  cardAlt: '#1D5E9C',
  watermark: 'rgba(255, 138, 128, 0.9)',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18 };
