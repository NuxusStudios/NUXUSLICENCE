import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
function F({ n, label, value, mono, big, small, strong, style }: { n: string; label: string; value: string; mono?: boolean; big?: boolean; small?: boolean; strong?: boolean; style?: object }) {
  return (
    <View style={[{ gap: 1, flexShrink: 1 }, style]}>
      <Text style={styles.fieldLabel} numberOfLines={1}>
        <Text style={styles.fieldNo}>{n} </Text>
        {label.replace(/ \/ /g, '/')}
      </Text>
      <Text style={[mono ? styles.fieldMono : styles.fieldValue, big && { fontSize: 15 }, small && { fontSize: 9.5, lineHeight: 11.5 }, strong && { fontFamily: fonts.bold, fontSize: 12 }]} numberOfLines={value.includes('\n') ? 2 : 1}>
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
 * Lays the card out at a fixed 343 × 216 "print size" and scales it to the
 * width it's shown at, so every field keeps its position at any size.
 */
function Canvas({ width, children }: { width: number; children: ReactNode }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: VB_W,
        height: VB_H,
        opacity: width ? 1 : 0,
        transform: [{ scale: width ? width / VB_W : 1 }],
        transformOrigin: 'top left',
      }}
    >
      {children}
    </View>
  );
}

/** Small cursive-style rendering of the holder's signature. */
function Signature({ holder }: { holder: Credential['holder'] }) {
  return (
    <Text style={styles.signature} numberOfLines={1}>
      {holder.givenNames[0]}. {holder.surname}
    </Text>
  );
}

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
  const isLicence = credential.type === 'driver_licence';
  const conditionCodes = (credential.conditions ?? []).map((c) => c.split(' ')[0]).join(' ');
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

      <Canvas width={width}>
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
              <View style={{ width: 66, gap: 4, alignItems: 'center' }}>
                <View style={styles.photo} accessibilityLabel="Photo">
                  <Text style={styles.initials}>{initials}</Text>
                  <View style={styles.photoSeal}>
                    <HoloSeal id={credential.id} size={22} />
                  </View>
                </View>
                <Signature holder={holder} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <F n="1,2" label="NAME / NOM" value={`${holder.surname.toUpperCase()}\n${holder.givenNames.toUpperCase()}`} />
                <F n="8" label="ADDRESS / ADRESSE" value={`${holder.address.line1.toUpperCase()}${holder.address.line2 ? `, ${holder.address.line2.toUpperCase()}` : ''}\n${holder.address.city.toUpperCase()}, ${holder.address.province} ${holder.address.postalCode}`} small />
                <F n="4d" label="NUMBER / NUMÉRO" value={credential.documentNumber} mono big />
                <View style={styles.fieldRow}>
                  <F n="15" label="SEX / SEXE" value={holder.sex} />
                  {isLicence && <F n="16" label="HGT / HAUT." value={`${holder.heightCm} cm`} />}
                  {credential.licenceClass ? <F n="9" label="CLASS / CATÉG." value={credential.licenceClass} /> : null}
                  {isLicence && <F n="12" label="REST / COND." value={conditionCodes || '—'} />}
                </View>
              </View>
            </View>
            <View style={styles.footer}>
              <View style={styles.fieldRow}>
                <F n="3" label="DOB / DDN" value={cardDate(holder.dateOfBirth)} strong />
                <F n="4a" label="ISS / DÉL" value={cardDate(credential.issuedOn)} />
                <F n="4b" label="EXP" value={cardDate(credential.expiresOn)} />
                {credential.discriminator ? <F n="5" label="DD / REF" value={credential.discriminator} mono /> : null}
              </View>
              {/* Ghost image: a faint second portrait, a common security feature. */}
              <View style={styles.ghost} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.ghostText}>{initials}</Text>
              </View>
            </View>
          </>
        )}
      </View>
      </Canvas>

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

// ---------------------------------------------------------------------------
// Back of the card
// ---------------------------------------------------------------------------

/** What each licence class allows, in both official languages. */
const CLASS_TEXT: Record<string, [string, string]> = {
  G: ['Cars, vans and small trucks; combinations up to 11,000 kg (towed vehicle max. 4,600 kg)', 'Autos, fourgonnettes et petits camions; ensembles jusqu’à 11 000 kg (véh. remorqué max. 4 600 kg)'],
  G2: ['As class G, with G2 restrictions', 'Comme la catégorie G, avec restrictions de niveau G2'],
  G1: ['As class G, with G1 restrictions', 'Comme la catégorie G, avec restrictions de niveau G1'],
  M: ['Motorcycles, including limited-speed motorcycles and mopeds', 'Motocyclettes, y compris à vitesse limitée et cyclomoteurs'],
  M2: ['As class M, with M2 restrictions', 'Comme la catégorie M, avec restrictions de niveau M2'],
  M1: ['As class M, with M1 restrictions', 'Comme la catégorie M, avec restrictions de niveau M1'],
};

