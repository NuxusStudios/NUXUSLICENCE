import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Card, Divider, ErrorState, ListItem, Loading, Screen, SectionHeader, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/i18n';
import { space } from '../../lib/theme';
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
      {requests.length > 0 && (
        <>
          <SectionHeader>{t('myRequests')}</SectionHeader>
          <Card style={{ paddingVertical: space.xs }}>
            {requests.map((r, i) => {
              const s = services.find((x) => x.id === r.serviceId);
              return (
                <View key={r.id}>
                  {i > 0 && <Divider inset={52} />}
                  <ListItem
                    icon={r.status === 'completed' ? 'checkmark-done' : 'time'}
                    tone={r.status === 'completed' ? 'success' : undefined}
                    title={s ? pick(s.name) : r.serviceId}
                    subtitle={`${t('reference')} ${r.reference} · ${date(r.createdAt, lang)}`}
                    right={<Badge label={r.status} tone={r.status === 'completed' ? 'success' : 'info'} />}
                  />
                </View>
              );
            })}
          </Card>
        </>
      )}

      {categories.map((cat) => (
        <View key={cat} style={{ gap: space.lg }}>
          <SectionHeader>{t(`category_${cat}` as TKey)}</SectionHeader>
          <Card style={{ paddingVertical: space.xs }}>
            {services
              .filter((s) => s.category === cat)
              .map((s, i) => (
                <View key={s.id}>
                  {i > 0 && <Divider inset={52} />}
                  <ListItem
                    icon={CATEGORY_ICON[cat]}
                    title={pick(s.name)}
                    subtitle={pick(s.description)}
                    right={<Badge label={s.fee ? money(s.fee, lang) : t('free')} tone={s.fee ? 'neutral' : 'success'} />}
                    onPress={() => router.push(`/services/${s.id}`)}
                  />
                </View>
              ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
