import { Platform, useColorScheme, type TextStyle } from 'react-native';
import type { CredentialType } from './types';

// Design system: "security print". Quiet, cool neutrals and one deep ink
// navy carry the app; the boldness is reserved for the documents themselves,
// which are rendered like security-printed cards (guilloché, holo foil).
// Swap these tokens for the issuing government's design system once the app
// is commissioned. No screen hard-codes colours.

const light = {
  bg: '#F2F3F6',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF1F5',
  text: '#0D1522',
  textMuted: '#5F6B7D',
  textFaint: '#8C96A6',
  border: '#E2E6EC',
  primary: '#16325C',
  primaryText: '#FFFFFF',
  primarySoft: '#E7EDF6',
  accent: '#2F66D0',
  danger: '#C2321F',
  dangerBg: '#FCEDEA',
  warning: '#9C5A00',
  warningBg: '#FFF3DC',
  success: '#12795A',
  successBg: '#E1F3EB',
  watermark: 'rgba(255, 120, 108, 0.75)',
  /** Card shadow; dark mode relies on a hairline border instead. */
  shadow: '0px 8px 24px rgba(13, 21, 34, 0.07), 0px 1px 2px rgba(13, 21, 34, 0.05)',
  shadowStrong: '0px 18px 40px rgba(13, 21, 34, 0.16)',
  hairline: 'transparent',
  tabBar: '#FFFFFF',
};

const dark: typeof light = {
  bg: '#07090E',
  surface: '#11161F',
  surfaceAlt: '#19212C',
  text: '#EDF1F7',
  textMuted: '#9AA6B6',
  textFaint: '#6B7686',
  border: '#232C38',
  primary: '#9BBCFF',
  primaryText: '#07090E',
  primarySoft: '#17243A',
  accent: '#9BBCFF',
  danger: '#FF8F80',
  dangerBg: '#36160F',
  warning: '#F5B655',
  warningBg: '#33240C',
  success: '#5AD1A2',
  successBg: '#0E2C22',
  watermark: 'rgba(255, 150, 140, 0.8)',
  shadow: 'none',
  shadowStrong: '0px 18px 40px rgba(0, 0, 0, 0.55)',
  hairline: '#1E2631',
  tabBar: '#0C1118',
};

export type Theme = typeof light;

/** Gradient stops for each kind of document, the same in both themes. */
export const DOCUMENT_PALETTE: Record<CredentialType, { from: string; to: string; ink: string }> = {
  driver_licence: { from: '#0E2442', to: '#245A97', ink: '#9CC2F2' },
  health_card: { from: '#241A40', to: '#5C3F8F', ink: '#C9B4F2' },
  vehicle_permit: { from: '#0A3236', to: '#1C7470', ink: '#93DCD2' },
  photo_card: { from: '#23272F', to: '#5A6472', ink: '#C3CCD8' },
};

/** On the web, a host page can force a theme with <html data-theme="dark|light">. */
function hostTheme(): 'light' | 'dark' | undefined {
  if (Platform.OS !== 'web') return undefined;
  try {
    const t = globalThis.document?.documentElement.getAttribute('data-theme');
    return t === 'dark' || t === 'light' ? t : undefined;
  } catch {
    return undefined;
  }
}

export function useTheme(): Theme {
  const system = useColorScheme();
  return (hostTheme() ?? system) === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  const system = useColorScheme();
  return (hostTheme() ?? system) === 'dark';
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };

/** Loaded in the root layout via expo-font. */
export const fonts = {
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
  extrabold: 'HankenGrotesk_800ExtraBold',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_600SemiBold',
};

// Type scale. Custom faces carry their own weight, so no fontWeight here
// (Android ignores fontWeight on custom families anyway).
export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.9 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  headline: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  strong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  amount: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  mono: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 20, letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