/** Condition codes printed in field 12. */
const CONDITION_TEXT: Record<string, [string, string]> = {
  X: ['Corrective lenses must be worn', 'Port de verres correcteurs obligatoire'],
};

/** The reverse side of an identity card. */
export function DocumentCardBack({ credential }: { credential: Credential }) {
  const [width, setWidth] = useState(0);
  const classes = (credential.licenceClass ?? '').split(/,\s*/).filter(Boolean);
  const conditions = (credential.conditions ?? []).map((c) => {
    const code = c.split(' ')[0]!;
    return [code, CONDITION_TEXT[code] ?? [c, c]] as const;
  });
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.card, { aspectRatio: CARD_RATIO, boxShadow: '0px 14px 30px rgba(6, 14, 28, 0.28)' }]}
      accessible
      accessibilityLabel={`Back of card. ${classes.map((c) => `Class ${c}: ${CLASS_TEXT[c]?.[0] ?? c}`).join('. ')}`}
    >
      <SecurityPrint type={credential.type} id={`${credential.id}_back`} />
      <Canvas width={width}>
        <View style={[styles.inner, { paddingBottom: 0 }]}>
          <View style={styles.backTop}>
            <Text style={styles.fieldLabel}>
              <Text style={styles.fieldNo}>9 </Text>CLASS / CATÉGORIE
            </Text>
            {credential.controlNumber ? (
              <View style={styles.controlBox}>
                <Text style={styles.controlText}>{credential.controlNumber}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 5, marginTop: 4, flex: 1 }}>
            {classes.map((c) => (
              <View key={c} style={styles.backLine}>
                <Text style={styles.backCode}>{c}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.backEn}>{CLASS_TEXT[c]?.[0] ?? `Class ${c}`}</Text>
                  <Text style={styles.backFr}>{CLASS_TEXT[c]?.[1] ?? `Catégorie ${c}`}</Text>
                </View>
              </View>
            ))}
            {conditions.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 3 }]}>
                  <Text style={styles.fieldNo}>12 </Text>RESTRICTIONS / CONDITIONS
                </Text>
                {conditions.map(([code, [en, fr]]) => (
                  <View key={code} style={styles.backLine}>
                    <Text style={styles.backCode}>{code}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.backEn}>{en}</Text>
                      <Text style={styles.backFr}>{fr}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
        {/* Where a plastic card carries a barcode, the digital card is checked with its live, signed QR code instead. */}
        <View style={styles.verifyBand}>
          <Ionicons name="qr-code" size={22} color="#16325C" />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifyEn}>Verify with the live QR code in the app. No barcode.</Text>
            <Text style={styles.verifyFr}>Vérifiez avec le code QR en direct dans l’appli. Aucun code à barres.</Text>
          </View>
          {credential.discriminator ? <Text style={styles.verifyDd}>{credential.discriminator}</Text> : null}
        </View>
      </Canvas>
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
  inner: { flex: 1, padding: 13, justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docType: { color: '#FFFFFF', fontFamily: fonts.bold, letterSpacing: 1.6, fontSize: 11.5 },
  docTypeFr: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.semibold, letterSpacing: 1.2, fontSize: 8.5, marginTop: 1 },
  idBody: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', flex: 1, marginTop: 5 },
  fieldRow: { flexDirection: 'row', gap: 9, flexShrink: 1 },
  fieldLabel: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.semibold, fontSize: 7, letterSpacing: 0.4 },
  fieldNo: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.bold },
  fieldValue: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 12.5 },
  fieldMono: { color: '#FFFFFF', fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6 },
  ghost: { width: 20, height: 25, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', opacity: 0.6 },
  signature: { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.medium, fontStyle: 'italic', fontSize: 10, transform: [{ rotate: '-4deg' }] },
  ghostText: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.bold, fontSize: 8.5 },
  topRight: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.mono, fontSize: 12.5, letterSpacing: 0.5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: '#FFFFFF', fontSize: 11.5, fontFamily: fonts.semibold },
  bodyRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  photo: {
    width: 64,
    height: 80,
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
  backTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlBox: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  controlText: { color: '#0D1522', fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 2 },
  backLine: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  backCode: { color: '#FFFFFF', fontFamily: fonts.extrabold, fontSize: 13, width: 22 },
  backEn: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 9.5, lineHeight: 12 },
  backFr: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.medium, fontSize: 8.5, lineHeight: 11 },
  verifyBand: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, backgroundColor: '#F7F8FA', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15 },
  verifyEn: { color: '#16325C', fontFamily: fonts.semibold, fontSize: 9, lineHeight: 11.5 },
  verifyFr: { color: '#5F6B7D', fontFamily: fonts.medium, fontSize: 8, lineHeight: 10.5 },
  verifyDd: { color: '#16325C', fontFamily: fonts.mono, fontSize: 9 },
  watermarkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  watermark: { color: 'rgba(255, 140, 128, 0.55)', fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 4, transform: [{ rotate: '-16deg' }] },
});
