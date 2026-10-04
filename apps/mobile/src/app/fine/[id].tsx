import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FINE_ICON, fineTone } from '../../components/FineRow';
import { Badge, Button, Card, Divider, ErrorState, Loading, Notice, Row, Screen, SectionHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { date, dateTime, money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { radius, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function FineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const { t, lang } = useI18n();
  const navigation = useNavigation();
  const { data, error, loading, reload } = useAsync(() => api.fine(id), id);

  useEffect(() => {
    if (data) navigation.setOptions({ title: t(data.source) });
  }, [data, navigation, t]);

  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const f = data!;
  const open = f.status === 'outstanding' || f.status === 'overdue';
  const isCamera = f.source === 'red_light_camera' || f.source === 'speed_camera';

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name={FINE_ICON[f.source]} size={28} color={c.primary} />
          <Text style={{ flex: 1, color: c.text, fontSize: 17, fontWeight: '700' }}>{f.offence}</Text>
        </View>
        <Badge label={f.status === 'overdue' ? t('overdue') : t(f.status)} tone={fineTone(f.status)} />
        <Text style={{ color: c.textMuted, fontSize: 13 }}>{f.statute}</Text>
      </Card>

      <Notice tone={f.liability === 'owner' ? 'info' : 'warning'}>
        {f.liability === 'owner' ? t('ownerLiability') : `${t('driverLiability')} ${t('demeritPoints')}: ${f.demeritPoints}`}
      </Notice>

      <Card>
        <Row label={t('ticketNumber')} value={f.externalId} />
        <Row label={t('occurred')} value={dateTime(f.occurredAt, lang)} />
        <Row label={t('location')} value={`${f.location}\n${f.municipality}`} />
        {f.plate && <Row label={t('plate')} value={f.plate} />}
        {open && <Row label={t('due')} value={date(f.dueDate, lang)} />}
      </Card>

      {isCamera && f.evidence && (
        <>
          <SectionHeader>{t('evidence')}</SectionHeader>
          <Card>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {f.evidence.images.map((img, i) => (
                <View
                  key={img}
                  accessibilityLabel={`${t('evidence')} ${i + 1}`}
                  style={{ flex: 1, aspectRatio: 4 / 3, borderRadius: radius.sm, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="image-outline" size={28} color={c.textMuted} />
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>{i + 1}/{f.evidence!.images.length}</Text>
                </View>
              ))}
            </View>
            {f.evidence.recordedSpeedKmh != null && <Row label={t('recordedSpeed')} value={`${f.evidence.recordedSpeedKmh} km/h`} />}
            {f.evidence.postedLimitKmh != null && <Row label={t('postedLimit')} value={`${f.evidence.postedLimitKmh} km/h`} />}
            {f.evidence.secondsIntoRed != null && <Row label={t('intoRed')} value={`${f.evidence.secondsIntoRed.toFixed(1)} s`} />}
          </Card>
        </>
      )}

      <Card>
        <Row label={t('setFine')} value={money(f.setFine, lang)} />
        {f.victimFineSurcharge > 0 && <Row label={t('surcharge')} value={money(f.victimFineSurcharge, lang)} />}
        {f.courtCosts > 0 && <Row label={t('courtCosts')} value={money(f.courtCosts, lang)} />}
        <Divider />
        <Row label={t('total')} value={money(f.total, lang)} strong />
      </Card>

      {f.payment && (
        <Notice tone="success">
          {t('receipt')} {f.payment.receiptNumber} · {money(f.payment.amount, lang)} · {date(f.payment.createdAt, lang)}
        </Notice>
      )}
      {f.dispute && (
        <Notice tone="info">
          {f.dispute.option === 'trial' ? t('trial') : t('earlyResolution')} · {t('reference')} {f.dispute.reference}
        </Notice>
      )}

      {open && (
        <View style={{ gap: space.sm }}>
          <Button
            title={`${t('payNow')} · ${money(f.total, lang)}`}
            icon="card"
            onPress={() => router.push({ pathname: '/pay', params: { kind: 'fine', id: f.id, amount: String(f.total), label: `${t(f.source)} ${f.externalId}` } })}
          />
          {f.status === 'outstanding' && <Button title={t('dispute')} variant="secondary" icon="hammer" onPress={() => router.push(`/dispute/${f.id}`)} />}
        </View>
      )}
    </Screen>
  );
}
