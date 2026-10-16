import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DocumentCard } from '../../components/DocumentCard';
import { Chip, LicenceStatusPill, Tile, Widget } from '../../components/kit';
import { Badge, Button, Card, Divider, ErrorState, ListItem, Loading, PressScale, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { CATEGORY_ICON, serviceHref } from '../../lib/icons';
import { LOCATIONS, serviceById, visitName } from '../../lib/shared/platform';
import { fonts, radius, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Home() {
  const c = useTheme();
  const { t, lang, tr, pick } = useI18n();
  const { width } = useWindowDimensions();
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.me(), api.wallet(), api.appointments(), api.serviceRequests(), api.consents()]));
  const [hideAmounts, setHideAmounts] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [surveyOpen, setSurveyOpen] = useState(true);

  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const [me, wallet, appointments, requests, consents] = data!;
  const { summary, person, preferences } = me;
  const unread = summary.unreadMessages;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? tr('Good morning', 'Bonjour') : hour < 18 ? tr('Good afternoon', 'Bon après-midi') : tr('Good evening', 'Bonsoir');
  const today = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  const favs = preferences.favouriteCards.map((id) => wallet.find((w) => w.id === id)).filter((w) => !!w);
  const licence = wallet.find((w) => w.type === 'driver_licence');
  const cards = favs.length ? favs : wallet;
  const cardWidth = Math.min(width - 56, 340);
  const openRequests = requests.filter((r) => r.status === 'action_required' || r.status === 'awaiting_payment').length;
  const pendingConsents = consents.filter((x) => x.status === 'pending' && !x.expired).length;
  const next = appointments.find((a) => a.status === 'upcoming' || a.status === 'checked_in');
  const nextLoc = next && LOCATIONS.find((l) => l.id === next.locationId);
  const favServices = preferences.favouriteServices.map(serviceById).filter((s) => !!s);

  const bell = (
    <PressScale onPress={() => router.push('/inbox')} accessibilityLabel={`${t('inbox')}, ${unread}`} style={[styles.bell, { backgroundColor: c.surface, boxShadow: c.shadow, borderColor: c.hairline }]}>
      <Ionicons name="notifications-outline" size={22} color={c.text} />
      {unread > 0 && (
        <View style={[styles.bellDot, { backgroundColor: c.danger, borderColor: c.surface }]}>
          <Text style={styles.bellDotText}>{unread}</Text>
        </View>
      )}
    </PressScale>
  );

  const toneIcon = { danger: 'alert-circle', warning: 'time', info: 'information-circle' } as const;

  return (
    <Screen refreshing={loading} onRefresh={reload} title={`${greeting}, ${person.givenNames.split(' ')[0]}`} subtitle={today.charAt(0).toUpperCase() + today.slice(1)} right={bell}>
      <View style={[styles.idStrip, { backgroundColor: c.successBg }]} accessibilityRole="summary">
        <Ionicons name="shield-checkmark" size={18} color={c.success} />
        <Txt v="caption" color={c.success} style={{ fontFamily: fonts.semibold, flex: 1 }}>
          {tr('Digital ID verified', 'Identité numérique vérifiée')} · {me.account.identityAssurance}
        </Txt>
        <Txt v="caption" color={c.success} style={{ fontFamily: fonts.medium }}>
          {person.licenceNumber}
        </Txt>
      </View>

      {/* The licence's live status, so opening the app is enough to know it's valid. */}
      {licence && (
        <PressScale onPress={() => router.push(`/credential/${licence.id}`)} accessibilityLabel={tr('Driver’s licence status', 'Statut du permis de conduire')} style={[styles.statusRow, { backgroundColor: c.surface, borderColor: c.hairline, boxShadow: c.shadow }]}>
          <Ionicons name="card" size={20} color={c.textMuted} />
          <Txt v="strong" style={{ flex: 1 }}>
            {tr('Driver’s licence', 'Permis de conduire')}
          </Txt>
          <LicenceStatusPill status={licence.licenceStatus} />
          <Ionicons name="chevron-forward" size={17} color={c.textFaint} />
        </PressScale>
      )}

      {bannerOpen && (
        <View style={[styles.banner, { backgroundColor: c.goldBg }]}>
          <Ionicons name="sparkles" size={18} color={c.gold} />
          <Txt v="caption" style={{ flex: 1, fontFamily: fonts.medium }} onPress={() => router.push('/plates')}>
            <Text style={{ fontFamily: fonts.bold, color: c.gold }}>{tr('New: ', 'Nouveau : ')}</Text>
            {tr('check and order personalized plates right in the app.', 'vérifiez et commandez des plaques personnalisées dans l’application.')}
          </Txt>
          <Ionicons name="close" size={18} color={c.textMuted} onPress={() => setBannerOpen(false)} accessibilityLabel={tr('Dismiss', 'Fermer')} />
        </View>
      )}

      <Widget title={tr('Needs your attention', 'À faire')}>
        {summary.actions.length === 0 ? (
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.md }}>
            <Ionicons name="checkmark-circle" size={22} color={c.success} />
            <Txt v="callout" muted style={{ flex: 1 }}>
              {tr('You’re all set: nothing needs your attention right now.', 'Tout est en ordre : rien ne demande votre attention.')}
            </Txt>
          </View>
        ) : (
          summary.actions.slice(0, 5).map((a, i) => (
            <View key={`${a.kind}${a.id}`}>
              {i > 0 && <Divider inset={52} />}
              <ListItem
                icon={toneIcon[a.tone]}
                tone={a.tone === 'info' ? undefined : a.tone}
                title={pick(a.title)}
                subtitle={pick(a.subtitle)}
                right={a.days !== undefined && a.days >= 0 ? <Badge label={`${a.days} ${tr('d', 'j')}`} tone={a.days < 30 ? 'warning' : 'info'} /> : undefined}
                onPress={() => router.push(a.link as never)}
              />
            </View>
          ))
        )}
      </Widget>

      <Widget title={tr('Favourite cards', 'Cartes favorites')} action={tr('View all', 'Tout voir')} onAction={() => router.push('/wallet')} flush>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + space.md} decelerationRate="fast" contentContainerStyle={{ gap: space.md, paddingVertical: space.xs, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
          {cards.map((cred, i) => (
            <PressScale key={cred.id} onPress={() => router.push(`/credential/${cred.id}`)} accessibilityLabel={cred.type === 'driver_licence' ? t('showLicence') : t(cred.type)} scaleTo={0.985} containerStyle={{ width: cardWidth }}>
              <DocumentCard credential={cred} animated={i === 0} compact={i > 0} />
            </PressScale>
          ))}
        </ScrollView>
        <Chip label={tr('Choose favourites', 'Choisir les favoris')} icon="star-outline" onPress={() => router.push('/favourites?kind=cards')} />
      </Widget>

      <Widget title={tr('Quick access', 'Accès rapide')}>
        <View style={styles.grid}>
          <Tile icon="file-tray-full" label={tr('My requests', 'Mes demandes')} badge={openRequests} onPress={() => router.push('/requests')} />
          <Tile icon="calendar" label={tr('Appointments', 'Rendez-vous')} onPress={() => router.push('/appointments')} />
          <Tile icon="create" label={tr('Sign', 'Signer')} onPress={() => router.push('/sign')} />
          <Tile icon="qr-code" label={tr('Verify', 'Vérifier')} onPress={() => router.push('/verify')} />
          <Tile icon="hand-left" label={tr('Data requests', 'Demandes de données')} badge={pendingConsents} onPress={() => router.push('/consents')} />
          <Tile icon="card" label={tr('Payments', 'Paiements')} onPress={() => router.push('/payments')} />
          <Tile icon="location" label={tr('Locations', 'Bureaux')} onPress={() => router.push('/locations')} />
          <Tile icon="help-buoy" label={tr('Help', 'Aide')} onPress={() => router.push('/help')} />
        </View>
      </Widget>

      <Widget title={t('tabFines')} action={tr('View all', 'Tout voir')} onAction={() => router.push('/fines')} flush>
        <Card>
          <View style={styles.dueRow}>
            <View style={{ gap: 4, flex: 1 }}>
              <Txt v="label" muted>
                {t('totalDue')}
              </Txt>
              <Text style={[styles.amount, { color: summary.overdueFines ? c.danger : c.text }]} accessibilityLabel={hideAmounts ? tr('Amount hidden', 'Montant masqué') : money(summary.openFinesTotal, lang)}>
                {hideAmounts ? '$ •••.••' : money(summary.openFinesTotal, lang)}
              </Text>
            </View>
            <PressScale onPress={() => setHideAmounts((h) => !h)} accessibilityLabel={hideAmounts ? tr('Show amounts', 'Afficher les montants') : tr('Hide amounts', 'Masquer les montants')} style={[styles.eye, { backgroundColor: c.surfaceAlt }]}>
              <Ionicons name={hideAmounts ? 'eye-outline' : 'eye-off-outline'} size={20} color={c.textMuted} />
            </PressScale>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Badge label={`${summary.openFines} ${tr('open', 'en cours')}`} tone={summary.openFines ? 'info' : 'success'} />
            {summary.overdueFines > 0 && <Badge label={`${summary.overdueFines} ${t('overdue')}`} tone="danger" />}
          </View>
          {summary.openFines > 1 && (
            <Button
              title={`${tr('Pay all', 'Tout payer')} · ${money(summary.openFinesTotal, lang)}`}
              size="md"
              icon="flash"
              onPress={() => router.push({ pathname: '/pay', params: { kind: 'all-fines', id: 'all', amount: String(summary.openFinesTotal), label: tr(`${summary.openFines} tickets`, `${summary.openFines} contraventions`) } })}
            />
          )}
        </Card>
      </Widget>

      <Widget title={tr('Favourite services', 'Services favoris')} action={tr('Customize', 'Personnaliser')} onAction={() => router.push('/favourites?kind=services')}>
        {favServices.map((s, i) => (
          <View key={s.id}>
            {i > 0 && <Divider inset={52} />}
            <ListItem icon={CATEGORY_ICON[s.category]} title={pick(s.name)} onPress={() => router.push(serviceHref(s))} />
          </View>
        ))}
      </Widget>

      <Widget title={tr('My appointments', 'Mes rendez-vous')} action={tr('View all', 'Tout voir')} onAction={() => router.push('/appointments')}>
        {next && nextLoc ? (
          <ListItem
            icon="calendar"
            title={`${next.date} · ${next.time}`}
            subtitle={`${pick(visitName(next.serviceId))}\n${pick(nextLoc.name)}`}
            right={next.status === 'checked_in' ? <Badge label={next.ticket?.number ?? ''} tone="success" /> : undefined}
            onPress={() => router.push(`/appointments/${next.id}`)}
          />
        ) : (
          <ListItem icon="add-circle" title={tr('Book an appointment', 'Prendre rendez-vous')} subtitle={tr('ServiceOntario and DriveTest, up to a week ahead', 'ServiceOntario et TestVolant, jusqu’à une semaine à l’avance')} onPress={() => router.push('/appointments/book')} />
        )}
      </Widget>

      {surveyOpen && (
        <Card style={{ gap: space.sm, borderRadius: radius.lg }}>
          <Badge label={tr('Survey', 'Sondage')} tone="info" />
          <Txt v="headline">{tr('Share your experience', 'Donnez votre avis')}</Txt>
          <Txt v="callout" muted>
            {tr('Two questions to help us improve the app.', 'Deux questions pour nous aider à améliorer l’application.')}
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title={tr('Take part', 'Participer')} size="md" onPress={() => router.push('/help/rate')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={tr('Later', 'Plus tard')} size="md" variant="secondary" onPress={() => setSurveyOpen(false)} />
            </View>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bell: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  bellDot: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2 },
  bellDotText: { color: '#fff', fontSize: 11, fontFamily: fonts.bold },
  idStrip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md, marginTop: -space.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.md },
  dueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { fontFamily: fonts.extrabold, fontSize: 38, lineHeight: 44, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  eye: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, paddingVertical: space.sm },
});
