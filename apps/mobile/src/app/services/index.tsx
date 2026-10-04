import { router } from 'expo-router';
import { Badge, Card, ErrorState, ListItem, Loading, Screen, SectionHeader, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/i18n';
import type { ServiceDefinition } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

const CATEGORY_ICON: Record<ServiceDefinition['category'], IconName> = {
  driver: 'car-sport',
  vehicle: 'car',
  identity: 'home',
  health: 'medkit',
  records: 'document-text',
};

export default function Services() {
  const { t, pick, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.services(), api.serviceRequests()]));
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const [services, requests] = data!;
  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {categories.map((cat) => (
        <Card key={cat}>
          <SectionHeader>{t(`category_${cat}` as TKey)}</SectionHeader>
          {services
            .filter((s) => s.category === cat)
            .map((s) => (
              <ListItem
                key={s.id}
                icon={CATEGORY_ICON[cat]}
                title={pick(s.name)}
                subtitle={pick(s.description)}
                right={<Badge label={s.fee ? money(s.fee, lang) : t('free')} tone={s.fee ? 'neutral' : 'success'} />}
                onPress={() => router.push(`/services/${s.id}`)}
              />
            ))}
        </Card>
      ))}

      {requests.length > 0 && (
        <Card>
          <SectionHeader>{t('myRequests')}</SectionHeader>
          {requests.map((r) => {
            const s = services.find((x) => x.id === r.serviceId);
            return (
              <ListItem
                key={r.id}
                icon="time-outline"
                title={s ? pick(s.name) : r.serviceId}
                subtitle={`${t('reference')} ${r.reference} · ${date(r.createdAt, lang)}`}
                right={<Badge label={r.status} tone={r.status === 'completed' ? 'success' : 'info'} />}
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
