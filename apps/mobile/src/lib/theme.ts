import { Platform, useColorScheme, type TextStyle } from 'react-native';
import type { CredentialType } from './types';

// Design system: "security print". Quiet, cool neutrals and one deep ink
// navy carry the app; the boldness is reserved for the documents themselves,
// which are rendered like security-printed cards (guilloché, holo foil).
// Swap these tokens for the issuing government's design system once the app
// is commissioned. No screen hard-codes colours.

// Design system: "liquid glass" (Ron Design Lab style). Frosted translucent
// panels float over a deep, softly-lit canvas with ambient colour glows;
// accents are vibrant gradients. Surfaces get their material from the Glass
// component, so these tokens carry the canvas, text, rims and gradient stops.

const light = {
  // Soft tinted canvas so frosted white panels read as glass (not invisible).
  bg: '#E7ECF8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2FC',
  text: '#0C1020',
  textMuted: '#55607A',
  textFaint: '#8A93AC',
  border: 'rgba(255,255,255,0.65)',
  primary: '#3B63F6',
  primaryText: '#FFFFFF',
  primarySoft: 'rgba(59,99,246,0.12)',
  accent: '#3B63F6',
  /** Secondary accent (violet), for gradients and alt highlights. */
  lilac: '#8B5CF6',
  danger: '#C2321F',
  dangerBg: 'rgba(194,50,31,0.10)',
  warning: '#9C5A00',
  warningBg: 'rgba(156,90,0,0.12)',
  success: '#12795A',
  successBg: 'rgba(18,121,90,0.12)',
  gold: '#8A6100',
  goldBg: 'rgba(240,180,0,0.14)',
  watermark: 'rgba(255, 120, 108, 0.75)',
  shadow: '0px 8px 24px rgba(20,30,60,0.10)',
  shadowStrong: '0px 20px 48px rgba(20,30,60,0.18)',
  hairline: 'rgba(255,255,255,0.6)',
  tabBar: 'transparent',
  /** Frosted-panel wash + bright rim used by the Glass material. */
  glass: 'rgba(255,255,255,0.44)',
  glassRim: 'rgba(255,255,255,0.95)',
  /** Specular sheen painted across each glass panel. */
  glassSheen: 'rgba(255,255,255,0.45)',
  /** Ambient colour glows painted behind the glass. */
  glow1: 'rgba(91,141,239,0.55)',
  glow2: 'rgba(168,85,247,0.48)',
  glow3: 'rgba(45,212,191,0.40)',
  /** Base canvas gradient (top -> bottom) under the glows. */
  canvasTop: '#EDF1FC',
  canvasBottom: '#E3E9F6',
  /** Accent gradient stops. */
  gradFrom: '#3B7BF6',
  gradTo: '#8B5CF6',
};

// Dark mode is monochrome — black canvas, dark frosted glass, white/silver
// accents and a bright silver gradient for the hero/CTA. No colour hue except
// the functional status colours (danger / warning / success), which stay so
// state is still legible.
const dark: typeof light = {
  bg: '#08090C',
  surface: '#121318',
  surfaceAlt: '#16181F',
  text: '#F3F4F8',
  textMuted: '#A8ACB8',
  textFaint: '#70747F',
  border: 'rgba(255,255,255,0.12)',
  primary: '#ECEEF3',
  primaryText: '#0A0A0C',
  primarySoft: 'rgba(255,255,255,0.12)',
  accent: '#F2F3F7',
  lilac: '#C7CBD6',
  danger: '#FF8F80',
  dangerBg: 'rgba(255,143,128,0.14)',
  warning: '#F5B655',
  warningBg: 'rgba(245,182,85,0.14)',
  success: '#5AD1A2',
  successBg: 'rgba(90,209,162,0.14)',
  gold: '#F2C94C',
  goldBg: 'rgba(242,201,76,0.14)',
  watermark: 'rgba(255, 150, 140, 0.8)',
  shadow: '0px 10px 30px rgba(0,0,0,0.45)',
  shadowStrong: '0px 24px 60px rgba(0,0,0,0.6)',
  hairline: 'rgba(255,255,255,0.12)',
  tabBar: 'transparent',
  glass: 'rgba(38,40,48,0.44)',
  glassRim: 'rgba(255,255,255,0.28)',
  glassSheen: 'rgba(255,255,255,0.10)',
  glow1: 'rgba(255,255,255,0.18)',
  glow2: 'rgba(255,255,255,0.13)',
  glow3: 'rgba(255,255,255,0.10)',
  canvasTop: '#14161F',
  canvasBottom: '#05060A',
  gradFrom: '#EDEFF4',
  gradTo: '#C7CBD6',
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
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  extrabold: 'Geist_800ExtraBold',
  mono: 'GeistMono_500Medium',
  monoBold: 'GeistMono_600SemiBold',
};

// Type scale. Custom faces carry their own weight, so no fontWeight here
// (Android ignores fontWeight on custom families anyway).
export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.9 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  headline: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  /** Bold black section heading (Sanad "Favorite Cards", "Quick Access"). */
  section: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.4 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  strong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  amount: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  mono: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 20, letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
