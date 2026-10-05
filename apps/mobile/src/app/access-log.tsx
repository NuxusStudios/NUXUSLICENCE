import { View } from 'react-native';
import { Card, Divider, Empty, ErrorState, ListItem, Loading, Screen } from '../components/ui';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';
import { useAsync } from '../lib/useAsync';

/** Transparency: every time someone verified one of your documents. */
export default function AccessLog() {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(api.accessLog);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  if (!data!.length) return <Empty icon="eye-off-outline" text={t('accessLogEmpty')} />;
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card style={{ paddingVertical: space.xs }}>
        {data!.map((e, i) => (
          <View key={e.id}>
            {i > 0 && <Divider inset={52} />}
            <ListItem icon="eye" title={e.verifier} subtitle={`${dateTime(e.verifiedAt, lang)}\n${e.claims.join(', ')}`} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
