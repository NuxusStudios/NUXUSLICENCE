import { router } from 'expo-router';
import { Badge, Card, Empty, ErrorState, ListItem, Loading, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { date, daysUntil } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useAsync } from '../../lib/useAsync';

export default function Vehicles() {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(api.vehicles);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  if (data!.length === 0) return <Empty icon="car-outline" text="—" />;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {data!.map((v) => {
        const days = daysUntil(v.plateValidationExpires);
        return (
          <Card key={v.id}>
            <ListItem
              icon="car-sport"
              title={`${v.plate} · ${v.year} ${v.make} ${v.model}`}
              subtitle={`${t('plateValidUntil')} ${date(v.plateValidationExpires, lang)}`}
              right={days < 60 ? <Badge label={`${days} d`} tone={days < 30 ? 'warning' : 'info'} /> : undefined}
              onPress={() => router.push(`/vehicle/${v.id}`)}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
