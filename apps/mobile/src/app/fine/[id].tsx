import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FINE_ICON, fineTone } from '../../components/FineRow';
import { Badge, Button, Card, ErrorState, IconTile, Loading, Notice, Row, Screen, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { date, dateTime, money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { fonts, radius, space, useTheme } from '../../lib/theme';
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
  const tone = f.status === 'overdue' ? 'danger' : open ? 'warning' : f.status === 'paid' ? 'success' : undefined;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {/* Hero: what it is, what it costs, by when */}
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconTile icon={FINE_ICON[f.source]} tone={tone} size={46} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="label" muted>
              {t(f.source)}
            </Txt>
            <Txt v="caption" faint style={{ fontFamily: fonts.mono }} numberOfLines={1} ellipsizeMode="middle">
              {f.externalId}
            </Txt>
          </View>
          <Badge label={f.status === 'overdue' ? t('overdue') : t(f.status)} tone={fineTone(f.status)} />
        </View>
        <Txt v="headline">{f.offence}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Text style={[styles.amount, { color: f.status === 'overdue' ? c.danger : c.text }]}>{money(f.total, lang)}</Text>
          {open && (
            <View style={{ alignItems: 'flex-end' }}>
              <Txt v="caption" muted>
                {t('due')}
              </Txt>
              <Txt v="strong" color={f.status === 'overdue' ? c.danger : c.text}>
                {date(f.dueDate, lang)}
              </Txt>
            </View>
          )}
        </View>
        <Txt v="caption" faint>
          {f.statute}
        </Txt>
      </Card>

      <Notice tone={f.liability === 'owner' ? 'info' : 'warning'}>
        {f.liability === 'owner' ? t('ownerLiability') : `${t('driverLiability')} ${t('demeritPoints')}: ${f.demeritPoints}`}
      </Notice>

      {open && (
        <View style={{ gap: space.sm }}>
          <Button
            title={`${t('payNow')} · ${money(f.total, lang)}`}
            icon="card"
            onPress={() => router.push({ pathname: '/pay', params: { kind: 'fine', id: f.id, amount: String(f.total), label: `${t(f.source)} ${f.externalId}` } })}
          />
          {f.status === 'outstanding' && <Button title={t('dispute')} variant="secondary" icon="hammer-outline" onPress={() => router.push(`/dispute/${f.id}`)} />}
        </View>
      )}

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

      <SectionHeader>{t('location')}</SectionHeader>
      <Card style={{ paddingVertical: space.md }}>
        <Row label={t('occurred')} value={dateTime(f.occurredAt, lang)} />
        <Row label={t('location')} value={`${f.location}\n${f.municipality}`} />
        {f.plate && <Row label={t('plate')} value={f.plate} mono />}
      </Card>

      {isCamera && f.evidence && (
        <>
          <SectionHeader>{t('evidence')}</SectionHeader>
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {f.evidence.images.map((img, i) => (
                <EvidenceFrame key={img} index={i} count={f.evidence!.images.length} at={f.occurredAt} plate={f.plate} label={t('evidence')} />
              ))}
            </View>
            <View>
              {f.evidence.recordedSpeedKmh != null && <Row label={t('recordedSpeed')} value={`${f.evidence.recordedSpeedKmh} km/h`} />}
              {f.evidence.postedLimitKmh != null && <Row label={t('postedLimit')} value={`${f.evidence.postedLimitKmh} km/h`} />}
              {f.evidence.secondsIntoRed != null && <Row label={t('intoRed')} value={`${f.evidence.secondsIntoRed.toFixed(1)} s`} />}
            </View>
          </Card>
        </>
      )}

      <SectionHeader>{t('total')}</SectionHeader>
      <Card style={{ paddingVertical: space.md }}>
        <Row label={t('setFine')} value={money(f.setFine, lang)} />
        {f.victimFineSurcharge > 0 && <Row label={t('surcharge')} value={money(f.victimFineSurcharge, lang)} />}
        {f.courtCosts > 0 && <Row label={t('courtCosts')} value={money(f.courtCosts, lang)} />}
        <View style={[styles.dashed, { borderColor: c.border }]} />
        <Row label={t('total')} value={money(f.total, lang)} strong />
      </Card>
    </Screen>
  );
}

/** Placeholder for an enforcement-camera still, with the data strip cameras burn into the frame. */
function EvidenceFrame({ index, count, at, plate, label }: { index: number; count: number; at: string; plate?: string; label: string }) {
  const stamp = new Date(new Date(at).getTime() + index * 1200).toISOString().replace('T', ' ').slice(0, 19);
  return (
    <View style={styles.frame} accessibilityLabel={`${label} ${index + 1}/${count}`}>
      {/* Corner brackets */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
        <View key={k} style={[styles.corner, styles[k]]} />
      ))}
      <Ionicons name="car-sport" size={30} color="rgba(255,255,255,0.35)" />
      <View style={styles.strip}>
        <Text style={styles.stripText} numberOfLines={1}>
          {stamp}
        </Text>
        <Text style={styles.stripText}>
          {index + 1}/{count}
          {plate ? ` · ${plate}` : ''}
        </Text>
      </View>
    </View>
  );
}

const C = 'rgba(255,255,255,0.55)';
const styles = StyleSheet.create({
  amount: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  dashed: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: space.sm },
  frame: { flex: 1, aspectRatio: 4 / 3, borderRadius: radius.sm, backgroundColor: '#1B2330', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  corner: { position: 'absolute', width: 12, height: 12, borderColor: C },
  tl: { top: 8, left: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  tr: { top: 8, right: 8, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  bl: { bottom: 26, left: 8, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  br: { bottom: 26, right: 8, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  strip: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  stripText: { color: '#E8EEF4', fontFamily: fonts.mono, fontSize: 8.5 },
});
