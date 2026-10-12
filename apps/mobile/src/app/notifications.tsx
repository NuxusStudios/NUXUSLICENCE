import { Switch, View } from 'react-native';
import { Card, Divider, ErrorState, ListItem, Loading, Screen, Txt } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { Preferences } from '../lib/types';
import { space, useTheme } from '../lib/theme';
import { useAsync } from '../lib/useAsync';

export default function Notifications() {
  const c = useTheme();
  const { tr } = useI18n();
  const { data, error, loading, reload } = useAsync(api.preferences);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const n = data!.notifications;
  const set = async (k: keyof Preferences['notifications'], v: boolean) => {
    await api.savePreferences({ notifications: { ...n, [k]: v } });
    await reload();
  };
  const rows: [keyof Preferences['notifications'], string, string][] = [
    ['renewals', tr('Renewal reminders', 'Rappels de renouvellement'), tr('60, 30 and 7 days before a document or plate expires', '60, 30 et 7 jours avant l’expiration d’un document ou d’une plaque')],
    ['tickets', tr('New tickets', 'Nouvelles contraventions'), tr('When a camera or officer ticket is linked to you', 'Quand une contravention de caméra ou d’agent vous est liée')],
    ['requests', tr('Request updates', 'Suivi des demandes'), tr('Status changes, payments and appointments', 'Changements de statut, paiements et rendez-vous')],
  ];
  return (
    <Screen>
      <Card style={{ paddingVertical: space.xs }}>
        {rows.map(([k, title, sub], i) => (
          <View key={k}>
            {i > 0 && <Divider inset={52} />}
            <ListItem icon="notifications" title={title} subtitle={sub} right={<Switch value={n[k]} onValueChange={(v) => void set(k, v)} trackColor={{ true: c.success }} accessibilityLabel={title} />} />
          </View>
        ))}
      </Card>
      <Txt v="caption" muted>
        {tr('Legal notices (such as tickets) are still mailed to you.', 'Les avis légaux (comme les contraventions) vous sont quand même postés.')}
      </Txt>
    </Screen>
  );
}
