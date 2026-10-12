import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check, ResultPanel } from '../components/kit';
import { Button, Card, Divider, Field, ListItem, Notice, Row, Screen, Txt } from '../components/ui';
import { api, type PaymentInput } from '../lib/api';
import { METHOD, dateTime, money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { cardBrand } from '../lib/shared/platform';
import { fonts, space, useTheme } from '../lib/theme';
import type { Payment, PaymentMethod } from '../lib/types';
import { useAsync } from '../lib/useAsync';

type Params = {
  kind: 'fine' | 'plate' | 'service' | 'request' | 'all-fines';
  id: string;
  amount?: string;
  label?: string;
  years?: string;
  /** JSON-encoded form data for service requests. */
  data?: string;
};

/** Group card digits in fours as the user types. */
function formatCard(input: string): string {
  return input
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/**
 * Payment sheet. In production the wallet buttons hand off to Apple Pay /
 * Google Pay (e.g. via @stripe/stripe-react-native PlatformPay or the
 * acquirer's SDK) and pass the resulting single-use token to the API. Here the
 * token is simulated; card number 4000 0000 0000 0002 simulates a decline.
 */
export default function Pay() {
  const params = useLocalSearchParams<Params>();
  const c = useTheme();
  const { t, tr, lang } = useI18n();
  const cards = useAsync(api.cards);
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [savedId, setSavedId] = useState<string>();
  const [saveCard, setSaveCard] = useState(false);
  const [busy, setBusy] = useState<PaymentMethod>();
  const [error, setError] = useState<string>();
  const [receipt, setReceipt] = useState<Partial<Payment> & { receiptNumber: string; amount: number }>();
  const amount = Number(params.amount ?? 0);

  async function pay(method: PaymentMethod) {
    setBusy(method);
    setError(undefined);
    const digits = card.replace(/\s/g, '');
    const paymentToken = method === 'card' && !savedId && digits === '4000000000000002' ? 'tok_decline' : `tok_demo_${method}_${Date.now()}`;
    const input: PaymentInput = { method, paymentToken };
    if (method === 'card' && savedId) input.cardId = savedId;
    if (method === 'card' && !savedId && saveCard) input.saveCard = { last4: digits.slice(-4), expiry: expiry || '12/30', brand: cardBrand(digits) };
    try {
      if (params.kind === 'fine') setReceipt((await api.payFine(params.id, input)).payment);
      else if (params.kind === 'all-fines') setReceipt((await api.payAllFines(input)).payment);
      else if (params.kind === 'request') setReceipt((await api.payRequest(params.id, input)).payment);
      else if (params.kind === 'plate') {
        const res = await api.renewPlate(params.id, { years: params.years === '2' ? 2 : 1, ...input });
        setReceipt({ receiptNumber: res.paymentId ?? '—', amount: res.fee });
      } else {
        const req = await api.submitService(params.id, { data: JSON.parse(params.data ?? '{}'), ...input });
        setReceipt({ receiptNumber: req.reference, amount });
      }
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as { status?: number }).status === 402 ? t('paymentDeclined') : (e as Error).message);
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(undefined);
    }
  }

  if (receipt) {
    return (
      <Screen>
        <ResultPanel title={t('paymentSuccess')} subtitle={tr('A receipt is in your payment history and you’ll get a notification.', 'Le reçu est dans l’historique des paiements et vous recevrez une notification.')}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1.2, color: c.text, fontVariant: ['tabular-nums'] }}>{money(receipt.amount, lang)}</Text>
        </ResultPanel>
        <Card style={{ paddingVertical: space.md }}>
          <Row label={t('receipt')} value={receipt.receiptNumber} mono />
          {receipt.id ? <Row label={tr('Payment number', 'Numéro de paiement')} value={receipt.id} mono /> : null}
          {receipt.method ? <Row label={tr('Method', 'Mode')} value={`${METHOD[receipt.method]}${receipt.cardLast4 ? ` •••• ${receipt.cardLast4}` : ''}`} /> : null}
          {receipt.createdAt ? <Row label={tr('Date', 'Date')} value={dateTime(receipt.createdAt, lang)} /> : null}
          {params.label ? <Row label={tr('For', 'Pour')} value={params.label} /> : null}
        </Card>
        <Button title={t('done')} onPress={() => router.back()} />
        {params.kind === 'request' && <Button title={tr('My requests', 'Mes demandes')} variant="secondary" onPress={() => router.replace(`/requests/${params.id}`)} />}
        <Button title={tr('Payment history', 'Historique des paiements')} variant="ghost" size="md" onPress={() => router.replace('/payments')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: space.lg }}>
        <Txt v="label" muted>
          {t('amount')}
        </Txt>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 46, lineHeight: 52, letterSpacing: -1.4, color: c.text, fontVariant: ['tabular-nums'] }}>{money(amount, lang)}</Text>
        <Txt v="caption" muted style={{ textAlign: 'center' }}>
          {params.label}
        </Txt>
      </View>
      {error && <Notice tone="danger">{error}</Notice>}

      {Platform.OS === 'ios' && <Button title={t('payWithApple')} variant="black" icon="logo-apple" onPress={() => pay('apple_pay')} loading={busy === 'apple_pay'} disabled={!!busy} />}
      {Platform.OS === 'android' && <Button title={t('payWithGoogle')} variant="black" icon="logo-google" onPress={() => pay('google_pay')} loading={busy === 'google_pay'} disabled={!!busy} />}
      <Button title={t('payWithInterac')} variant="secondary" icon="swap-horizontal" onPress={() => pay('interac')} loading={busy === 'interac'} disabled={!!busy} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xs }}>
        <View style={{ flex: 1 }}>
          <Divider />
        </View>
        <Txt v="caption" faint>
          {t('payWithCard')}
        </Txt>
        <View style={{ flex: 1 }}>
          <Divider />
        </View>
      </View>

      <Card style={{ gap: space.md }}>
        {!!cards.data?.length && (
          <View>
            {cards.data.map((sc) => (
              <ListItem key={sc.id} icon={savedId === sc.id ? 'radio-button-on' : 'radio-button-off'} title={`${sc.brand.toUpperCase()} •••• ${sc.last4}`} subtitle={`${tr('Saved card · expires', 'Carte enregistrée · expire')} ${sc.expiry}`} onPress={() => setSavedId(savedId === sc.id ? undefined : sc.id)} />
            ))}
            <ListItem icon={!savedId ? 'radio-button-on' : 'radio-button-off'} title={tr('Use a new card', 'Utiliser une nouvelle carte')} onPress={() => setSavedId(undefined)} />
          </View>
        )}
        {!savedId && (
          <>
            <Field
              label={t('cardNumber')}
              value={card}
              onChangeText={(v) => setCard(formatCard(v))}
              keyboardType="number-pad"
              placeholder="4242 4242 4242 4242"
              autoComplete="cc-number"
              style={{ fontFamily: fonts.mono, letterSpacing: 1 }}
            />
            <Field label={tr('Expiry (MM/YY)', 'Expiration (MM/AA)')} value={expiry} onChangeText={(v) => setExpiry(v.replace(/[^\d/]/g, '').slice(0, 5))} placeholder="08/29" keyboardType="number-pad" autoComplete="cc-exp" />
            <Check checked={saveCard} onToggle={() => setSaveCard((s) => !s)}>
              {tr('Save this card for next time', 'Enregistrer cette carte pour la prochaine fois')}
            </Check>
          </>
        )}
        <Button title={t('payWithCard')} icon="card" onPress={() => pay('card')} loading={busy === 'card'} disabled={!!busy || (!savedId && card.replace(/\s/g, '').length < 12)} />
      </Card>
    </Screen>
  );
}
