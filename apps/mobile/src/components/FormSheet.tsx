import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { IS_PROTOTYPE } from '../lib/config';
import { fonts } from '../lib/theme';

// Building blocks for paper government forms (vehicle permit, offence notice):
// an off-white sheet, bilingual boxed fields in a grid, perforations.
// Paper stays light in both themes, like the printed original.

export const PAPER = {
  sheet: '#FBFAF6',
  ink: '#14202E',
  muted: '#5C6676',
  rule: '#C9CED6',
  band: '#16325C',
  bandInk: '#FFFFFF',
};

export function Sheet({ children, title, subtitle, accent = PAPER.band }: { children: ReactNode; title: [string, string]; subtitle?: string; accent?: string }) {
  return (
    <View style={styles.sheet}>
      <View style={[styles.band, { backgroundColor: accent }]}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 40" preserveAspectRatio="none">
          {Array.from({ length: 7 }, (_, k) => (
            <Path
              key={k}
              d={`M0 ${6 + k * 5} ${Array.from({ length: 31 }, (_, i) => `L${i * 10} ${(6 + k * 5 + 2.2 * Math.sin(i / 1.6 + k)).toFixed(1)}`).join(' ')}`}
              stroke="#FFFFFF"
              strokeOpacity={0.12}
              strokeWidth={0.6}
              fill="none"
            />
          ))}
        </Svg>
        <Text style={styles.title}>{title[0]}</Text>
        <Text style={styles.titleFr}>{title[1]}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
      {IS_PROTOTYPE && (
        <View pointerEvents="none" style={styles.watermarkWrap}>
          <Text style={styles.watermark}>SPECIMEN · PROTOTYPE</Text>
        </View>
      )}
    </View>
  );
}

/** A section heading inside a form, e.g. "PLATE PORTION / PARTIE PLAQUE". */
export function Part({ en, fr }: { en: string; fr: string }) {
  return (
    <Text style={styles.part}>
      {en} <Text style={{ color: PAPER.muted }}>/ {fr}</Text>
    </Text>
  );
}

/** One row of boxed fields. Flex weights let a long field take more room. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Box({ en, fr, value, flex = 1, mono, strong }: { en: string; fr: string; value: ReactNode; flex?: number; mono?: boolean; strong?: boolean }) {
  return (
    <View style={[styles.box, { flex }]}>
      <Text style={styles.boxLabel} numberOfLines={1}>
        {en} / {fr}
      </Text>
      <Text style={[mono ? styles.boxMono : styles.boxValue, strong && { fontFamily: fonts.bold, fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

/** Tear-off line between two portions of a form. */
export function Perforation() {
  return (
    <View style={styles.perf} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name="cut-outline" size={14} color={PAPER.muted} />
      <View style={styles.perfLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: PAPER.sheet, borderRadius: 6, overflow: 'hidden', boxShadow: '0px 12px 30px rgba(10, 18, 30, 0.14), 0px 1px 2px rgba(10, 18, 30, 0.1)' },
  band: { paddingHorizontal: 16, paddingVertical: 12, overflow: 'hidden' },
  title: { color: PAPER.bandInk, fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: 1.4 },
  titleFr: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 1.2, marginTop: 1 },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.medium, fontSize: 10, marginTop: 6 },
  body: { padding: 14, gap: 8 },
  part: { color: PAPER.ink, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, marginTop: 4 },
  row: { flexDirection: 'row' },
  box: { borderWidth: StyleSheet.hairlineWidth, borderColor: PAPER.rule, marginRight: -StyleSheet.hairlineWidth, marginBottom: -StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 6, gap: 2, minWidth: 0 },
  boxLabel: { color: PAPER.muted, fontFamily: fonts.semibold, fontSize: 7.5, letterSpacing: 0.6 },
  boxValue: { color: PAPER.ink, fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16 },
  boxMono: { color: PAPER.ink, fontFamily: fonts.mono, fontSize: 12.5, letterSpacing: 0.5 },
  perf: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 6 },
  perfLine: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: PAPER.rule },
  watermarkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  watermark: { color: 'rgba(194, 50, 31, 0.22)', fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: 5, transform: [{ rotate: '-24deg' }] },
});
