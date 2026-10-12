import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Chip, ChipRow } from '../components/kit';
import { Badge, Card, Divider, Empty, ErrorState, ListItem, Loading, Screen, Txt } from '../components/ui';
import { api } from '../lib/api';
import { METHOD, dateTime, money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';
import { useAsync } from '../lib/useAsync';


/** Payment history (Sanad: every transaction with status, amount and service). */
export default function Payments() {
  const { tr, lang } = useI18n();
  const [filter, setFilter] = useState<'all' | 'succeeded' | 'failed'>('all');
  const { data, error, loading, reload } = useAsync(api.payments);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const list = data!.filter((p) => filter === 'all' || p.status === filter);
  const total = data!.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card>
        <Txt v="label" muted>
          {tr('Paid through the app', 'Payé dans l’application')}
        </Txt>
        <Txt v="title">{money(total, lang)}</Txt>
      </Card>
      <ChipRow>
        <Chip label={tr('All', 'Tous')} on={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={tr('Successful', 'Réussis')} on={filter === 'succeeded'} onPress={() => setFilter('succeeded')} />
        <Chip label={tr('Failed', 'Échoués')} on={filter === 'failed'} onPress={() => setFilter('failed')} />
      </ChipRow>
      <Card style={{ paddingVertical: space.xs }}>
        {list.length === 0 ? (
          <Empty icon="receipt-outline" text={tr('No payments yet.', 'Aucun paiement.')} />
        ) : (
          list.map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider inset={52} />}
              <ListItem
                icon={p.status === 'succeeded' ? 'checkmark' : 'close'}
                tone={p.status === 'succeeded' ? 'success' : 'danger'}
                title={p.label ?? money(p.amount, lang)}
                subtitle={`${money(p.amount, lang)} · ${METHOD[p.method]}\n${dateTime(p.createdAt, lang)}`}
                right={<Badge label={p.status === 'succeeded' ? tr('Successful', 'Réussi') : tr('Failed', 'Échoué')} tone={p.status === 'succeeded' ? 'success' : 'danger'} />}
                onPress={() => router.push(`/payment/${p.id}`)}
              />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
