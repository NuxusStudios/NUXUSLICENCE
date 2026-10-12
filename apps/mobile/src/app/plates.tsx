import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Chip, ChipRow, ResultPanel, SearchField } from '../components/kit';
import { Plate } from '../components/Plate';
import { Badge, Button, Card, Divider, Loading, Notice, Row, Screen, Txt } from '../components/ui';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { PlateCheck, ServiceRequest } from '../lib/types';
import { space } from '../lib/theme';
import { useAsync } from '../lib/useAsync';

/** Personalized plates (Sanad: "distinguished numbers"): search, check, order, pay. */
export default function Plates() {
  const { tr, pick, lang } = useI18n();
  const vehicles = useAsync(api.vehicles);
  const [query, setQuery] = useState('');
  const [check, setCheck] = useState<PlateCheck>();
  const [vehicleId, setVehicleId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [order, setOrder] = useState<ServiceRequest>();

  async function search(text = query) {
    if (!text.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      setCheck(await api.checkPlate(text));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function place() {
    setBusy(true);
    setError(undefined);
    try {
      setOrder(await api.orderPlate(check!.plate, vehicleId!));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <Screen>
        <ResultPanel icon="time" tone="warning" title={tr('Order placed', 'Commande passée')} subtitle={tr('Your combination is held while the order awaits payment.', 'Votre combinaison est réservée en attendant le paiement.')}>
          <Plate plate={order.data.plate!} jurisdiction="ONTARIO" size="lg" />
        </ResultPanel>
        <Card style={{ paddingVertical: space.md }}>
          <Row label={tr('Order number', 'Numéro de commande')} value={order.reference} mono />
          <Row label={tr('Vehicle', 'Véhicule')} value={order.data.vehicle} />
          <Row label={tr('Status', 'Statut')} value={<Badge label={tr('Awaiting payment', 'Paiement attendu')} tone="warning" />} />
          <Row label={tr('Amount', 'Montant')} value={money(order.amount, lang)} strong />
        </Card>
        <Button title={`${tr('Pay now', 'Payer maintenant')} · ${money(order.amount, lang)}`} icon="card" onPress={() => router.replace({ pathname: '/pay', params: { kind: 'request', id: order.id, amount: String(order.amount), label: `${tr('Personalized plates', 'Plaques personnalisées')} ${order.data.plate}` } })} />
        <Button title={tr('Pay later', 'Payer plus tard')} variant="secondary" onPress={() => router.replace(`/requests/${order.id}`)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt v="callout" muted>
        {tr('2 to 8 letters and numbers. We check it isn’t issued, reserved or offensive.', 'De 2 à 8 lettres et chiffres. Nous vérifions qu’elle n’est ni attribuée, ni réservée, ni offensante.')}
      </Txt>
      <SearchField value={query} onChangeText={(v) => setQuery(v.toUpperCase().slice(0, 9))} placeholder={tr('Plate text, e.g. GO LEAFS', 'Texte de la plaque, p. ex. GO LEAFS')} />
      <Button title={tr('Check availability', 'Vérifier la disponibilité')} icon="search" onPress={() => void search()} loading={busy && !check} disabled={!query.trim()} />
      {error && <Notice tone="danger">{error}</Notice>}

      {check && (
        <Card style={{ gap: space.md, alignItems: 'center' }}>
          <Plate plate={check.plate || '—'} jurisdiction="ONTARIO" size="lg" />
          {check.available ? <Badge label={tr('Available', 'Disponible')} tone="success" /> : <Badge label={tr('Not available', 'Non disponible')} tone="danger" />}
          {check.reason && (
            <Txt v="callout" muted style={{ textAlign: 'center' }}>
              {pick(check.reason)}
            </Txt>
          )}
          {!check.available && check.suggestions.length > 0 && (
            <View style={{ gap: space.sm, alignItems: 'center' }}>
              <Txt v="caption" muted>
                {tr('Available alternatives', 'Options disponibles')}
              </Txt>
              <ChipRow>
                {check.suggestions.map((s) => (
                  <Chip key={s} label={s} onPress={() => { setQuery(s); void search(s); }} />
                ))}
              </ChipRow>
            </View>
          )}
        </Card>
      )}

      {check?.available && (
        <>
          <Card style={{ paddingVertical: space.md }}>
            {check.feeBreakdown.map((f) => (
              <Row key={f.label.en} label={pick(f.label)} value={money(f.amount, lang)} />
            ))}
            <Divider />
            <Row label={tr('Total', 'Total')} value={money(check.fee, lang)} strong />
          </Card>
          <Txt v="label" muted>
            {tr('For which vehicle?', 'Pour quel véhicule?')}
          </Txt>
          {!vehicles.data ? (
            <Loading />
          ) : (
            <ChipRow>
              {vehicles.data.map((v) => (
                <Chip key={v.id} icon="car" label={`${v.plate} · ${v.make} ${v.model}`} on={vehicleId === v.id} onPress={() => setVehicleId(v.id)} />
              ))}
            </ChipRow>
          )}
          <Txt v="caption" faint>
            {tr('Prototype: fees are placeholders.', 'Prototype : les frais sont fictifs.')}
          </Txt>
          <Button title={tr('Order these plates', 'Commander ces plaques')} icon="cart" disabled={!vehicleId} loading={busy} onPress={place} />
        </>
      )}
    </Screen>
  );
}
