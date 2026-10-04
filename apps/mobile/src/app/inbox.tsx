import { router } from 'expo-router';
import { Card, Divider, Empty, ErrorState, ListItem, Loading, Screen, type IconName } from '../components/ui';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { InboxMessage } from '../lib/types';
import { useAsync } from '../lib/useAsync';

const ICON: Record<InboxMessage['category'], IconName> = {
  fine: 'receipt',
  renewal: 'refresh-circle',
  service: 'checkmark-done',
  security: 'shield',
  general: 'mail',
};

export default function Inbox() {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(api.inbox);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  if (!data!.length) return <Empty icon="mail-outline" text={t('inboxEmpty')} />;

  async function open(m: InboxMessage) {
    if (!m.read) await api.markRead(m.id).catch(() => undefined);
    if (m.link) router.push(m.link as never);
    else void reload();
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card>
        {data!.map((m, i) => (
          <ListItemWrap key={m.id} first={i === 0}>
            <ListItem
              icon={ICON[m.category]}
              tone={m.read ? undefined : 'warning'}
              title={`${m.read ? '' : '● '}${m.title}`}
              subtitle={`${m.body}\n${dateTime(m.createdAt, lang)}`}
              onPress={() => void open(m)}
            />
          </ListItemWrap>
        ))}
      </Card>
    </Screen>
  );
}

function ListItemWrap({ first, children }: { first: boolean; children: React.ReactNode }) {
  return (
    <>
      {!first && <Divider />}
      {children}
    </>
  );
}
