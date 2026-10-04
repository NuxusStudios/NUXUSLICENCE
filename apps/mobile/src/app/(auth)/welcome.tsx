import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui';
import { APP_NAME } from '../../lib/config';
import { useI18n } from '../../lib/i18n';
import { space, useTheme } from '../../lib/theme';
import type { IconName } from '../../components/ui';

export default function Welcome() {
  const c = useTheme();
  const { t, lang, setLang } = useI18n();
  const features: [IconName, string][] = [
    ['wallet', t('walletTitle')],
    ['car-sport', t('vehiclesTitle')],
    ['receipt', t('finesTitle')],
    ['grid', t('servicesTitle')],
  ];
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={{ alignItems: 'flex-end' }}>
        <Button title={lang === 'en' ? 'Français' : 'English'} variant="ghost" onPress={() => setLang(lang === 'en' ? 'fr' : 'en')} />
      </View>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: c.primary }]}>
          <Ionicons name="shield-checkmark" size={44} color={c.primaryText} />
        </View>
        <Text style={[styles.name, { color: c.text }]}>{APP_NAME}</Text>
        <Text style={[styles.tagline, { color: c.textMuted }]}>{t('appTagline')}</Text>
        <View style={styles.features}>
          {features.map(([icon, label]) => (
            <View key={label} style={[styles.feature, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Ionicons name={icon} size={20} color={c.primary} />
              <Text style={{ color: c.text, fontWeight: '600', flexShrink: 1 }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Button title={t('getStarted')} icon="person-add" onPress={() => router.push('/register')} />
        <Button title={t('signIn')} variant="secondary" onPress={() => router.push('/sign-in')} />
        <Button title={t('verifyId')} variant="ghost" icon="qr-code" onPress={() => router.push('/verify')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.xl, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: space.md },
  logo: { width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 32, fontWeight: '900' },
  tagline: { fontSize: 16, textAlign: 'center', lineHeight: 23, maxWidth: 320 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center', marginTop: space.lg },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: space.sm },
});
