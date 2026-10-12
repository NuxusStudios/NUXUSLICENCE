import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { FineRow } from '../../components/FineRow';
import { Chip, ChipRow } from '../../components/kit';
import { Body, Button, Card, Divider, Empty, ErrorState, IconTile, Loading, Notice, Screen, Segmented, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { DEMO_MODE } from '../../lib/config';
import { money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Fines() {
  const c = useTheme();
  const { t, lang, tr } = useI18n();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [plate, setPlate] = useState<string>('all');
  const { data, error, loading, reload } = useAsync(api.fines);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const open = data!.filter((f) => f.status === 'outstanding' || f.status === 'overdue');
  const plates = [...new Set(data!.map((f) => f.plate ?? 'driver'))];
  const shown = (filter === 'open' ? open : data!).filter((f) => plate === 'all' || (f.plate ?? 'driver') === plate);
  const overdue = open.some((f) => f.status === 'overdue');
  const due = open.reduce((s, f) => s + f.total, 0);

  return (
    <Screen refreshing={loading} onRefresh={reload} title={t('tabFines')} subtitle={`${t('totalDue')} · ${money(due, lang)}`}>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: `${t('filterOpen')} (${open.length})` },
          { value: 'all', label: `${t('filterAll')} (${data!.length})` },
        ]}
      />
      {plates.length > 1 && (
        <ChipRow>
          <Chip label={tr('All', 'Toutes')} on={plate === 'all'} onPress={() => setPlate('all')} />
          {plates.map((p) => (
            <Chip key={p} label={p === 'driver' ? tr('Issued to me', 'À mon nom') : p} icon={p === 'driver' ? 'person' : 'car'} on={plate === p} onPress={() => setPlate(p)} />
          ))}
        </ChipRow>
      )}
      {overdue && <Notice tone="danger">{t('blockedRenewal')}</Notice>}
      {open.length > 1 && (
        <Button
          title={`${tr('Pay all', 'Tout payer')} · ${money(due, lang)}`}
          icon="flash"
          onPress={() => router.push({ pathname: '/pay', params: { kind: 'all-fines', id: 'all', amount: String(due), label: tr(`${open.length} tickets`, `${open.length} contraventions`) } })}
        />
      )}
      <Card style={{ paddingVertical: space.xs }}>
        {shown.length ? (
          shown.map((f, i) => (
            <View key={f.id}>
              {i > 0 && <Divider inset={52} />}
              <FineRow fine={f} />
            </View>
          ))
        ) : (
          <Empty icon="checkmark-done" text={t('noFines')} />
        )}
      </Card>
      {DEMO_MODE && <SimulateTicket onCreated={reload} accent={c.accent} />}
    </Screen>
  );
}

function SimulateTicket({ onCreated }: { onCreated: () => Promise<void>; accent: string }) {
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
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <IconTile icon="videocam" />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="strong">{t('simulateTicket')}</Txt>
            <Body muted style={{ fontSize: 14, lineHeight: 20 }}>
              {t('simulateTicketBody')}
            </Body>
          </View>
        </View>
        {created && (
          <Notice tone="success">
            {t('simulatedTicket')} {created.plate}
          </Notice>
        )}
        {created && <Button title={t('viewTicket')} variant="secondary" size="md" onPress={() => router.push(`/fine/${created.fineId}`)} />}
        <Button title={t('simulateTicket')} icon="videocam" onPress={simulate} loading={busy} />
      </Card>
    </>
  );
}
