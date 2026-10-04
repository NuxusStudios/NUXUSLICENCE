import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { DocumentCard } from '../../components/DocumentCard';
import { Body, ErrorState, Loading, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useAsync } from '../../lib/useAsync';
import type { Credential } from '../../lib/types';

const ORDER: Credential['type'][] = ['driver_licence', 'photo_card', 'health_card', 'vehicle_permit'];

export default function Wallet() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useAsync(api.wallet);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const sorted = [...data!].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Body muted>{t('privacyBody')}</Body>
      {sorted.map((cred) => (
        <Pressable
          key={cred.id}
          onPress={() => router.push(`/credential/${cred.id}`)}
          accessibilityRole="button"
          style={({ pressed }) => pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }}
        >
          <DocumentCard credential={cred} compact />
        </Pressable>
      ))}
    </Screen>
  );
}
