import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Chip, ChipRow, SearchField, SuggestCard, Widget } from './kit';
import { Badge, Divider, ErrorState, ListItem, Loading, Screen, Segmented, Txt } from './ui';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { CATEGORY_ICON, serviceHref } from '../lib/icons';
import type { OrgId, ServiceCategory, ServiceDefinition } from '../lib/shared/platform';
import { useAsync } from '../lib/useAsync';

const CATEGORIES: ServiceCategory[] = ['driver', 'vehicle', 'identity', 'health', 'records', 'courts'];

/** Sanad-style services directory: search, most used, new, by category or by organization. */
export function ServicesDirectory({ largeTitle }: { largeTitle?: boolean }) {
  const { tr, pick, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(api.directory);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'category' | 'org'>('category');
  const [org, setOrg] = useState<OrgId>('serviceontario');
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const { services, organizations } = data!;

  const catName: Record<ServiceCategory, string> = {
    driver: tr('Drivers and licences', 'Conducteurs et permis'),
    vehicle: tr('Vehicles and plates', 'Véhicules et plaques'),
    identity: tr('Identity and address', 'Identité et adresse'),
    health: tr('Health', 'Santé'),
    records: tr('Records and certificates', 'Dossiers et certificats'),
    courts: tr('Tickets and courts', 'Contraventions et tribunaux'),
  };

  const row = (s: ServiceDefinition, i: number) => (
    <View key={s.id}>
      {i > 0 && <Divider inset={52} />}
      <ListItem
        icon={CATEGORY_ICON[s.category]}
        title={pick(s.name)}
        subtitle={`${pick(organizations.find((o) => o.id === s.orgId)!.name)} · ${pick(s.description)}`}
        right={s.isNew ? <Badge label={tr('New', 'Nouveau')} tone="info" /> : s.fee ? <Badge label={money(s.fee, lang)} /> : undefined}
        onPress={() => router.push(serviceHref(s))}
      />
    </View>
  );

  const q = query.trim().toLowerCase();
  const results = q ? services.filter((s) => [s.name.en, s.name.fr, s.description.en, s.description.fr].some((x) => x.toLowerCase().includes(q))) : [];
  const orgResults = q ? organizations.filter((o) => [o.name.en, o.name.fr].some((x) => x.toLowerCase().includes(q))) : [];

  return (
    <Screen
      refreshing={loading}
      onRefresh={reload}
      title={largeTitle ? tr('Services', 'Services') : undefined}
      subtitle={largeTitle ? tr(`${services.length} services · ${organizations.length} organizations`, `${services.length} services · ${organizations.length} organismes`) : undefined}
    >
      <SearchField value={query} onChangeText={setQuery} placeholder={tr('What are you looking for?', 'Que cherchez-vous?')} />

      {q ? (
        <>
          <Widget title={tr('Search results', 'Résultats')}>
            {results.length ? results.map(row) : <Txt v="callout" muted style={{ paddingVertical: 12 }}>{tr('No services match.', 'Aucun service ne correspond.')}</Txt>}
          </Widget>
          {orgResults.length > 0 && (
            <Widget title={tr('Organizations', 'Organismes')}>
              {orgResults.map((o, i) => (
                <View key={o.id}>
                  {i > 0 && <Divider inset={52} />}
                  <ListItem icon={o.icon as never} title={pick(o.name)} subtitle={pick(o.description)} onPress={() => { setQuery(''); setMode('org'); setOrg(o.id); }} />
                </View>
              ))}
            </Widget>
          )}
          <SuggestCard
            icon="bulb"
            title={tr('Looking for another service?', 'Vous cherchez un autre service?')}
            body={tr('Suggest it and we’ll pass it to the right ministry.', 'Suggérez-le et nous le transmettrons au bon ministère.')}
            cta={tr('Suggest a new service', 'Suggérer un nouveau service')}
            onPress={() => router.push('/help/feedback?kind=new_service')}
          />
        </>
      ) : (
        <>
          <Widget title={tr('Most used', 'Les plus utilisés')}>{services.filter((s) => s.popular).map(row)}</Widget>
          <Widget title={tr('New services', 'Nouveaux services')}>{services.filter((s) => s.isNew).map(row)}</Widget>

          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'category', label: tr('By category', 'Par catégorie') },
              { value: 'org', label: tr('By organization', 'Par organisme') },
            ]}
          />
          {mode === 'category' ? (
            CATEGORIES.map((cat) => {
              const list = services.filter((s) => s.category === cat);
              return list.length ? (
                <Widget key={cat} title={catName[cat]} subtitle={tr(`${list.length} services`, `${list.length} services`)}>
                  {list.map(row)}
                </Widget>
              ) : null;
            })
          ) : (
            <>
              <ChipRow>
                {organizations.map((o) => (
                  <Chip key={o.id} label={pick(o.name)} icon={o.icon as never} on={org === o.id} onPress={() => setOrg(o.id)} />
                ))}
              </ChipRow>
              <Widget title={pick(organizations.find((o) => o.id === org)!.name)} subtitle={pick(organizations.find((o) => o.id === org)!.description)}>
                {services.filter((s) => s.orgId === org).map(row)}
              </Widget>
            </>
          )}

          <SuggestCard
            icon="bulb"
            title={tr('Didn’t find what you need?', 'Vous n’avez pas trouvé?')}
            body={tr('Suggest a service you’d like to do in the app.', 'Suggérez un service que vous aimeriez faire dans l’application.')}
            cta={tr('Suggest a new service', 'Suggérer un nouveau service')}
            onPress={() => router.push('/help/feedback?kind=new_service')}
          />
        </>
      )}
    </Screen>
  );
}
