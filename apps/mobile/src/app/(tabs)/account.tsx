import { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Widget } from '../../components/kit';
import { Badge, Button, Card, Divider, ErrorState, ListItem, Loading, Notice, Row, Screen, Segmented, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { date } from '../../lib/format';
import { useI18n, type Lang } from '../../lib/i18n';
import { fonts, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

/** "My profile" (Sanad): identity, personal info, security, preferences, payments, support. */
export default function Account() {
  const c = useTheme();
  const { t, tr, lang, setLang } = useI18n();
  const { signOut, biometricLock, setBiometricLock } = useAuth();
  const { data, error, loading, reload } = useAsync(api.me);
  // Confirmation is built into the screen: system dialogs aren't available everywhere (e.g. embedded web views).
  const [revoke, setRevoke] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  const [logout, setLogout] = useState(false);
  const [message, setMessage] = useState<string>();
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const { account, person } = data!;
  const initials = `${person.givenNames[0] ?? ''}${person.surname[0] ?? ''}`.toUpperCase();
  const go = (to: string) => () => router.push(to as never);

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
          </View>
        </View>
        <Divider />
        <Row label={tr('Digital ID status', 'Statut de l’identité numérique')} value={<Badge label={`${tr('Verified', 'Vérifiée')} · ${account.identityAssurance}`} tone="success" />} />
        <Row label={t('licenceNumber')} value={person.licenceNumber} />
        <Row label={t('dateOfBirth').split(' (')[0]!} value={date(person.dateOfBirth, lang)} />
      </Card>

      <Widget title={tr('Personal information', 'Renseignements personnels')}>
        <ListItem icon="call" title={tr('Mobile number', 'Cellulaire')} subtitle={account.phone ?? tr('Not set', 'Non indiqué')} />
        <Divider inset={52} />
        <ListItem icon="mail" title={tr('Email', 'Courriel')} subtitle={account.email} />
        <Divider inset={52} />
        <ListItem
          icon="home"
          title={t('address')}
          subtitle={`${person.address.line1}${person.address.line2 ? `, ${person.address.line2}` : ''}, ${person.address.city} ${person.address.postalCode}`}
          onPress={go('/services/change-address')}
        />
        <Divider inset={52} />
        <ListItem icon="car" title={t('tabVehicles')} onPress={go('/vehicles')} />
      </Widget>

      <Widget title={tr('Digital identity and security', 'Identité numérique et sécurité')}>
        <ListItem icon="keypad" title={account.pinSet ? tr('Change digital ID PIN', 'Changer le NIP') : tr('Set a digital ID PIN', 'Choisir un NIP')} subtitle={tr('Confirms signing and data sharing', 'Confirme les signatures et les partages')} onPress={go('/security/pin')} />
        <Divider inset={52} />
        <ListItem icon="lock-closed" title={tr('Change password', 'Changer le mot de passe')} onPress={go('/security/password')} />
        <Divider inset={52} />
        <ListItem
          icon="finger-print"
          title={t('biometricLock')}
          right={<Switch value={biometricLock} onValueChange={toggleBiometric} trackColor={{ true: c.success }} disabled={Platform.OS === 'web'} accessibilityLabel={t('biometricLock')} />}
        />
        <Divider inset={52} />
        <ListItem icon="eye" title={t('accessLog')} onPress={go('/access-log')} />
        <Divider inset={52} />
        <ListItem icon="hand-left" title={tr('Data requests', 'Demandes de données')} subtitle={tr('Approve or revoke what organizations can read', 'Approuver ou révoquer ce que les organismes peuvent lire')} onPress={go('/consents')} />
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
      </Widget>

      <Widget title={t('language')} flush>
        <Segmented
          value={lang}
          onChange={(l) => void changeLang(l)}
          options={[
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'Français' },
          ]}
        />
      </Widget>

      <Widget title={tr('Preferences', 'Préférences')}>
        <ListItem icon="notifications" title={tr('Notifications', 'Notifications')} onPress={go('/notifications')} />
        <Divider inset={52} />
        <ListItem icon="star" title={tr('Favourite cards', 'Cartes favorites')} onPress={go('/favourites?kind=cards')} />
        <Divider inset={52} />
        <ListItem icon="apps" title={tr('Favourite services', 'Services favoris')} onPress={go('/favourites?kind=services')} />
      </Widget>

      <Widget title={tr('Activity and payments', 'Activité et paiements')}>
        <ListItem icon="file-tray-full" title={tr('My requests', 'Mes demandes')} onPress={go('/requests')} />
        <Divider inset={52} />
        <ListItem icon="calendar" title={tr('My appointments', 'Mes rendez-vous')} onPress={go('/appointments')} />
        <Divider inset={52} />
        <ListItem icon="create" title={tr('Signed documents', 'Documents signés')} onPress={go('/sign')} />
        <Divider inset={52} />
        <ListItem icon="receipt" title={tr('Payment history', 'Historique des paiements')} onPress={go('/payments')} />
        <Divider inset={52} />
        <ListItem icon="card" title={tr('Saved cards', 'Cartes enregistrées')} onPress={go('/cards')} />
      </Widget>

      <Widget title={tr('Support', 'Soutien')}>
        <ListItem icon="help-buoy" title={tr('Help centre', 'Centre d’aide')} onPress={go('/help')} />
        <Divider inset={52} />
        <ListItem icon="chatbubble-ellipses" title={tr('Suggestions and complaints', 'Suggestions et plaintes')} onPress={go('/help/feedback')} />
        <Divider inset={52} />
        <ListItem icon="star-half" title={tr('Rate the app', 'Évaluer l’application')} onPress={go('/help/rate')} />
        <Divider inset={52} />
        <ListItem icon="location" title={tr('Locations', 'Bureaux')} onPress={go('/locations')} />
        <Divider inset={52} />
        <ListItem icon="information-circle" title={tr('About', 'À propos')} onPress={go('/help/about')} />
        <Divider inset={52} />
        <ListItem icon="document-lock" title={tr('Privacy policy', 'Politique de confidentialité')} onPress={go('/help/privacy')} />
      </Widget>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        {logout ? (
          <Card style={{ gap: space.sm }}>
            <Txt v="strong">{tr('Sign out of CivicPass?', 'Se déconnecter de CivicPass?')}</Txt>
            <Button title={t('signOut')} variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
            <Button title={t('cancel')} variant="ghost" size="md" onPress={() => setLogout(false)} />
          </Card>
        ) : (
          <Button title={t('signOut')} variant="secondary" icon="log-out-outline" onPress={() => setLogout(true)} />
        )}
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
