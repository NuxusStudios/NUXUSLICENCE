import { useState } from 'react';
import { Platform, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Body, Button, Card, Divider, ErrorState, ListItem, Loading, Notice, Row, Screen, SectionHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { date } from '../../lib/format';
import { useI18n, type Lang } from '../../lib/i18n';
import { space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Account() {
  const c = useTheme();
  const { t, lang, setLang } = useI18n();
  const { signOut, biometricLock, setBiometricLock } = useAuth();
  const { data, error, loading, reload } = useAsync(api.me);
  // Confirmation is built into the screen: system dialogs aren't available everywhere (e.g. embedded web views).
  const [revoke, setRevoke] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  const [message, setMessage] = useState<string>();
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const { account, person } = data!;

  async function changeLang(l: Lang) {
    setLang(l);
    await api.updateMe({ language: l }).catch(() => undefined);
  }

  async function toggleBiometric(on: boolean) {
    try {
      await setBiometricLock(on);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <Screen>
      <SectionHeader>{t('profile')}</SectionHeader>
      <Card>
        <Row label={t('licenceNumber')} value={person.licenceNumber} />
        <Row label={`${person.surname}, ${person.givenNames}`} />
        <Row label={t('dateOfBirth').split(' (')[0]!} value={date(person.dateOfBirth, lang)} />
        <Row label={t('address')} value={`${person.address.line1}${person.address.line2 ? `, ${person.address.line2}` : ''}\n${person.address.city} ${person.address.province} ${person.address.postalCode}`} />
        <Row label={t('email')} value={account.email} />
        <Row label={t('identityLevel')} value={account.identityAssurance} />
      </Card>

      <SectionHeader>{t('language')}</SectionHeader>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="English" variant={lang === 'en' ? 'primary' : 'secondary'} onPress={() => changeLang('en')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Français" variant={lang === 'fr' ? 'primary' : 'secondary'} onPress={() => changeLang('fr')} />
        </View>
      </View>

      <SectionHeader>{t('security')}</SectionHeader>
      <Card>
        <ListItem
          icon="finger-print"
          title={t('biometricLock')}
          right={<Switch value={biometricLock} onValueChange={toggleBiometric} trackColor={{ true: c.primary }} disabled={Platform.OS === 'web'} />}
        />
        <Divider />
        <ListItem icon="eye" title={t('accessLog')} onPress={() => router.push('/access-log')} />
        <Divider />
        <ListItem icon="receipt-outline" title={t('payments')} onPress={() => router.push('/payments')} />
        <Divider />
        <ListItem icon="phone-portrait" tone="danger" title={t('lostDevice')} onPress={() => setRevoke('confirm')} />
        {(revoke === 'confirm' || revoke === 'busy') && (
          <View style={{ gap: space.sm }}>
            <Notice tone="warning">{t('revokeConfirm')}</Notice>
            <Button
              title={t('revokeNow')}
              variant="danger"
              loading={revoke === 'busy'}
              onPress={async () => {
                setRevoke('busy');
                try {
                  await api.revokeWallet();
                  setRevoke('done');
                } catch (e) {
                  setMessage((e as Error).message);
                  setRevoke('idle');
                }
              }}
            />
            <Button title={t('cancel')} variant="ghost" onPress={() => setRevoke('idle')} />
          </View>
        )}
        {revoke === 'done' && <Notice tone="success">{t('revoked_done')}</Notice>}
        {message && <Notice tone="danger">{message}</Notice>}
      </Card>

      <SectionHeader>{t('privacy')}</SectionHeader>
      <Body muted>{t('privacyBody')}</Body>

      <Button title={t('signOut')} variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
      <Body muted style={{ textAlign: 'center' }}>
        {t('version')} {Constants.expoConfig?.version ?? '0.1.0'}
      </Body>
    </Screen>
  );
}
