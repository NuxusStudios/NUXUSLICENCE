import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { IS_PROTOTYPE } from '../lib/config';
import { cardDate, date } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { DOCUMENT_PALETTE, fonts, radius } from '../lib/theme';
import type { Credential } from '../lib/types';
import type { IconName } from './ui';

export const CREDENTIAL_ICON: Record<Credential['type'], IconName> = {
  driver_licence: 'car-sport',
  photo_card: 'person',
  health_card: 'medkit',
  vehicle_permit: 'document-text',
};

/** Canadian documents carry both official languages, whatever the app language is. */
const BILINGUAL_TITLE: Record<Credential['type'], [string, string]> = {
  driver_licence: ["DRIVER'S LICENCE", 'PERMIS DE CONDUIRE'],
  health_card: ['HEALTH CARD', 'CARTE SANTÉ'],
  photo_card: ['PHOTO CARD', 'CARTE-PHOTO'],
  vehicle_permit: ['VEHICLE PERMIT', "CERTIFICAT D'IMMATRICULATION"],
};

/**
 * One field as printed on the card. `n` is the ISO/IEC 18013-1 field number
 * used on North American licences (1 surname, 3 date of birth, 4b expiry…).
 */
function F({ n, label, value, mono, big, style }: { n: string; label: string; value: string; mono?: boolean; big?: boolean; style?: object }) {
  return (
    <View style={[{ gap: 1, flexShrink: 1 }, style]}>
      <Text style={styles.fieldLabel} numberOfLines={1}>
        <Text style={styles.fieldNo}>{n} </Text>
        {label}
      </Text>
      <Text style={[mono ? styles.fieldMono : styles.fieldValue, big && { fontSize: 15 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** ID-1 card proportions (85.6 × 54 mm), the size of a real licence. */
export const CARD_RATIO = 85.6 / 54;
const VB_W = 343;
const VB_H = Math.round(VB_W / CARD_RATIO);

// ---------------------------------------------------------------------------
// Security print: guilloché waves and a rosette, generated once.
// ---------------------------------------------------------------------------

function wavePaths(): string[] {
  const out: string[] = [];
  for (let k = 0; k < 16; k++) {
    const y0 = 8 + k * 13.5;
    let d = '';
    for (let x = -10; x <= VB_W + 10; x += 5) {
      const y = y0 + 8 * Math.sin(x / 27 + k * 0.42) + 3.5 * Math.sin(x / 8.5 + k * 1.3);
      d += `${x === -10 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    out.push(d);
  }
  return out;
}

function rosettePath(cx: number, cy: number, R: number, r: number, d: number): string {
  // Hypotrochoid, the classic engine-turned pattern on banknotes and IDs.
  let p = '';
  const steps = 720;
  const turns = r / gcd(R, r);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    p += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return p;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

const WAVES = wavePaths();
const ROSETTE = rosettePath(VB_W - 64, 70, 60, 22, 30);
const ROSETTE_INNER = rosettePath(VB_W - 64, 70, 36, 14, 20);

function SecurityPrint({ type, id }: { type: Credential['type']; id: string }) {
  const pal = DOCUMENT_PALETTE[type];
  const g = `g_${id}`;
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={`${g}_bg`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={pal.from} />
          <Stop offset="1" stopColor={pal.to} />
        </LinearGradient>
        <RadialGradient id={`${g}_glow`} cx="0.85" cy="0.1" r="0.8">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.18" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${g}_bg)`} />
      {WAVES.map((d, i) => (
        <Path key={i} d={d} stroke={pal.ink} strokeOpacity={0.14} strokeWidth={0.6} fill="none" />
      ))}
      <Path d={ROSETTE} stroke={pal.ink} strokeOpacity={0.22} strokeWidth={0.5} fill="none" />
      <Path d={ROSETTE_INNER} stroke={pal.ink} strokeOpacity={0.18} strokeWidth={0.5} fill="none" />
      <Rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${g}_glow)`} />
    </Svg>
  );
}

/** Holographic foil seal. */
function HoloSeal({ id, size = 44 }: { id: string; size?: number }) {
  const g = `holo_${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B9F3FF" />
          <Stop offset="0.35" stopColor="#F4C9FF" />
          <Stop offset="0.65" stopColor="#FFF0B3" />
          <Stop offset="1" stopColor="#B6FFD9" />
        </LinearGradient>
      </Defs>
      <Circle cx="22" cy="22" r="21" fill={`url(#${g})`} opacity={0.55} />
      {[17, 13, 9].map((r) => (
        <Circle key={r} cx="22" cy="22" r={r} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={0.7} fill="none" />
      ))}
      <Path d="M15 22.5l4.5 4.5L29 17.5" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
    </Svg>
  );
}

/** A slow band of light that drifts across the card, like foil catching light. */
function Sheen({ width }: { width: number }) {
  const [x] = useState(() => new Animated.Value(0));
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (reduce || !width) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(x, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, width, x]);
  if (reduce || !width) return null;
  const band = width * 0.45;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { width: band, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-band * 1.4, width + band * 0.4] }) }, { skewX: '-18deg' }] },
      ]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
        <Defs>
          <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="10" height="10" fill="url(#sheen)" />
      </Svg>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

