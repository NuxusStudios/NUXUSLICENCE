import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DocumentCard } from '../../components/DocumentCard';
import { BentoRow, BentoTile, Chip, LicenceStatusPill, QuickTile } from '../../components/kit';
import { Badge, Button, Divider, ErrorState, ListItem, Loading, PressScale, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { CATEGORY_ICON, serviceHref } from '../../lib/icons';
import { LOCATIONS, serviceById, visitName } from '../../lib/shared/platform';
import { fonts, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Home() {
  const c = useTheme();
  const { t, lang, tr, pick } = useI18n();
  const { width } = useWindowDimensions();
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.me(), api.wallet(), api.appointments(), api.serviceRequests(), api.consents()]));
  const [hideAmounts, setHideAmounts] = useState(false);

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
  const otherCards = cards.filter((cr) => cr.id !== licence?.id);
  const cardWidth = Math.min(width - 72, 320);
  const openRequests = requests.filter((r) => r.status === 'action_required' || r.status === 'awaiting_payment').length;
  const pendingConsents = consents.filter((x) => x.status === 'pending' && !x.expired).length;
  const next = appointments.find((a) => a.status === 'upcoming' || a.status === 'checked_in');
  const nextLoc = next && LOCATIONS.find((l) => l.id === next.locationId);
  const favServices = preferences.favouriteServices.map(serviceById).filter((s) => !!s);
  const dueColor = summary.overdueFines ? c.danger : c.text;

  const bell = (
    <PressScale onPress={() => router.push('/inbox')} accessibilityLabel={`${t('inbox')}, ${unread}`} style={[styles.bell, { backgroundColor: c.surface, borderColor: c.border }]}>
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
      {/* The driver's licence card sits at the top of the home page (Sanad). */}
      {licence && (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
            <Txt v="section" accessibilityRole="header">
              {tr('Your licence', 'Votre permis')}
            </Txt>
            <LicenceStatusPill status={licence.licenceStatus} />
          </View>
          <PressScale onPress={() => router.push(`/credential/${licence.id}`)} accessibilityLabel={t('showLicence')} scaleTo={0.985}>
            <DocumentCard credential={licence} animated />
          </PressScale>
        </View>
      )}

      {/* Paired row: amount due + next visit. */}
      <BentoRow>
        <BentoTile title={t('totalDue')} onPress={() => router.push('/fines')} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.amount, { color: dueColor }]} accessibilityLabel={hideAmounts ? tr('Amount hidden', 'Montant masqué') : money(summary.openFinesTotal, lang)}>
              {hideAmounts ? '•••' : money(summary.openFinesTotal, lang)}
            </Text>
            <PressScale onPress={() => setHideAmounts((h) => !h)} accessibilityLabel={hideAmounts ? tr('Show', 'Afficher') : tr('Hide', 'Masquer')} style={[styles.eye, { backgroundColor: c.surfaceAlt }]}>
              <Ionicons name={hideAmounts ? 'eye-outline' : 'eye-off-outline'} size={17} color={c.textMuted} />
            </PressScale>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Badge label={`${summary.openFines} ${tr('open', 'en cours')}`} tone={summary.openFines ? 'info' : 'success'} />
            {summary.overdueFines > 0 && <Badge label={`${summary.overdueFines} ${t('overdue')}`} tone="danger" />}
          </View>
        </BentoTile>

        <BentoTile title={tr('Next visit', 'Prochaine visite')} onPress={() => router.push(next ? `/appointments/${next.id}` : '/appointments/book')} style={{ flex: 1 }}>
          {next && nextLoc ? (
            <View style={{ gap: 4 }}>
              <Text style={[styles.monoMd, { color: c.text }]}>{next.time}</Text>
              <Txt v="caption" muted numberOfLines={2}>
                {next.date}
                {'\n'}
                {pick(visitName(next.serviceId))}
              </Txt>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Ionicons name="calendar-outline" size={22} color={c.accent} />
              <Txt v="callout">{tr('Book an appointment', 'Prendre rendez-vous')}</Txt>
            </View>
          )}
        </BentoTile>
      </BentoRow>

      {/* Needs attention. */}
      <BentoTile title={tr('Needs your attention', 'À faire')}>
        {summary.actions.length === 0 ? (
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.xs }}>
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
        {summary.openFines > 1 && (
          <Button
            title={`${tr('Pay all tickets', 'Payer toutes les contraventions')} · ${money(summary.openFinesTotal, lang)}`}
            size="md"
            icon="flash"
            onPress={() => router.push({ pathname: '/pay', params: { kind: 'all-fines', id: 'all', amount: String(summary.openFinesTotal), label: tr(`${summary.openFines} tickets`, `${summary.openFines} contraventions`) } })}
          />
        )}
      </BentoTile>

      {/* Cards carousel (the licence is already the hero at the top). */}
      {otherCards.length > 0 && (
      <BentoTile title={tr('Your other cards', 'Vos autres cartes')} action={tr('View all', 'Tout voir')} onAction={() => router.push('/wallet')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + space.md} decelerationRate="fast" contentContainerStyle={{ gap: space.md, paddingVertical: space.xs, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
          {otherCards.map((cred, i) => (
            <PressScale key={cred.id} onPress={() => router.push(`/credential/${cred.id}`)} accessibilityLabel={cred.type === 'driver_licence' ? t('showLicence') : t(cred.type)} scaleTo={0.985} containerStyle={{ width: cardWidth }}>
              <DocumentCard credential={cred} animated={i === 0} compact={i > 0} />
            </PressScale>
          ))}
        </ScrollView>
        <Chip label={tr('Choose favourites', 'Choisir les favoris')} icon="star-outline" onPress={() => router.push('/favourites?kind=cards')} />
      </BentoTile>
      )}

      {/* Quick access: a 3-column grid of soft tiles, the first one highlighted. */}
      <View style={{ gap: space.sm }}>
        <View style={styles.sectionHead}>
          <Txt v="section" accessibilityRole="header">
            {tr('Quick access', 'Accès rapide')}
          </Txt>
        </View>
        {(() => {
          const items = [
            { icon: 'file-tray-full', label: tr('My requests', 'Mes demandes'), badge: openRequests, to: '/requests', highlight: true },
            { icon: 'calendar', label: tr('Appointments', 'Rendez-vous'), to: '/appointments' },
            { icon: 'create', label: tr('Sign', 'Signer'), to: '/sign' },
            { icon: 'qr-code', label: tr('Verify', 'Vérifier'), to: '/verify' },
            { icon: 'hand-left', label: tr('Data requests', 'Demandes de données'), badge: pendingConsents, to: '/consents' },
            { icon: 'card', label: tr('Payments', 'Paiements'), to: '/payments' },
            { icon: 'location', label: tr('Locations', 'Bureaux'), to: '/locations' },
            { icon: 'help-buoy', label: tr('Help', 'Aide'), to: '/help' },
          ] as const;
          const rows = Array.from({ length: Math.ceil(items.length / 3) }, (_, r) => items.slice(r * 3, r * 3 + 3));
          return rows.map((row, r) => (
            <View key={r} style={styles.quickRow}>
              {row.map((it) => (
                <QuickTile key={it.to} icon={it.icon} label={it.label} badge={'badge' in it ? it.badge : undefined} highlight={'highlight' in it ? it.highlight : undefined} onPress={() => router.push(it.to as never)} />
              ))}
              {row.length < 3 && Array.from({ length: 3 - row.length }, (_, k) => <View key={`s${k}`} style={{ flex: 1 }} />)}
            </View>
          ));
        })()}
      </View>

      {/* Favourite services. */}
      {favServices.length > 0 && (
        <BentoTile title={tr('Favourite services', 'Services favoris')} action={tr('Customize', 'Personnaliser')} onAction={() => router.push('/favourites?kind=services')}>
          {favServices.map((s, i) => (
            <View key={s.id}>
              {i > 0 && <Divider inset={52} />}
              <ListItem icon={CATEGORY_ICON[s.category]} title={pick(s.name)} onPress={() => router.push(serviceHref(s))} />
            </View>
          ))}
        </BentoTile>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bell: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  bellDot: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2 },
  bellDotText: { color: '#fff', fontSize: 11, fontFamily: fonts.bold },
  amount: { fontFamily: fonts.extrabold, fontSize: 32, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  monoMd: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  eye: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { paddingHorizontal: 2, marginTop: space.sm },
  quickRow: { flexDirection: 'row', gap: space.md },
});
