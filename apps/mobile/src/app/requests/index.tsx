import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Chip, ChipRow, RequestStatusBadge, useRequestStatusLabel } from '../../components/kit';
import { Card, Divider, Empty, ErrorState, ListItem, Loading, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { date } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { CATEGORY_ICON } from '../../lib/icons';
import { ORGANIZATIONS, serviceById, type RequestStatus } from '../../lib/shared/platform';
import { space } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

const FILTERS: (RequestStatus | 'all')[] = ['all', 'action_required', 'awaiting_payment', 'in_review', 'completed', 'cancelled'];

/** Every request across every organization, with its status (Sanad "My requests"). */
export default function Requests() {
  const { tr, pick, lang } = useI18n();
  const label = useRequestStatusLabel();
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all');
  const { data, error, loading, reload } = useAsync(api.serviceRequests);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const list = data!.filter((r) => filter === 'all' || r.status === filter);
  const byOrg = ORGANIZATIONS.map((o) => ({ o, n: data!.filter((r) => serviceById(r.serviceId)?.orgId === o.id).length })).filter((x) => x.n);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Txt v="callout" muted>
        {tr('Track requests across all organizations.', 'Suivez vos demandes auprès de tous les organismes.')}
      </Txt>
      {byOrg.length > 0 && (
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          {byOrg.map(({ o, n }) => (
            <View key={o.id} style={{ minWidth: 110 }}>
              <Txt v="title">{n}</Txt>
              <Txt v="caption" muted>
                {pick(o.name)}
              </Txt>
            </View>
          ))}
        </Card>
      )}
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f} label={f === 'all' ? tr('All', 'Toutes') : label(f)} on={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ChipRow>
      <Card style={{ paddingVertical: space.xs }}>
        {list.length === 0 ? (
          <Empty icon="file-tray-outline" text={tr('No requests here yet. When you apply for a service it appears here.', 'Aucune demande ici. Vos demandes de service apparaîtront ici.')} />
        ) : (
          list.map((r, i) => {
            const s = serviceById(r.serviceId);
            return (
              <View key={r.id}>
                {i > 0 && <Divider inset={52} />}
                <ListItem
                  icon={s ? CATEGORY_ICON[s.category] : 'document'}
                  tone={r.status === 'action_required' || r.status === 'awaiting_payment' ? 'warning' : r.status === 'completed' ? 'success' : undefined}
                  title={s ? pick(s.name) : r.serviceId}
                  subtitle={`${r.reference} · ${date(r.updatedAt, lang)}`}
                  right={<RequestStatusBadge status={r.status} />}
                  onPress={() => router.push(`/requests/${r.id}`)}
                />
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
