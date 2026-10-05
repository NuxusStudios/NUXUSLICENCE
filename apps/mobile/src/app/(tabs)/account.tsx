import { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Badge, Button, Card, Divider, ErrorState, ListItem, Loading, Notice, Row, Screen, Segmented, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { date } from '../../lib/format';
import { useI18n, type Lang } from '../../lib/i18n';
import { fonts, space, useTheme } from '../../lib/theme';
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
  const initials = `${person.givenNames[0] ?? ''}${person.surname[0] ?? ''}`.toUpperCase();

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
    <Screen title={t('tabAccount')}>
      <Card>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: c.primary }]}>
            <Text style={[styles.avatarText, { color: c.primaryText }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="headline">
              {person.givenNames} {person.surname}
            </Txt>
            <Txt v="caption" muted>
              {account.email}
            </Txt>
            <Badge label={`${t('identityLevel')} · ${account.identityAssurance}`} tone="success" />
          </View>
        </View>
        <Divider />
        <Row label={t('licenceNumber')} value={person.licenceNumber} mono />
        <Row label={t('dateOfBirth').split(' (')[0]!} value={date(person.dateOfBirth, lang)} />
        <Row label={t('address')} value={`${person.address.line1}${person.address.line2 ? `, ${person.address.line2}` : ''}\n${person.address.city} ${person.address.province} ${person.address.postalCode}`} />
      </Card>

      <SectionHeader>{t('language')}</SectionHeader>
      <Segmented
        value={lang}
        onChange={(l) => void changeLang(l)}
        options={[
          { value: 'en', label: 'English' },
          { value: 'fr', label: 'Français' },
        ]}
      />

      <SectionHeader>{t('security')}</SectionHeader>
      <Card style={{ paddingVertical: space.xs }}>
        <ListItem
          icon="finger-print"
          title={t('biometricLock')}
          right={<Switch value={biometricLock} onValueChange={toggleBiometric} trackColor={{ true: c.success }} disabled={Platform.OS === 'web'} />}
        />
        <Divider inset={52} />
        <ListItem icon="eye" title={t('accessLog')} onPress={() => router.push('/access-log')} />
        <Divider inset={52} />
        <ListItem icon="receipt" title={t('payments')} onPress={() => router.push('/payments')} />
        <Divider inset={52} />
        <ListItem icon="phone-portrait" tone="danger" title={t('lostDevice')} onPress={() => setRevoke('confirm')} />
        {(revoke === 'confirm' || revoke === 'busy') && (
          <View style={{ gap: space.sm, paddingBottom: space.md }}>
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
            <Button title={t('cancel')} variant="ghost" size="md" onPress={() => setRevoke('idle')} />
          </View>
        )}
        {revoke === 'done' && (
          <View style={{ paddingBottom: space.md }}>
            <Notice tone="success">{t('revoked_done')}</Notice>
          </View>
        )}
        {message && (
          <View style={{ paddingBottom: space.md }}>
            <Notice tone="danger">{message}</Notice>
          </View>
        )}
      </Card>

      <SectionHeader>{t('privacy')}</SectionHeader>
      <Txt v="callout" muted style={{ paddingHorizontal: 2 }}>
        {t('privacyBody')}
      </Txt>

      <View style={{ marginTop: space.md }}>
        <Button title={t('signOut')} variant="secondary" icon="log-out-outline" onPress={() => void signOut()} />
      </View>
      <Txt v="caption" faint style={{ textAlign: 'center' }}>
        {t('version')} {Constants.expoConfig?.version ?? '0.1.0'}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingBottom: space.sm },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: 0.5 },
});
