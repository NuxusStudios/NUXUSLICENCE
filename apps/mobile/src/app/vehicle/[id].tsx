import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { FineRow } from '../../components/FineRow';
import { Badge, Button, Card, Divider, Empty, ErrorState, Loading, Notice, Row, Screen, Segmented, SectionHeader, Txt } from '../../components/ui';
import { Plate } from '../../components/Plate';
import { api, ApiError } from '../../lib/api';
import { date, daysUntil } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { space } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const navigation = useNavigation();
  const { data, error, loading, reload } = useAsync(() => api.vehicle(id), id);
  const [years, setYears] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; text: string }>();

  useEffect(() => {
    if (data) navigation.setOptions({ title: data.plate });
  }, [data, navigation]);

  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const v = data!;
  const days = daysUntil(v.plateValidationExpires);

  async function renew() {
    setBusy(true);
    setResult(undefined);
    try {
      const res = await api.renewPlate(v.id, { years });
      setResult({ tone: 'success', text: `${t('renewed')}: ${date(res.vehicle.plateValidationExpires, lang)}` });
      await reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'payment_required') {
        // A jurisdiction that charges for renewal routes through the payment sheet.
        router.push({ pathname: '/pay', params: { kind: 'plate', id: v.id, years: String(years), label: `${t('renewPlate')} · ${v.plate}` } });
      } else {
        setResult({ tone: 'danger', text: (e as Error).message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card style={{ gap: space.md }}>
        <Plate plate={v.plate} jurisdiction={v.jurisdiction} size="lg" />
        <View style={{ gap: 2 }}>
          <Txt v="title">
            {v.year} {v.make} {v.model}
          </Txt>
          <Txt v="callout" muted>
            {v.colour}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="caption" muted>
            {t('plateValidUntil')} {date(v.plateValidationExpires, lang)}
          </Txt>
          <Badge label={`${days} d`} tone={days < 30 ? 'warning' : 'success'} />
        </View>
      </Card>

      <Card style={{ paddingVertical: space.md }}>
        <Row label={t('vin')} value={v.vin} mono />
        <Row label={t('insurance')} value={`${v.insurance.provider}\n${t('policy')} ${v.insurance.policyNumber}`} />
        <Row label={t('expires')} value={date(v.insurance.expiresOn, lang)} />
      </Card>

      <SectionHeader>{t('renewPlate')}</SectionHeader>
      <Card style={{ gap: space.md }}>
        <Txt v="caption" muted>
          {t('renewFor')}
        </Txt>
        <Segmented
          value={years}
          onChange={setYears}
          options={[
            { value: 1, label: t('year1') },
            { value: 2, label: t('years2') },
          ]}
        />
        <Notice tone="info">{t('renewalFree')}</Notice>
        {result && <Notice tone={result.tone}>{result.text}</Notice>}
        <Button title={t('renewPlate')} icon="refresh-circle" onPress={renew} loading={busy} />
      </Card>

      <SectionHeader>{t('ticketsOnVehicle')}</SectionHeader>
      <Card style={{ paddingVertical: space.xs }}>
        {v.fines.length ? (
          v.fines.map((f, i) => (
            <View key={f.id}>
              {i > 0 && <Divider inset={52} />}
              <FineRow fine={f} />
            </View>
          ))
        ) : (
          <Empty icon="checkmark-done" text={t('noTickets')} />
        )}
      </Card>
    </Screen>
  );
}
