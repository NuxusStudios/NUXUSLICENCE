import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip, ChipRow, DocumentTile, SearchField, SuggestCard } from '../../components/kit';
import { Empty, ErrorState, Loading, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { space, useTheme } from '../../lib/theme';
import type { Credential } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

const ORDER: Credential['type'][] = ['driver_licence', 'photo_card', 'health_card', 'vehicle_permit'];

type Category = 'all' | 'id' | 'vehicle' | 'health';
const CATEGORY_OF: Record<Credential['type'], Category> = { driver_licence: 'id', photo_card: 'id', vehicle_permit: 'vehicle', health_card: 'health' };

export default function Wallet() {
  const c = useTheme();
  const { t, tr } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const { data, error, loading, reload } = useAsync(api.wallet);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const q = query.trim().toLowerCase();
  const sorted = [...data!]
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
    .filter((d) => category === 'all' || CATEGORY_OF[d.type] === category)
    .filter((d) => !q || [t(d.type), d.documentNumber, d.vehicle?.plate ?? '', d.vehicle?.make ?? ''].some((x) => x.toLowerCase().includes(q)));
  const rows = Array.from({ length: Math.ceil(sorted.length / 2) }, (_, r) => sorted.slice(r * 2, r * 2 + 2));

  return (
    <Screen refreshing={loading} onRefresh={reload} title={t('tabWallet')} subtitle={t('documentsCount').replace('{n}', String(data!.length))}>
      <SearchField value={query} onChangeText={setQuery} placeholder={tr('Search documents', 'Rechercher un document')} />
      <ChipRow>
        {(
          [
            ['all', tr('All', 'Tous')],
            ['id', tr('Licences & ID', 'Permis et pièces')],
            ['vehicle', tr('Vehicles', 'Véhicules')],
            ['health', tr('Health', 'Santé')],
          ] as [Category, string][]
        ).map(([k, label]) => (
          <Chip key={k} label={label} on={category === k} onPress={() => setCategory(k)} />
        ))}
      </ChipRow>
      {sorted.length === 0 && <Empty icon="search" text={tr('No documents match.', 'Aucun document ne correspond.')} />}
      {/* Sanad-style 2-column grid of tinted document tiles. */}
      {rows.map((pair, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: space.md }}>
          {pair.map((cred) => (
            <DocumentTile key={cred.id} credential={cred} onPress={() => router.push(`/credential/${cred.id}`)} />
          ))}
          {pair.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}

      <SuggestCard
        icon="document-attach"
        title={tr('Can’t find a document?', 'Un document manque?')}
        body={tr('If one of your documents isn’t listed, ask for it to be added.', 'Si un de vos documents n’apparaît pas, demandez qu’il soit ajouté.')}
        cta={tr('Request a missing document', 'Demander un document manquant')}
        onPress={() => router.push('/services/unlisted-document')}
      />

      <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xs, marginTop: space.sm }}>
        <Ionicons name="lock-closed" size={15} color={c.textMuted} style={{ marginTop: 2 }} />
        <Txt v="caption" muted style={{ flex: 1 }}>
          {t('privacyBody')}
        </Txt>
      </View>
    </Screen>
  );
}
