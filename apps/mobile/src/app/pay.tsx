import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Body, Button, Card, Field, Notice, Row, Screen } from '../components/ui';
import { api, type PaymentInput } from '../lib/api';
import { money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { space, useTheme } from '../lib/theme';
import type { Payment, PaymentMethod } from '../lib/types';

type Params = {
  kind: 'fine' | 'plate' | 'service';
  id: string;
  amount?: string;
  label?: string;
  years?: string;
  /** JSON-encoded form data for service requests. */
  data?: string;
};

/**
 * Payment sheet. In production the wallet buttons hand off to Apple Pay /
 * Google Pay (e.g. via @stripe/stripe-react-native PlatformPay or the
 * acquirer's SDK) and pass the resulting single-use token to the API. Here the
 * token is simulated; card number 4000 0000 0000 0002 simulates a decline.
 */
export default function Pay() {
  const params = useLocalSearchParams<Params>();
  const c = useTheme();
  const { t, lang } = useI18n();
  const [card, setCard] = useState('');
  const [busy, setBusy] = useState<PaymentMethod>();
  const [error, setError] = useState<string>();
  const [receipt, setReceipt] = useState<Payment | { receiptNumber: string; amount: number }>();
  const amount = Number(params.amount ?? 0);

  async function pay(method: PaymentMethod) {
    setBusy(method);
    setError(undefined);
    const paymentToken = method === 'card' && card.replace(/\s/g, '') === '4000000000000002' ? 'tok_decline' : `tok_demo_${method}_${Date.now()}`;
    const input: PaymentInput = { method, paymentToken };
    try {
      if (params.kind === 'fine') {
        const res = await api.payFine(params.id, input);
        setReceipt(res.payment);
      } else if (params.kind === 'plate') {
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
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <Ionicons name="checkmark-circle" size={72} color={c.success} />
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{t('paymentSuccess')}</Text>
        </View>
        <Card>
          <Row label={t('receipt')} value={receipt.receiptNumber} />
          <Row label={t('amount')} value={money(receipt.amount, lang)} strong />
        </Card>
        <Button title={t('done')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Body muted>{params.label}</Body>
        <Row label={t('amount')} value={money(amount, lang)} strong />
      </Card>
      {error && <Notice tone="danger">{error}</Notice>}

      {Platform.OS === 'ios' && <Button title={t('payWithApple')} icon="logo-apple" onPress={() => pay('apple_pay')} loading={busy === 'apple_pay'} disabled={!!busy} />}
      {Platform.OS === 'android' && <Button title={t('payWithGoogle')} icon="logo-google" onPress={() => pay('google_pay')} loading={busy === 'google_pay'} disabled={!!busy} />}
      <Button title={t('payWithInterac')} variant="secondary" icon="swap-horizontal" onPress={() => pay('interac')} loading={busy === 'interac'} disabled={!!busy} />

      <Card>
        <Field label={t('cardNumber')} value={card} onChangeText={setCard} keyboardType="number-pad" placeholder="4242 4242 4242 4242" autoComplete="cc-number" />
        <Button title={t('payWithCard')} icon="card" onPress={() => pay('card')} loading={busy === 'card'} disabled={!!busy || card.replace(/\s/g, '').length < 12} />
      </Card>
    </Screen>
  );
}