/**
 * A credential rendered like the physical document.
 * `compact` keeps the full card but puts the key facts in the top strip, so it
 * reads well when cards are stacked and only the top edge is visible.
 */
export function DocumentCard({ credential, compact, animated = !compact }: { credential: Credential; compact?: boolean; animated?: boolean }) {
  const { t, lang } = useI18n();
  const [width, setWidth] = useState(0);
  const { holder } = credential;
  const isVehicle = credential.type === 'vehicle_permit';
  const valid = credential.status === 'valid';
  const initials = useMemo(() => `${holder.givenNames[0] ?? ''}${holder.surname[0] ?? ''}`.toUpperCase(), [holder]);
  const topRight = isVehicle ? credential.vehicle?.plate : credential.licenceClass ? `${t('class')} ${credential.licenceClass}` : credential.documentNumber.slice(-6);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.card, { aspectRatio: CARD_RATIO, boxShadow: '0px 14px 30px rgba(6, 14, 28, 0.28)' }]}
      accessible
      accessibilityLabel={`${t(credential.type)}, ${holder.givenNames} ${holder.surname}, ${t(credential.status)}, ${t('expires')} ${date(credential.expiresOn, lang)}`}
    >
      <SecurityPrint type={credential.type} id={credential.id} />
      {animated && <Sheen width={width} />}

      <View style={styles.inner}>
        {/* Top strip: what you see when cards are stacked */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name={CREDENTIAL_ICON[credential.type]} size={15} color="#FFFFFF" />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.docType} numberOfLines={1}>
                {BILINGUAL_TITLE[credential.type][0]}
              </Text>
              <Text style={styles.docTypeFr} numberOfLines={1}>
                {BILINGUAL_TITLE[credential.type][1]}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {compact && topRight ? <Text style={styles.topRight}>{topRight}</Text> : null}
            <View style={[styles.status, { backgroundColor: valid ? 'rgba(120, 230, 180, 0.18)' : 'rgba(255, 150, 140, 0.22)' }]}>
              <View style={[styles.dot, { backgroundColor: valid ? '#7FE6B8' : '#FFB0A6' }]} />
              <Text style={styles.statusText}>{t(credential.status)}</Text>
            </View>
          </View>
        </View>

        {isVehicle ? (
          <>
            <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
              <View style={styles.plate}>
                <Text style={styles.plateText}>{credential.vehicle?.plate}</Text>
              </View>
              <Text style={styles.meta}>
                {credential.vehicle?.year} {credential.vehicle?.make} {credential.vehicle?.model} · {credential.vehicle?.colour}
              </Text>
            </View>
            <View style={styles.footer}>
              <F n="" label="VIN / NIV" value={credential.vehicle?.vin ?? ''} mono />
              <F n="" label="EXP" value={cardDate(credential.expiresOn)} style={{ alignItems: 'flex-end' }} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.idBody}>
              <View style={styles.photo} accessibilityLabel="Photo">
                <Text style={styles.initials}>{initials}</Text>
                <View style={styles.photoSeal}>
                  <HoloSeal id={credential.id} size={24} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <F n="4d" label="NUMBER / NO" value={credential.documentNumber} mono big />
                <F n="1,2" label="NAME / NOM" value={`${holder.surname.toUpperCase()},\n${holder.givenNames.toUpperCase()}`} />
                <View style={styles.fieldRow}>
                  <F n="3" label="DOB / DDN" value={cardDate(holder.dateOfBirth)} />
                  <F n="15" label="SEX / SEXE" value={holder.sex} />
                  {credential.type === 'driver_licence' && <F n="16" label="HGT / TAILLE" value={`${holder.heightCm} cm`} />}
                </View>
              </View>
            </View>
            <View style={styles.footer}>
              <View style={styles.fieldRow}>
                <F n="4a" label="ISS / DÉL" value={cardDate(credential.issuedOn)} />
                <F n="4b" label="EXP" value={cardDate(credential.expiresOn)} />
                {credential.licenceClass ? <F n="9" label="CLASS / CAT" value={credential.licenceClass} /> : null}
                {credential.type === 'driver_licence' ? <F n="12" label="REST / COND" value={credential.conditions?.length ? credential.conditions.map((c) => c.split(' ')[0]).join(' ') : '—'} /> : null}
              </View>
              {/* Ghost image: a faint second portrait, a common security feature. */}
              <View style={styles.ghost} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.ghostText}>{initials}</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {isVehicle && (
        <View style={styles.vehicleSeal} pointerEvents="none">
          <HoloSeal id={`${credential.id}_v`} size={40} />
        </View>
      )}

      {IS_PROTOTYPE && (
        <View pointerEvents="none" style={styles.watermarkWrap}>
          <Text style={styles.watermark}>SPECIMEN · PROTOTYPE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#0E2442' },
  inner: { flex: 1, padding: 18, justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docType: { color: '#FFFFFF', fontFamily: fonts.bold, letterSpacing: 1.6, fontSize: 11.5 },
  docTypeFr: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.semibold, letterSpacing: 1.2, fontSize: 8.5, marginTop: 1 },
  idBody: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', flex: 1, marginTop: 10 },
  fieldRow: { flexDirection: 'row', gap: 12, flexShrink: 1 },
  fieldLabel: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.semibold, fontSize: 7.5, letterSpacing: 0.8 },
  fieldNo: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.bold },
  fieldValue: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15 },
  fieldMono: { color: '#FFFFFF', fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6 },
  ghost: { width: 24, height: 30, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', opacity: 0.55 },
  ghostText: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.bold, fontSize: 10 },
  topRight: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.mono, fontSize: 12.5, letterSpacing: 0.5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: '#FFFFFF', fontSize: 11.5, fontFamily: fonts.semibold },
  bodyRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  photo: {
    width: 62,
    height: 78,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSeal: { position: 'absolute', right: -7, bottom: -7 },
  initials: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.bold, fontSize: 24, letterSpacing: 1 },
  surname: { color: '#FFFFFF', fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 0.4 },
  given: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 17 },
  meta: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.medium, fontSize: 12.5 },
  plate: {
    alignSelf: 'flex-start',
    backgroundColor: '#F7F8FA',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: 'rgba(14,36,66,0.85)',
  },
  plateText: { color: '#13315C', fontFamily: fonts.monoBold, fontSize: 22, letterSpacing: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  number: { color: '#FFFFFF', fontFamily: fonts.mono, fontSize: 14, letterSpacing: 1 },
  expiry: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 14 },
  vehicleSeal: { position: 'absolute', right: 18, top: '42%' },
  watermarkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  watermark: { color: 'rgba(255, 140, 128, 0.55)', fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 4, transform: [{ rotate: '-16deg' }] },
});
