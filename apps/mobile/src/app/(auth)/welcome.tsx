import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DocumentCard } from '../../components/DocumentCard';
import { Button, Txt } from '../../components/ui';
import { APP_NAME } from '../../lib/config';
import { useI18n } from '../../lib/i18n';
import { fonts, space, useTheme } from '../../lib/theme';
import type { Credential } from '../../lib/types';

// Fictional sample documents for the hero. They carry the SPECIMEN watermark.
const holder: Credential['holder'] = {
  givenNames: 'Alex Jordan',
  surname: 'Tremblay',
  dateOfBirth: '1990-05-14',
  sex: 'X',
  heightCm: 175,
  address: { line1: '100 Example Street', city: 'Toronto', province: 'ON', postalCode: 'M5V 0A1' },
};
const SAMPLES: Credential[] = [
  { id: 'sample_vp', type: 'vehicle_permit', documentNumber: 'VP-21-0045521', issuedOn: '2021-08-02', expiresOn: '2027-08-02', status: 'valid', holder, vehicle: { id: 'v', plate: 'CVPS 123', jurisdiction: 'ON', vin: '1HGCV1F30LA000001', make: 'Honda', model: 'Civic', year: 2021, colour: 'Blue', bodyType: 'SEDAN', plateValidationExpires: '2027-08-02', insurance: { provider: '', policyNumber: '', expiresOn: '' } } },
  { id: 'sample_hc', type: 'health_card', documentNumber: '9876-543-210-XY', issuedOn: '2021-05-14', expiresOn: '2026-11-14', status: 'valid', holder },
  { id: 'sample_dl', type: 'driver_licence', documentNumber: 'T7654-32109-80514', issuedOn: '2022-05-14', expiresOn: '2027-05-14', status: 'valid', licenceClass: 'G, M', conditions: ['X'], discriminator: 'DD7K41093', controlNumber: 'CP0041977', holder },
];
const FAN = [
  { rotate: '-9deg', translateY: 18, translateX: -26 },
  { rotate: '5deg', translateY: 6, translateX: 22 },
  { rotate: '-2deg', translateY: -6, translateX: 0 },
];

export default function Welcome() {
  const c = useTheme();
  const { t, lang, setLang } = useI18n();
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: c.primary }]}>
            <Ionicons name="shield-checkmark" size={17} color={c.primaryText} />
          </View>
          <Txt v="headline" style={{ fontFamily: fonts.extrabold }}>
            {APP_NAME}
          </Txt>
        </View>
        <Button title={lang === 'en' ? 'Français' : 'English'} variant="ghost" size="md" onPress={() => setLang(lang === 'en' ? 'fr' : 'en')} />
      </View>

      <View style={styles.hero} accessibilityLabel={t('sampleDocs')}>
        {SAMPLES.map((cred, i) => (
          <View key={cred.id} style={[styles.fanCard, { transform: [{ translateX: FAN[i]!.translateX }, { translateY: FAN[i]!.translateY }, { rotate: FAN[i]!.rotate }] }]}>
            <DocumentCard credential={cred} compact={i < 2} animated={i === 2} />
          </View>
        ))}
      </View>

      <View style={{ gap: space.md }}>
        <Txt v="display" accessibilityRole="header" style={{ fontSize: 32, lineHeight: 37 }}>
          {t('welcomeHeadline')}
        </Txt>
        <Txt v="body" muted>
          {t('appTagline')}
        </Txt>
      </View>

      <View style={{ gap: space.sm }}>
        <Button title={t('getStarted')} icon="person-add" onPress={() => router.push('/register')} />
        <Button title={t('signIn')} variant="secondary" onPress={() => router.push('/sign-in')} />
        <Button title={t('verifyId')} variant="ghost" size="md" icon="qr-code" onPress={() => router.push('/verify')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl, justifyContent: 'space-between', gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 250, alignItems: 'center', justifyContent: 'center' },
  fanCard: { position: 'absolute', width: '84%', maxWidth: 360 },
});
