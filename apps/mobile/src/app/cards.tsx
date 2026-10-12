import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Divider, Empty, ErrorState, ListItem, Loading, Notice, Screen, Txt } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';
import { useAsync } from '../lib/useAsync';

const BRAND = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', card: 'Card' } as const;

/** Saved payment cards (Sanad "Card management"). Only display details are stored. */
export default function Cards() {
  const { tr } = useI18n();
  const { data, error, loading, reload } = useAsync(api.cards);
  const [confirm, setConfirm] = useState<string>();
  const [message, setMessage] = useState<string>();
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Txt v="callout" muted>
        {tr('Cards you saved when paying. The card number stays with the payment processor; we keep only the brand, last four digits and expiry.', 'Cartes enregistrées lors d’un paiement. Le numéro reste chez le processeur de paiement; nous ne gardons que la marque, les quatre derniers chiffres et l’expiration.')}
      </Txt>
      {message && <Notice tone="success">{message}</Notice>}
      <Card style={{ paddingVertical: space.xs }}>
        {data!.length === 0 ? (
          <Empty icon="card-outline" text={tr('No saved cards.', 'Aucune carte enregistrée.')} />
        ) : (
          data!.map((card, i) => (
            <View key={card.id}>
              {i > 0 && <Divider inset={52} />}
              <ListItem icon="card" title={`${BRAND[card.brand]} •••• ${card.last4}`} subtitle={`${tr('Expires', 'Expire')} ${card.expiry}`} />
              {confirm === card.id ? (
                <View style={{ gap: space.sm, paddingBottom: space.md }}>
                  <Button
                    title={tr('Delete card', 'Supprimer la carte')}
                    variant="danger"
                    size="md"
                    onPress={async () => {
                      await api.deleteCard(card.id);
                      setConfirm(undefined);
                      setMessage(tr('Card deleted.', 'Carte supprimée.'));
                      await reload();
                    }}
                  />
                  <Button title={tr('Cancel', 'Annuler')} variant="ghost" size="md" onPress={() => setConfirm(undefined)} />
                </View>
              ) : (
                <Button title={tr('Remove', 'Retirer')} variant="ghost" size="md" icon="trash-outline" onPress={() => setConfirm(card.id)} />
              )}
            </View>
          ))
        )}
      </Card>
      <Card style={{ gap: space.xs }}>
        <Txt v="headline">{tr('Payment policy', 'Politique de paiement')}</Txt>
        <Txt v="callout" muted>
          {tr('Payments go to the Minister of Finance through the province’s payment processor. Refunds follow each service’s rules. A failed payment is never charged.', 'Les paiements sont versés au ministre des Finances par le processeur de paiement de la province. Les remboursements suivent les règles de chaque service. Un paiement échoué n’est jamais prélevé.')}
        </Txt>
      </Card>
    </Screen>
  );
}
