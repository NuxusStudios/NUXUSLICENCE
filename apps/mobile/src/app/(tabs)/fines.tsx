import { useState } from 'react';
import { View } from 'react-native';
import { FineRow } from '../../components/FineRow';
import { Button, Card, Empty, ErrorState, Loading, Notice, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { space } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Fines() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const { data, error, loading, reload } = useAsync(api.fines);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const open = data!.filter((f) => f.status === 'outstanding' || f.status === 'overdue');
  const shown = filter === 'open' ? open : data!;
  const overdue = open.some((f) => f.status === 'overdue');

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button title={`${t('filterOpen')} (${open.length})`} variant={filter === 'open' ? 'primary' : 'secondary'} onPress={() => setFilter('open')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={`${t('filterAll')} (${data!.length})`} variant={filter === 'all' ? 'primary' : 'secondary'} onPress={() => setFilter('all')} />
        </View>
      </View>
      {overdue && <Notice tone="danger">{t('blockedRenewal')}</Notice>}
      <Card>{shown.length ? shown.map((f) => <FineRow key={f.id} fine={f} />) : <Empty icon="happy-outline" text={t('noFines')} />}</Card>
    </Screen>
  );
}
