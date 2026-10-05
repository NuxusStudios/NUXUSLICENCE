import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RATIO, DocumentCard } from '../../components/DocumentCard';
import { ErrorState, Loading, PressScale, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { space, useTheme } from '../../lib/theme';
import type { Credential } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

const ORDER: Credential['type'][] = ['driver_licence', 'photo_card', 'health_card', 'vehicle_permit'];
/** How much of each card's top edge stays visible in the stack. */
const PEEK = 66;

export default function Wallet() {
  const c = useTheme();
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const { data, error, loading, reload } = useAsync(api.wallet);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const sorted = [...data!].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const cardHeight = width / CARD_RATIO;

  return (
    <Screen refreshing={loading} onRefresh={reload} title={t('tabWallet')} subtitle={t('documentsCount').replace('{n}', String(sorted.length))}>
      {/* Stacked like a wallet: each card tucks under the next, showing its top strip. */}
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {sorted.map((cred, i) => (
          <PressScale
            key={cred.id}
            onPress={() => router.push(`/credential/${cred.id}`)}
            accessibilityLabel={t(cred.type)}
            scaleTo={0.985}
            containerStyle={{ marginTop: i === 0 || !width ? 0 : -(cardHeight - PEEK) }}
          >
            <DocumentCard credential={cred} compact animated={i === sorted.length - 1} />
          </PressScale>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xs, marginTop: space.sm }}>
        <Ionicons name="lock-closed" size={15} color={c.textMuted} style={{ marginTop: 2 }} />
        <Txt v="caption" muted style={{ flex: 1 }}>
          {t('privacyBody')}
        </Txt>
      </View>
    </Screen>
  );
}
