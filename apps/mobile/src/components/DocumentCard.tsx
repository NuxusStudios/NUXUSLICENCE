import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IS_PROTOTYPE } from '../lib/config';
import { date } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { radius, space, useTheme } from '../lib/theme';
import type { Credential } from '../lib/types';
import type { IconName } from './ui';

export const CREDENTIAL_ICON: Record<Credential['type'], IconName> = {
  driver_licence: 'car-sport',
  photo_card: 'person',
  health_card: 'medkit',
  vehicle_permit: 'document-text',
};

/** Card-shaped rendering of a credential, styled like a wallet pass. */
export function DocumentCard({ credential, compact }: { credential: Credential; compact?: boolean }) {
  const c = useTheme();
  const { t, lang } = useI18n();
  const { holder } = credential;
  const isVehicle = credential.type === 'vehicle_permit';
  const statusColor = credential.status === 'valid' ? '#7CE0B5' : '#FFB4AB';

  return (
    <View
      style={[styles.card, { backgroundColor: isVehicle ? c.cardAlt : c.card }, compact && { minHeight: 150 }]}
      accessible
      accessibilityLabel={`${t(credential.type)}, ${holder.givenNames} ${holder.surname}, ${t(credential.status)}, ${t('expires')} ${date(credential.expiresOn, lang)}`}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={CREDENTIAL_ICON[credential.type]} size={18} color="#fff" />
          <Text style={styles.docType}>{t(credential.type).toUpperCase()}</Text>
        </View>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusText}>{t(credential.status)}</Text>
        </View>
      </View>

      <View style={styles.bodyRow}>
        {!isVehicle && (
          <View style={styles.photo} accessibilityLabel="Photo">
            <Ionicons name="person" size={compact ? 34 : 48} color="rgba(255,255,255,0.75)" />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          {isVehicle && credential.vehicle ? (
            <>
              <Text style={styles.name}>{credential.vehicle.plate}</Text>
              <Text style={styles.meta}>
                {credential.vehicle.year} {credential.vehicle.make} {credential.vehicle.model} · {credential.vehicle.colour}
              </Text>
              {!compact && <Text style={styles.meta}>{t('vin')} {credential.vehicle.vin}</Text>}
            </>
          ) : (
            <>
              <Text style={styles.name}>{holder.surname.toUpperCase()},</Text>
              <Text style={styles.name}>{holder.givenNames}</Text>
              {!compact && <Text style={styles.meta}>{date(holder.dateOfBirth, lang)} · {holder.sex} · {holder.heightCm} cm</Text>}
            </>
          )}
          <Text style={[styles.mono, { marginTop: space.xs }]}>{credential.documentNumber}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        {credential.licenceClass ? (
          <Text style={styles.meta}>
            {t('class')} <Text style={styles.strong}>{credential.licenceClass}</Text>
          </Text>
        ) : (
          <View />
        )}
        <Text style={styles.meta}>
          {t('expires')} <Text style={styles.strong}>{date(credential.expiresOn, lang)}</Text>
        </Text>
      </View>

      {IS_PROTOTYPE && (
        <View pointerEvents="none" style={styles.watermarkWrap}>
          <Text style={[styles.watermark, { color: c.watermark }]}>SPECIMEN · PROTOTYPE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.md, minHeight: 200, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  docType: { color: '#fff', fontWeight: '800', letterSpacing: 1, fontSize: 13 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bodyRow: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  photo: { width: 76, height: 96, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 19, fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  strong: { color: '#fff', fontWeight: '700' },
  mono: { color: '#fff', fontFamily: 'monospace', fontSize: 15, letterSpacing: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  watermarkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  watermark: { fontSize: 22, fontWeight: '900', letterSpacing: 3, transform: [{ rotate: '-18deg' }], opacity: 0.55 },
});
