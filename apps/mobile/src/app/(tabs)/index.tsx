import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card, ErrorState, ListItem, Loading, Screen, SectionHeader, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { date, daysUntil, money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { radius, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Home() {
  const c = useTheme();
  const { t, lang } = useI18n();
  const navigation = useNavigation();
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.me(), api.wallet(), api.inbox()]));
  const unread = data?.[0].summary.unreadMessages ?? 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/inbox')} accessibilityRole="button" accessibilityLabel={`${t('inbox')}, ${unread}`} style={{ paddingHorizontal: space.lg }}>
          <Ionicons name="notifications-outline" size={24} color={c.primary} />
          {unread > 0 && (
            <View style={[styles.dot, { backgroundColor: c.danger }]}>
              <Text style={styles.dotText}>{unread}</Text>
            </View>
          )}
        </Pressable>
      ),
    });
  }, [navigation, unread, c, t]);

  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const [me, wallet, inbox] = data!;
  const { summary, person } = me;
  const licence = wallet.find((w) => w.type === 'driver_licence');

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'card', label: t('showLicence'), onPress: () => licence && router.push(`/credential/${licence.id}`) },
    { icon: 'cash', label: t('payTicket'), onPress: () => router.push('/fines') },
    { icon: 'refresh-circle', label: t('renewPlate'), onPress: () => router.push('/vehicles') },
    { icon: 'grid', label: t('allServices'), onPress: () => router.push('/services') },
    { icon: 'create', label: t('signDocument'), onPress: () => router.push('/sign') },
    { icon: 'qr-code', label: t('verifyId'), onPress: () => router.push('/verify') },
  ];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Text style={[styles.hello, { color: c.text }]}>
        {t('hello')}, {person.givenNames.split(' ')[0]}
      </Text>

      <Card onPress={() => router.push('/fines')} style={summary.overdueFines ? { borderColor: c.danger, borderWidth: 1 } : undefined} accessibilityLabel={t('openTickets')}>
        <View style={styles.summaryRow}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: c.textMuted, fontWeight: '600' }}>{t('openTickets')}</Text>
            <Text style={[styles.big, { color: c.text }]}>{summary.openFines}</Text>
          </View>
          <View style={{ gap: 2, alignItems: 'flex-end' }}>
            <Text style={{ color: c.textMuted, fontWeight: '600' }}>{t('totalDue')}</Text>
            <Text style={[styles.big, { color: summary.overdueFines ? c.danger : c.text }]}>{money(summary.openFinesTotal, lang)}</Text>
          </View>
        </View>
        {summary.overdueFines > 0 && (
          <Text style={{ color: c.danger, fontWeight: '700' }}>
            {summary.overdueFines} {t('overdue')} · {t('blockedRenewal')}
          </Text>
        )}
      </Card>

      <SectionHeader>{t('quickActions')}</SectionHeader>
      <View style={styles.grid}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, { backgroundColor: c.surface, borderColor: c.border }, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name={a.icon} size={26} color={c.primary} />
            <Text style={{ color: c.text, fontWeight: '600', textAlign: 'center', fontSize: 13 }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader>{t('renewalsDue')}</SectionHeader>
      <Card>
        {summary.renewalsDue.length === 0 ? (
          <Text style={{ color: c.textMuted }}>{t('noRenewals')}</Text>
        ) : (
          summary.renewalsDue.map((r) => {
            const days = daysUntil(r.expiresOn);
            return (
              <ListItem
                key={r.id}
                icon={r.kind === 'plate' ? 'car' : 'id-card'}
                tone={days < 30 ? 'warning' : undefined}
                title={`${r.kind === 'plate' ? t('plate') : t(r.kind as 'health_card')} · ${r.label}`}
                subtitle={`${t('expires')} ${date(r.expiresOn, lang)} (${days} d)`}
                onPress={() => router.push(r.kind === 'plate' ? `/vehicle/${r.id}` : `/credential/${r.id}`)}
              />
            );
          })
        )}
      </Card>

      <SectionHeader action={<Text onPress={() => router.push('/inbox')} style={{ color: c.primary, fontWeight: '700' }}>{t('inbox')} →</Text>}>
        {t('inbox')}
      </SectionHeader>
      <Card>
        {inbox.slice(0, 3).map((m) => (
          <ListItem
            key={m.id}
            icon={m.read ? 'mail-open-outline' : 'mail-unread'}
            title={m.title}
            subtitle={m.body}
            onPress={() => router.push(m.link ? (m.link as never) : '/inbox')}
          />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 26, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  big: { fontSize: 28, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: {
    width: '31.5%',
    flexGrow: 1,
    aspectRatio: 1.15,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.sm,
  },
  dot: { position: 'absolute', top: -4, right: 10, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
