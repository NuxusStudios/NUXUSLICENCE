import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Chip, ChipRow, SearchField } from '../components/kit';
import { Badge, Button, Card, Divider, Empty, Row, Screen, Txt } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { LOCATIONS } from '../lib/shared/platform';
import { space } from '../lib/theme';

/** ServiceOntario and DriveTest locations (Sanad "Sanad stations / Near me"). Sample data. */
export default function Locations() {
  const { tr, pick } = useI18n();
  const { status } = useAuth();
  const [city, setCity] = useState('all');
  const [org, setOrg] = useState<'all' | 'serviceontario' | 'drivetest'>('all');
  const [query, setQuery] = useState('');
  const cities = [...new Set(LOCATIONS.map((l) => l.city))];
  const q = query.trim().toLowerCase();
  const list = LOCATIONS.filter((l) => (city === 'all' || l.city === city) && (org === 'all' || l.orgId === org) && (!q || `${l.name.en} ${l.name.fr} ${l.address} ${l.city}`.toLowerCase().includes(q)));

  return (
    <Screen>
      <SearchField value={query} onChangeText={setQuery} placeholder={tr('Search by name or address', 'Rechercher par nom ou adresse')} />
      <ChipRow>
        <Chip label={tr('All', 'Tous')} on={org === 'all'} onPress={() => setOrg('all')} />
        <Chip label="ServiceOntario" on={org === 'serviceontario'} onPress={() => setOrg('serviceontario')} />
        <Chip label={tr('DriveTest', 'TestVolant')} on={org === 'drivetest'} onPress={() => setOrg('drivetest')} />
      </ChipRow>
      <ChipRow>
        <Chip icon="location-outline" label={tr('All cities', 'Toutes les villes')} on={city === 'all'} onPress={() => setCity('all')} />
        {cities.map((c) => (
          <Chip key={c} label={c} on={city === c} onPress={() => setCity(c)} />
        ))}
      </ChipRow>
      {list.length === 0 && <Empty icon="location-outline" text={tr('No locations match.', 'Aucun bureau ne correspond.')} />}
      {list.map((l) => (
        <Card key={l.id} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
            <Txt v="headline" style={{ flex: 1 }}>
              {pick(l.name)}
            </Txt>
            {l.accessible && <Badge label={tr('Accessible', 'Accessible')} tone="info" />}
          </View>
          <Divider />
          <Row label={tr('Address', 'Adresse')} value={`${l.address}, ${l.city}`} />
          <Row label={tr('Hours', 'Heures')} value={pick(l.hours)} />
          <Row label={tr('Phone', 'Téléphone')} value={l.phone} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title={tr('Directions', 'Itinéraire')} size="md" variant="secondary" icon="navigate" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.address}, ${l.city}, ON`)}`)} />
            </View>
            {status === 'signedIn' && (
              <View style={{ flex: 1 }}>
                <Button title={tr('Book', 'Réserver')} size="md" icon="calendar" onPress={() => router.push(`/appointments/book?location=${l.id}`)} />
              </View>
            )}
          </View>
        </Card>
      ))}
      <Txt v="caption" faint style={{ textAlign: 'center' }}>
        {tr('Prototype: sample locations with fictional addresses.', 'Prototype : bureaux fictifs.')}
      </Txt>
    </Screen>
  );
}
