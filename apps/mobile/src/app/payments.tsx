import { View } from 'react-native';
import { Badge, Card, Divider, Empty, ErrorState, ListItem, Loading, Screen } from '../components/ui';
import { api } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';
import { useAsync } from '../lib/useAsync';

const METHOD = { card: 'Card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', interac: 'Interac' } as const;

export default function Payments() {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(api.payments);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  if (!data!.length) return <Empty icon="receipt-outline" text="—" />;
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card style={{ paddingVertical: space.xs }}>
        {data!.map((p, i) => (
          <View key={p.id}>
            {i > 0 && <Divider inset={52} />}
            <ListItem
              icon={p.status === 'succeeded' ? 'checkmark' : 'close'}
              tone={p.status === 'succeeded' ? 'success' : 'danger'}
              title={`${money(p.amount, lang)} · ${METHOD[p.method]}`}
              subtitle={`${t('receipt')} ${p.receiptNumber}\n${dateTime(p.createdAt, lang)}`}
              right={<Badge label={p.status} tone={p.status === 'succeeded' ? 'success' : 'danger'} />}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
