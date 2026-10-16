import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fineTone } from '../../components/FineRow';
import { OffenceNotice } from '../../components/OffenceNotice';
import { Badge, Button, Card, Divider, ErrorState, Loading, Notice, Row, Screen, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { PARKING_STAGE_LABEL, PARKING_STAGE_TONE, canRequestScreening, parkingStageMessage } from '../../lib/shared/parking';
import { fonts, radius, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function FineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const { t, tr, pick, lang } = useI18n();
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
  const isParking = f.source === 'parking';
  const payAmount = f.amountDue ?? f.total;
  const screeningOpen = isParking && f.parking ? canRequestScreening(f.parking) : false;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Badge label={f.status === 'overdue' ? t('overdue') : t(f.status)} tone={fineTone(f.status)} />
        {open && (
          <Txt v="caption" muted>
            {isParking ? tr('Screening review by', 'Révision avant le') : t('respondBy')} {date(f.dueDate, lang)}
          </Txt>
        )}
      </View>

      <OffenceNotice fine={f} />

      {/* APS timeline for parking penalties. */}
      {isParking && f.parking && (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt v="label" muted>
              {tr('Penalty notice #', 'Avis de pénalité nº')}
            </Txt>
            <Txt v="mono" style={{ fontSize: 13 }}>
              {f.parking.penaltyNoticeNumber}
            </Txt>
          </View>
          <Divider />
          {f.parkingStage && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <Badge label={pick(PARKING_STAGE_LABEL[f.parkingStage])} tone={PARKING_STAGE_TONE[f.parkingStage]} />
              <Txt v="caption" muted style={{ flex: 1 }}>
                {pick(parkingStageMessage(f.parking))}
              </Txt>
            </View>
          )}
          <Row label={tr('Early-payment amount', 'Montant du paiement anticipé')} value={`${money(f.parking.earlyAmount, lang)} · ${tr('by', 'avant le')} ${date(f.parking.earlyPaymentUntil, lang)}`} />
          <Row label={tr('Set fine (after)', 'Amende fixée (après)')} value={money(f.parking.setFine, lang)} />
          <Row label={tr('Screening review by', 'Révision avant le')} value={date(f.parking.screeningReviewBy, lang)} />
        </Card>
      )}

      <Notice tone={f.liability === 'owner' ? 'info' : 'warning'}>
        {f.liability === 'owner' ? t('ownerLiability') : `${t('driverLiability')} ${t('demeritPoints')}: ${f.demeritPoints}`}
      </Notice>

      {f.payment && (
        <Notice tone="success">
          {t('receipt')} {f.payment.receiptNumber} · {money(f.payment.amount, lang)} · {date(f.payment.createdAt, lang)}
        </Notice>
      )}
      {f.dispute && (
        <Notice tone="info">
          {t('reference')} {f.dispute.reference}
        </Notice>
      )}

      {open && (
        <>
          <SectionHeader>{isParking ? tr('Pay or respond', 'Payer ou répondre') : t('disputeTitle')}</SectionHeader>
          <Card style={{ gap: space.md }}>
            <OptionHead n={1} title={t('option1Title')} body={isParking ? tr('Pay the amount shown for this stage.', 'Payez le montant indiqué pour cette étape.') : t('option1Body')} />
            {isParking && f.parkingStage === 'early_payment' && (
              <Txt v="caption" color={c.success}>
                {tr('Early-payment amount — pay before the discount ends.', 'Montant anticipé — payez avant la fin du rabais.')}
              </Txt>
            )}
            <Button
              title={`${t('payNow')} · ${money(payAmount, lang)}`}
              icon="card"
              onPress={() => router.push({ pathname: '/pay', params: { kind: 'fine', id: f.id, amount: String(payAmount), label: `${t(f.source)} ${f.externalId}` } })}
            />
          </Card>

          {isParking
            ? screeningOpen &&
              f.status !== 'disputed' && (
                <Card style={{ gap: space.md }}>
                  <OptionHead n={2} title={tr('Dispute this penalty', 'Contester cette pénalité')} body={tr('Request a screening review (within 45 days), then a hearing if needed.', 'Demandez une révision (dans les 45 jours), puis une audience au besoin.')} />
                  <Button title={tr('Request a screening review', 'Demander une révision')} variant="secondary" size="md" icon="search-outline" onPress={() => router.push({ pathname: '/dispute/[id]', params: { id: f.id, option: 'screening_review', source: f.source } })} />
                </Card>
              )
            : f.status === 'outstanding' && (
                <>
                  <Card style={{ gap: space.md }}>
                    <OptionHead n={2} title={t('earlyResolution')} body={t('earlyResolutionBody')} />
                    <Button title={t('requestMeeting')} variant="secondary" size="md" icon="people-outline" onPress={() => router.push({ pathname: '/dispute/[id]', params: { id: f.id, option: 'early_resolution', source: f.source } })} />
                  </Card>
                  <Card style={{ gap: space.md }}>
                    <OptionHead n={3} title={t('trial')} body={t('trialBody')} />
                    <Button title={t('trial')} variant="secondary" size="md" icon="hammer-outline" onPress={() => router.push({ pathname: '/dispute/[id]', params: { id: f.id, option: 'trial', source: f.source } })} />
                  </Card>
                </>
              )}
        </>
      )}

      {isCamera && f.evidence && (
        <>
          <SectionHeader>{t('evidence')}</SectionHeader>
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {f.evidence.images.map((img, i) => (
                <EvidenceFrame key={img} index={i} count={f.evidence!.images.length} at={f.occurredAt} label={t('evidence')} />
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

    </Screen>
  );
}

function OptionHead({ n, title, body }: { n: number; title: string; body: string }) {
  const c = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <View style={[styles.optionNo, { backgroundColor: c.primarySoft }]}>
        <Text style={[styles.optionNoText, { color: c.accent }]}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt v="label" color={c.accent}>
          {t('optionN').replace('{n}', String(n))}
        </Txt>
        <Txt v="strong">{title}</Txt>
        <Txt v="caption" muted>
          {body}
        </Txt>
      </View>
    </View>
  );
}

/** Placeholder for an enforcement-camera still, with the data strip cameras burn into the frame. */
function EvidenceFrame({ index, count, at, label }: { index: number; count: number; at: string; label: string }) {
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
          {stamp.slice(11)}
        </Text>
        <Text style={styles.stripText} numberOfLines={1}>
          {index + 1}/{count}
        </Text>
      </View>
    </View>
  );
}

const C = 'rgba(255,255,255,0.55)';
const styles = StyleSheet.create({
  optionNo: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optionNoText: { fontFamily: fonts.extrabold, fontSize: 15 },
  frame: { flex: 1, aspectRatio: 4 / 3, borderRadius: radius.sm, backgroundColor: '#1B2330', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  corner: { position: 'absolute', width: 12, height: 12, borderColor: C },
  tl: { top: 8, left: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  tr: { top: 8, right: 8, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  bl: { bottom: 26, left: 8, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  br: { bottom: 26, right: 8, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  strip: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  stripText: { color: '#E8EEF4', fontFamily: fonts.mono, fontSize: 8.5 },
});
