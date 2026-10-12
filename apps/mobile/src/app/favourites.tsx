import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Divider, ErrorState, ListItem, Loading, Notice, Screen, Txt } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { CATEGORY_ICON } from '../lib/icons';
import { MAX_FAVOURITE_CARDS, MAX_FAVOURITE_SERVICES, SERVICES } from '../lib/shared/platform';
import { space, useTheme } from '../lib/theme';
import { useAsync } from '../lib/useAsync';

/** Choose favourite cards (home carousel) or favourite services (home list). */
export default function Favourites() {
  const { kind = 'cards' } = useLocalSearchParams<{ kind?: 'cards' | 'services' }>();
  const c = useTheme();
  const { t, tr, pick } = useI18n();
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.preferences(), api.wallet()]));
  const [picked, setPicked] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const [prefs, wallet] = data!;
  const cards = kind === 'cards';
  const max = cards ? MAX_FAVOURITE_CARDS : MAX_FAVOURITE_SERVICES;
  const current = picked ?? (cards ? prefs.favouriteCards : prefs.favouriteServices);
  const items = cards
    ? wallet.map((w) => ({ id: w.id, title: w.vehicle ? `${t(w.type)} · ${w.vehicle.plate}` : t(w.type), icon: 'card' as const }))
    : SERVICES.filter((s) => !s.hidden).map((s) => ({ id: s.id, title: pick(s.name), icon: CATEGORY_ICON[s.category] }));

  function toggle(id: string) {
    setMessage(undefined);
    if (current.includes(id)) return setPicked(current.filter((x) => x !== id));
    if (current.length >= max) return setMessage(tr(`You can choose up to ${max}. Remove one first.`, `Vous pouvez en choisir jusqu’à ${max}. Retirez-en un d’abord.`));
    setPicked([...current, id]);
  }

  async function save() {
    setBusy(true);
    try {
      await api.savePreferences(cards ? { favouriteCards: current } : { favouriteServices: current });
      router.back();
    } catch (e) {
      setMessage((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Txt v="callout" muted>
        {cards
          ? tr(`Choose up to ${max} documents to show first on your home screen.`, `Choisissez jusqu’à ${max} documents à afficher en premier sur l’accueil.`)
          : tr(`Choose up to ${max} services for quick access on your home screen.`, `Choisissez jusqu’à ${max} services pour un accès rapide sur l’accueil.`)}
      </Txt>
      <Txt v="caption" muted>
        {tr(`Selected ${current.length} of ${max}`, `${current.length} sur ${max} choisis`)}
      </Txt>
      {message && <Notice tone="warning">{message}</Notice>}
      <Card style={{ paddingVertical: space.xs }}>
        {items.map((it, i) => {
          const on = current.includes(it.id);
          return (
            <View key={it.id}>
              {i > 0 && <Divider inset={52} />}
              <ListItem icon={it.icon} title={it.title} right={<Ionicons name={on ? 'star' : 'star-outline'} size={22} color={on ? c.gold : c.textFaint} accessibilityLabel={on ? tr('Favourite', 'Favori') : tr('Not a favourite', 'Pas un favori')} />} onPress={() => toggle(it.id)} />
            </View>
          );
        })}
      </Card>
      <Button title={tr('Save', 'Enregistrer')} onPress={save} loading={busy} />
      {current.length > 0 && <Button title={tr('Clear all', 'Tout effacer')} variant="ghost" size="md" onPress={() => setPicked([])} />}
    </Screen>
  );
}
