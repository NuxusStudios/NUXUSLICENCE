import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DocumentCard } from '../../components/DocumentCard';
import { LampHero } from '../../components/LampHero';
import { Accordion, Tile } from '../../components/kit';
import { Button, Card, Divider, IconTile, PressScale, Txt, type IconName } from '../../components/ui';
import { APP_NAME } from '../../lib/config';
import { useI18n } from '../../lib/i18n';
import { FAQ } from '../../lib/shared/platform';
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
  const { t, tr, pick, lang, setLang } = useI18n();
  const pillars: [IconName, string, string][] = [
    ['id-card', tr('Digital documents', 'Documents numériques'), tr('Your licence, vehicle permits and health card as secure digital copies, with QR codes that share only what you choose.', 'Votre permis, vos certificats d’immatriculation et votre carte santé en copies numériques sécurisées, avec des codes QR qui ne partagent que ce que vous choisissez.')],
    ['card', tr('Electronic payments', 'Paiements électroniques'), tr('Pay tickets, renewals and service fees with Apple Pay, Google Pay, Interac or card, and track every receipt.', 'Payez contraventions, renouvellements et frais avec Apple Pay, Google Pay, Interac ou carte, et retrouvez chaque reçu.')],
    ['create', tr('Digital signature', 'Signature numérique'), tr('Sign documents such as a bill of sale without visiting an office, confirmed with your PIN.', 'Signez des documents comme un acte de vente sans vous déplacer, avec confirmation par NIP.')],
  ];
  const why: [IconName, string, string][] = [
    ['shield-checkmark', tr('Secure and trusted', 'Sûr et fiable'), tr('Signed, short-lived QR codes and a log of every check.', 'Codes QR signés et éphémères, et journal de chaque vérification.')],
    ['hand-left', tr('Easy to use', 'Facile à utiliser'), tr('Everything a step away, in English and French.', 'Tout à portée de main, en français et en anglais.')],
    ['apps', tr('Comprehensive', 'Complet'), tr('Licences, plates, tickets, certificates and appointments.', 'Permis, plaques, contraventions, certificats et rendez-vous.')],
    ['chatbubbles', tr('Support', 'Soutien'), tr('Help centre, suggestions and a contact centre.', 'Centre d’aide, suggestions et centre d’appels.')],
  ];
  const guest: [IconName, string, string][] = [
    ['grid', tr('Browse services', 'Parcourir les services'), '/directory'],
    ['location', tr('Find a location', 'Trouver un bureau'), '/locations'],
    ['help-buoy', tr('Help and FAQ', 'Aide et FAQ'), '/help'],
    ['qr-code', t('verifyId'), '/verify'],
  ];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.wrap}>
      <LampHero
        style={{ marginHorizontal: -space.xl, marginTop: -space.sm }}
        header={
          <View style={styles.heroBrand}>
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="shield-checkmark" size={16} color="#fff" />
              </View>
              <Text style={styles.brandText}>{APP_NAME}</Text>
            </View>
            <PressScale onPress={() => setLang(lang === 'en' ? 'fr' : 'en')} accessibilityLabel={lang === 'en' ? 'Français' : 'English'} style={styles.langPill}>
              <Text style={styles.langText}>{lang === 'en' ? 'Français' : 'English'}</Text>
            </PressScale>
          </View>
        }
      >
        <Text style={styles.heroTitle}>{t('welcomeHeadline')}</Text>
        <Text style={styles.heroSubtitle}>{t('appTagline')}</Text>

        <View style={styles.heroActions}>
          <Button title={t('getStarted')} icon="person-add" onPress={() => router.push('/register')} />
          <PressScale onPress={() => router.push('/sign-in')} accessibilityLabel={t('signIn')} style={styles.heroSecondary}>
            <Text style={styles.heroSecondaryText}>{t('signIn')}</Text>
          </PressScale>
        </View>
      </LampHero>

      <View style={styles.hero} accessibilityLabel={t('sampleDocs')}>
        {SAMPLES.map((cred, i) => (
          <View key={cred.id} style={[styles.fanCard, { transform: [{ translateX: FAN[i]!.translateX }, { translateY: FAN[i]!.translateY }, { rotate: FAN[i]!.rotate }] }]}>
            <DocumentCard credential={cred} compact={i < 2} animated={i === 2} />
          </View>
        ))}
      </View>

      <View style={{ gap: space.md }}>
        <Txt v="title" accessibilityRole="header">
          {tr('Your government services, in one app', 'Vos services gouvernementaux, dans une seule application')}
        </Txt>
        {pillars.map(([icon, title, body]) => (
          <Card key={title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
            <IconTile icon={icon} size={44} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt v="strong">{title}</Txt>
              <Txt v="caption" muted>
                {body}
              </Txt>
            </View>
          </Card>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Txt v="headline" accessibilityRole="header">
          {tr('No account? Continue as a guest', 'Pas de compte? Continuez comme invité')}
        </Txt>
        <Card>
          <View style={styles.grid}>
            {guest.map(([icon, label, to]) => (
              <Tile key={to} icon={icon} label={label} onPress={() => router.push(to as never)} />
            ))}
          </View>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <Txt v="headline" accessibilityRole="header">
          {tr(`Why ${APP_NAME}`, `Pourquoi ${APP_NAME}`)}
        </Txt>
        <View style={styles.why}>
          {why.map(([icon, title, body]) => (
            <Card key={title} style={styles.whyCard}>
              <Ionicons name={icon} size={22} color={c.accent} />
              <Txt v="strong">{title}</Txt>
              <Txt v="caption" muted>
                {body}
              </Txt>
            </Card>
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Txt v="headline" accessibilityRole="header">
          {tr('Frequently asked questions', 'Foire aux questions')}
        </Txt>
        <Card style={{ paddingVertical: space.xs }}>
          {FAQ.slice(0, 4).map((f, i) => (
            <View key={f.id}>
              {i > 0 && <Divider />}
              <Accordion title={pick(f.q)}>
                <Txt v="callout" muted>
                  {pick(f.a)}
                </Txt>
              </Accordion>
            </View>
          ))}
        </Card>
        <Button title={tr('View more', 'Voir plus')} variant="ghost" size="md" onPress={() => router.push('/help')} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg, flexWrap: 'wrap' }}>
        <Txt v="caption" color={c.accent} onPress={() => router.push('/help/about')} accessibilityRole="link">
          {tr('About', 'À propos')}
        </Txt>
        <Txt v="caption" color={c.accent} onPress={() => router.push('/help/privacy')} accessibilityRole="link">
          {tr('Privacy policy', 'Confidentialité')}
        </Txt>
        <Txt v="caption" color={c.accent} onPress={() => router.push('/help/feedback')} accessibilityRole="link">
          {tr('Suggestions and complaints', 'Suggestions et plaintes')}
        </Txt>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xxl * 2, gap: space.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
  heroBrand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  brandText: { color: '#fff', fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: -0.2 },
  langPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.06)' },
  langText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 13 },
  heroTitle: { color: '#F3F7FF', fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 41, letterSpacing: -1, textAlign: 'center' },
  heroSubtitle: { color: 'rgba(233,240,255,0.72)', fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 380, marginTop: space.md },
  heroActions: { width: '100%', maxWidth: 360, gap: space.sm, marginTop: space.xl },
  heroSecondary: { minHeight: 54, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.32)', backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  heroSecondaryText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.1 },
  hero: { height: 250, alignItems: 'center', justifyContent: 'center' },
  fanCard: { position: 'absolute', width: '84%', maxWidth: 360 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  why: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  whyCard: { width: '48.5%', flexGrow: 1, minWidth: 150, gap: 6 },
});
