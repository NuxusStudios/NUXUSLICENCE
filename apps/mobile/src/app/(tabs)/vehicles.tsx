import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Plate } from '../../components/Plate';
import { Badge, Card, Empty, ErrorState, Loading, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { date, daysUntil } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { radius, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Vehicles() {
  const c = useTheme();
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(api.vehicles);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <Screen refreshing={loading} onRefresh={reload} title={t('tabVehicles')} subtitle={t('vehiclesTitle')}>
      {data!.length === 0 && <Empty icon="car-outline" text="—" />}
      {data!.map((v) => {
        const days = daysUntil(v.plateValidationExpires);
        // Share of the yearly validation period remaining, for the meter.
        const left = Math.max(0, Math.min(1, days / 365));
        const tone = days < 30 ? c.warning : c.success;
        return (
          <Card key={v.id} onPress={() => router.push(`/vehicle/${v.id}`)} accessibilityLabel={`${v.plate}, ${v.year} ${v.make} ${v.model}`}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ gap: space.sm, flex: 1 }}>
                <Plate plate={v.plate} jurisdiction={v.jurisdiction} />
                <Txt v="headline">
                  {v.year} {v.make} {v.model}
                </Txt>
                <Txt v="caption" muted>
                  {v.colour} · {t('vin')} {v.vin}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
            </View>
            <View style={{ gap: 6, marginTop: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt v="caption" muted>
                  {t('plateValidUntil')} {date(v.plateValidationExpires, lang)}
                </Txt>
                <Badge label={`${days} d`} tone={days < 30 ? 'warning' : 'success'} />
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(3, left * 100)}%`, height: '100%', borderRadius: radius.sm, backgroundColor: tone }} />
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
