import { Platform, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../lib/theme';

// A licence plate rendered in the Ontario style — white plate, Ontario blue,
// serif province wordmark, tall condensed characters with a centre dot. This is
// a PROTOTYPE preview: it deliberately omits the Government of Ontario Crown
// symbol and the official slogan (both protected government marks), and carries
// a "not a valid plate" line in the slogan's place, consistent with the
// SPECIMEN/PROTOTYPE treatment used across the app's credentials.

const PLATE_BLUE = '#2763AD';
const PLATE_EDGE = '#DCE0E6';
const BOLT = '#2B2F36';
const SERIF = Platform.select({ web: 'Georgia, "Times New Roman", serif', ios: 'Georgia', android: 'serif', default: 'serif' });

/** Split "ABCD 555" into two groups so we can place a centre dot between them. */
function groups(plate: string): [string, string | null] {
  const parts = plate.trim().split(/\s+/);
  if (parts.length >= 2) return [parts[0]!, parts.slice(1).join(' ')];
  return [plate.trim(), null];
}

export function Plate({ plate, jurisdiction = 'ON', size = 'md' }: { plate: string; jurisdiction?: string; size?: 'md' | 'lg' }) {
  const wordmark = jurisdiction === 'ON' ? 'ONTARIO' : jurisdiction;
  const [a, b] = groups(plate);

  if (size === 'lg') {
    return (
      <View style={styles.lgOuter} accessibilityLabel={`${wordmark} plate ${plate}`}>
        <View style={styles.lgInner}>
          {([styles.boltTL, styles.boltTR, styles.boltBL, styles.boltBR] as const).map((b2, i) => (
            <View key={i} style={[styles.bolt, b2]} />
          ))}
          <Text style={styles.lgWordmark}>{wordmark}</Text>
          <View style={styles.lgChars}>
            <Text style={styles.lgCharText}>{a}</Text>
            {b ? <Text style={styles.lgDot}>•</Text> : null}
            {b ? <Text style={styles.lgCharText}>{b}</Text> : null}
          </View>
          <Text style={styles.lgFooter}>PROTOTYPE — NOT A VALID PLATE</Text>
        </View>
      </View>
    );
  }

  // Compact chip for rows and lists.
  return (
    <View style={styles.mdOuter} accessibilityLabel={`${wordmark} plate ${plate}`}>
      <Text style={styles.mdWordmark}>{wordmark}</Text>
      <Text style={styles.mdText}>{b ? `${a} • ${b}` : a}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Showcase plate (order preview, vehicle detail)
  lgOuter: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PLATE_EDGE,
    padding: 6,
    boxShadow: '0px 2px 6px rgba(13,21,34,0.12)',
  },
  lgInner: {
    borderWidth: 2,
    borderColor: PLATE_BLUE,
    borderRadius: 11,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 7,
    alignItems: 'center',
    minWidth: 240,
  },
  lgWordmark: { color: PLATE_BLUE, fontFamily: SERIF, fontWeight: '700', fontSize: 17, letterSpacing: 1, marginBottom: 2 },
  lgChars: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lgCharText: { color: PLATE_BLUE, fontFamily: fonts.extrabold, fontSize: 46, lineHeight: 52, letterSpacing: 1 },
  lgDot: { color: PLATE_BLUE, fontSize: 30, lineHeight: 52, marginHorizontal: 2 },
  lgFooter: { color: PLATE_BLUE, fontFamily: SERIF, fontSize: 11, letterSpacing: 1.5, marginTop: 1 },
  bolt: { position: 'absolute', width: 14, height: 9, borderRadius: 4, backgroundColor: BOLT, opacity: 0.85 },
  boltTL: { top: 6, left: 14 },
  boltTR: { top: 6, right: 14 },
  boltBL: { bottom: 6, left: 14 },
  boltBR: { bottom: 6, right: 14 },

  // Compact chip
  mdOuter: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: PLATE_BLUE,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  mdWordmark: { color: PLATE_BLUE, fontFamily: SERIF, fontWeight: '700', fontSize: 8, letterSpacing: 1.5 },
  mdText: { color: PLATE_BLUE, fontFamily: fonts.extrabold, fontSize: 17, letterSpacing: 1, marginTop: -1 },
});
