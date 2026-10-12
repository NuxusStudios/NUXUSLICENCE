import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAppointmentStatus } from '../../components/kit';
import { Badge, Button, Card, Divider, Empty, ErrorState, ListItem, Loading, Screen, Segmented } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { LOCATIONS, visitName } from '../../lib/shared/platform';
import { space } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Appointments() {
  const { tr, pick } = useI18n();
  const status = useAppointmentStatus();
  const [tab, setTab] = useState<'current' | 'past'>('current');
  const { data, error, loading, reload } = useAsync(api.appointments);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const current = data!.filter((a) => a.status === 'upcoming' || a.status === 'checked_in');
  const past = data!.filter((a) => a.status === 'completed' || a.status === 'cancelled').reverse();
  const list = tab === 'current' ? current : past;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Button title={tr('Book a new appointment', 'Prendre un nouveau rendez-vous')} icon="add" onPress={() => router.push('/appointments/book')} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'current', label: `${tr('Current', 'À venir')} (${current.length})` },
          { value: 'past', label: `${tr('Past', 'Passés')} (${past.length})` },
        ]}
      />
      <Card style={{ paddingVertical: space.xs }}>
        {list.length === 0 ? (
          <Empty icon="calendar-outline" text={tr('No appointments.', 'Aucun rendez-vous.')} />
        ) : (
          list.map((a, i) => {
            const loc = LOCATIONS.find((l) => l.id === a.locationId)!;
            const st = status(a);
            return (
              <View key={a.id}>
                {i > 0 && <Divider inset={52} />}
                <ListItem
                  icon="calendar"
                  title={`${a.date} · ${a.time}`}
                  subtitle={`${pick(visitName(a.serviceId))}\n${pick(loc.name)}`}
                  right={<Badge label={a.ticket ? a.ticket.number : st.label} tone={st.tone} />}
                  onPress={() => router.push(`/appointments/${a.id}`)}
                />
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
