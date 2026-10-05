import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { FineRow } from '../../components/FineRow';
import { Body, Button, Card, Empty, ErrorState, Loading, Notice, Screen, SectionHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { DEMO_MODE } from '../../lib/config';
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
      {DEMO_MODE && <SimulateTicket onCreated={reload} />}
    </Screen>
  );
}

function SimulateTicket({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ fineId: string; plate: string }>();

  async function simulate() {
    setBusy(true);
    try {
      setCreated(await api.simulateCameraTicket());
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeader>{t('demoTools')}</SectionHeader>
      <Card>
        <Body muted>{t('simulateTicketBody')}</Body>
        {created && (
          <Notice tone="success">
            {t('simulatedTicket')} {created.plate}
          </Notice>
        )}
        {created && <Button title={t('viewTicket')} variant="secondary" onPress={() => router.push(`/fine/${created.fineId}`)} />}
        <Button title={t('simulateTicket')} icon="videocam" onPress={simulate} loading={busy} />
      </Card>
    </>
  );
}
