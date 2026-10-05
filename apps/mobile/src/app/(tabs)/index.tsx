import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DocumentCard } from '../../components/DocumentCard';
import { Badge, Card, Divider, ErrorState, IconTile, ListItem, Loading, PressScale, Screen, SectionHeader, Txt, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { date, daysUntil, money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { fonts, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Home() {
  const c = useTheme();
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.me(), api.wallet(), api.inbox()]));

  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const [me, wallet, inbox] = data!;
  const { summary, person } = me;
  const licence = wallet.find((w) => w.type === 'driver_licence');
  const unread = summary.unreadMessages;
  const today = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'card', label: t('showLicence'), onPress: () => licence && router.push(`/credential/${licence.id}`) },
    { icon: 'cash', label: t('payTicket'), onPress: () => router.push('/fines') },
    { icon: 'refresh-circle', label: t('renewPlate'), onPress: () => router.push('/vehicles') },
    { icon: 'grid', label: t('allServices'), onPress: () => router.push('/services') },
    { icon: 'create', label: t('signDocument'), onPress: () => router.push('/sign') },
    { icon: 'qr-code', label: t('verifyId'), onPress: () => router.push('/verify') },
  ];

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

  return (
    <Screen refreshing={loading} onRefresh={reload} title={`${t('hello')}, ${person.givenNames.split(' ')[0]}`} subtitle={today.charAt(0).toUpperCase() + today.slice(1)} right={bell}>
      {licence && (
        <PressScale onPress={() => router.push(`/credential/${licence.id}`)} accessibilityLabel={t('showLicence')} scaleTo={0.985}>
          <DocumentCard credential={licence} animated />
        </PressScale>
      )}

      <Card onPress={() => router.push('/fines')} accessibilityLabel={t('openTickets')}>
        <View style={styles.dueRow}>
          <View style={{ gap: 4, flex: 1 }}>
            <Txt v="label" muted>
              {t('totalDue')}
            </Txt>
            <Text style={[styles.amount, { color: summary.overdueFines ? c.danger : c.text }]}>{money(summary.openFinesTotal, lang)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Txt v="caption" muted>
              {t('openTickets')}
            </Txt>
            <Txt v="title">{summary.openFines}</Txt>
          </View>
        </View>
        {summary.overdueFines > 0 && (
          <View style={styles.overdueRow}>
            <Badge label={`${summary.overdueFines} ${t('overdue')}`} tone="danger" />
            <Txt v="caption" muted style={{ flex: 1 }}>
              {t('blockedRenewal')}
            </Txt>
          </View>
        )}
      </Card>

      <SectionHeader>{t('quickActions')}</SectionHeader>
      <Card>
        <View style={styles.grid}>
          {actions.map((a) => (
            <PressScale key={a.label} onPress={a.onPress} containerStyle={styles.actionCell} style={styles.action} accessibilityLabel={a.label}>
              <IconTile icon={a.icon} size={50} />
              <Txt v="caption" style={{ textAlign: 'center', fontFamily: fonts.semibold }} numberOfLines={2}>
                {a.label}
              </Txt>
            </PressScale>
          ))}
        </View>
      </Card>

      <SectionHeader>{t('renewalsDue')}</SectionHeader>
      <Card style={{ paddingVertical: space.xs }}>
        {summary.renewalsDue.length === 0 ? (
          <Txt v="callout" muted style={{ paddingVertical: space.md }}>
            {t('noRenewals')}
          </Txt>
        ) : (
          summary.renewalsDue.map((r, i) => {
            const days = daysUntil(r.expiresOn);
            return (
              <View key={r.id}>
                {i > 0 && <Divider inset={52} />}
                <ListItem
                  icon={r.kind === 'plate' ? 'car' : 'id-card'}
                  tone={days < 30 ? 'warning' : undefined}
                  title={`${r.kind === 'plate' ? t('plate') : t(r.kind as 'health_card')} · ${r.label}`}
                  subtitle={`${t('expires')} ${date(r.expiresOn, lang)}`}
                  right={<Badge label={`${days} d`} tone={days < 30 ? 'warning' : 'info'} />}
                  onPress={() => router.push(r.kind === 'plate' ? `/vehicle/${r.id}` : `/credential/${r.id}`)}
                />
              </View>
            );
          })
        )}
      </Card>

      <SectionHeader action={<Txt v="strong" color={c.accent} onPress={() => router.push('/inbox')}>{t('inbox')} →</Txt>}>{t('inbox')}</SectionHeader>
      <Card style={{ paddingVertical: space.xs }}>
        {inbox.slice(0, 3).map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Divider inset={52} />}
            <ListItem
              icon={m.read ? 'mail-open-outline' : 'mail-unread'}
              tone={m.read ? undefined : 'warning'}
              title={m.title}
              subtitle={m.body}
              onPress={() => router.push(m.link ? (m.link as never) : '/inbox')}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bell: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  bellDot: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2 },
  bellDotText: { color: '#fff', fontSize: 11, fontFamily: fonts.bold },
  dueRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  amount: { fontFamily: fonts.extrabold, fontSize: 38, lineHeight: 44, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  overdueRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  actionCell: { width: '33.33%' },
  action: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
});
