import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Divider, Empty, ErrorState, ListItem, Loading, Screen, Segmented, Txt, type IconName } from '../components/ui';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';
import type { InboxMessage } from '../lib/types';
import { useAsync } from '../lib/useAsync';

const ICON: Record<InboxMessage['category'], IconName> = {
  fine: 'receipt',
  renewal: 'refresh-circle',
  service: 'checkmark-done',
  security: 'shield-checkmark',
  general: 'mail',
};

export default function Inbox() {
  const { t, tr, lang } = useI18n();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [prompt, setPrompt] = useState(true);
  const { data, error, loading, reload } = useAsync(api.inbox);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  if (!data!.length) return <Empty icon="mail-outline" text={t('inboxEmpty')} />;
  const unread = data!.filter((m) => !m.read).length;
  const list = tab === 'unread' ? data!.filter((m) => !m.read) : data!;

  async function open(m: InboxMessage) {
    if (!m.read) await api.markRead(m.id).catch(() => undefined);
    if (m.link) router.push(m.link as never);
    else void reload();
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {prompt && (
        <Card style={{ gap: space.sm }}>
          <Txt v="headline">{tr('Get reminders before documents expire', 'Recevez un rappel avant l’expiration de vos documents')}</Txt>
          <Txt v="callout" muted>
            {tr('Notifications also tell you about new tickets and request updates. Choose which in Account → Notifications.', 'Les notifications signalent aussi les nouvelles contraventions et le suivi des demandes. Choisissez sous Compte → Notifications.')}
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title={tr('Settings', 'Réglages')} size="md" icon="notifications" onPress={() => router.push('/notifications')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={tr('Not now', 'Plus tard')} size="md" variant="secondary" onPress={() => setPrompt(false)} />
            </View>
          </View>
        </Card>
      )}
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: `${tr('All', 'Tous')} (${data!.length})` },
          { value: 'unread', label: `${tr('Unread', 'Non lus')} (${unread})` },
        ]}
      />
      {unread > 0 && (
        <Button
          title={tr('Mark all as read', 'Tout marquer comme lu')}
          variant="ghost"
          size="md"
          icon="checkmark-done"
          onPress={async () => {
            await api.markAllRead();
            await reload();
          }}
        />
      )}
      <Card style={{ paddingVertical: space.xs }}>
        {list.length === 0 && <Empty icon="checkmark-done" text={tr('You’re all caught up.', 'Vous êtes à jour.')} />}
        {list.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Divider inset={52} />}
            <ListItem
              icon={ICON[m.category]}
              tone={m.read ? undefined : 'warning'}
              title={`${m.read ? '' : '● '}${m.title}`}
              subtitle={`${m.body}\n${dateTime(m.createdAt, lang)}`}
              onPress={() => void open(m)}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
