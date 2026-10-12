import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Accordion, Chip, ChipRow, SearchField, Widget } from '../../components/kit';
import { Divider, ListItem, Screen, Txt } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { FAQ, type Faq } from '../../lib/shared/platform';

/** Help centre (Sanad: FAQ, Rating & Complaints, call centre, stations). */
export default function Help() {
  const { tr, pick } = useI18n();
  const [topic, setTopic] = useState<Faq['topic'] | 'all'>('all');
  const [query, setQuery] = useState('');
  const topics: Record<Faq['topic'] | 'all', string> = {
    all: tr('All', 'Tout'),
    account: tr('Account', 'Compte'),
    documents: tr('Documents', 'Documents'),
    tickets: tr('Tickets', 'Contraventions'),
    payments: tr('Payments', 'Paiements'),
    services: tr('Services', 'Services'),
    privacy: tr('Privacy', 'Confidentialité'),
  };
  const q = query.trim().toLowerCase();
  const list = FAQ.filter((f) => (topic === 'all' || f.topic === topic) && (!q || `${pick(f.q)} ${pick(f.a)}`.toLowerCase().includes(q)));

  return (
    <Screen>
      <SearchField value={query} onChangeText={setQuery} placeholder={tr('Search help', 'Rechercher dans l’aide')} />
      <ChipRow>
        {(Object.keys(topics) as (Faq['topic'] | 'all')[]).map((k) => (
          <Chip key={k} label={topics[k]} on={topic === k} onPress={() => setTopic(k)} />
        ))}
      </ChipRow>
      <Widget title={tr('Frequently asked questions', 'Foire aux questions')} subtitle={tr('Quick answers, clearly organized.', 'Des réponses rapides et claires.')}>
        {list.length === 0 ? (
          <Txt v="callout" muted style={{ paddingVertical: 12 }}>
            {tr('No answers match. Try other words or contact us.', 'Aucune réponse. Essayez d’autres mots ou écrivez-nous.')}
          </Txt>
        ) : (
          list.map((f, i) => (
            <View key={f.id}>
              {i > 0 && <Divider />}
              <Accordion title={pick(f.q)}>
                <Txt v="callout" muted>
                  {pick(f.a)}
                </Txt>
              </Accordion>
            </View>
          ))
        )}
      </Widget>

      <Widget title={tr('Still need help?', 'Besoin d’aide?')}>
        <ListItem icon="chatbubble-ellipses" title={tr('Suggestion', 'Suggestion')} subtitle={tr('Share an idea to improve the app', 'Proposez une idée pour améliorer l’application')} onPress={() => router.push('/help/feedback?kind=suggestion')} />
        <Divider inset={52} />
        <ListItem icon="alert-circle" tone="warning" title={tr('Complaint', 'Plainte')} subtitle={tr('Something went wrong? Tell us the details', 'Un problème? Donnez-nous les détails')} onPress={() => router.push('/help/feedback?kind=complaint')} />
        <Divider inset={52} />
        <ListItem icon="star" title={tr('Rate your experience', 'Évaluez votre expérience')} onPress={() => router.push('/help/rate')} />
        <Divider inset={52} />
        <ListItem icon="call" title={tr('Contact centre', 'Centre d’appels')} subtitle="1-800-555-0199 (demo)" onPress={() => void Linking.openURL('tel:18005550199')} />
        <Divider inset={52} />
        <ListItem icon="location" title={tr('Find a location', 'Trouver un bureau')} subtitle={tr('ServiceOntario and DriveTest', 'ServiceOntario et TestVolant')} onPress={() => router.push('/locations')} />
      </Widget>

      <Widget title={tr('About', 'À propos')}>
        <ListItem icon="information-circle" title={tr('About CivicPass', 'À propos de CivicPass')} onPress={() => router.push('/help/about')} />
        <Divider inset={52} />
        <ListItem icon="lock-closed" title={tr('Privacy policy', 'Politique de confidentialité')} onPress={() => router.push('/help/privacy')} />
      </Widget>
    </Screen>
  );
}
