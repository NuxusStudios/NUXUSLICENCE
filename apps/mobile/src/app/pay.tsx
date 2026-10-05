import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, Card, Divider, Field, IconTile, Notice, Row, Screen, Txt } from '../components/ui';
import { api, type PaymentInput } from '../lib/api';
import { money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { fonts, space, useTheme } from '../lib/theme';
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
          <IconTile icon="checkmark" tone="success" size={84} />
          <Txt v="title">{t('paymentSuccess')}</Txt>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1.2, color: c.text, fontVariant: ['tabular-nums'] }}>{money(receipt.amount, lang)}</Text>
        </View>
        <Card style={{ paddingVertical: space.md }}>
          <Row label={t('receipt')} value={receipt.receiptNumber} mono />
          {params.label ? <Row label="" value={params.label} /> : null}
        </Card>
        <Button title={t('done')} onPress={() => router.back()} />
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
        <Field
          label={t('cardNumber')}
          value={card}
          onChangeText={(v) => setCard(formatCard(v))}
          keyboardType="number-pad"
          placeholder="4242 4242 4242 4242"
          autoComplete="cc-number"
          style={{ fontFamily: fonts.mono, letterSpacing: 1 }}
        />
        <Button title={t('payWithCard')} icon="card" onPress={() => pay('card')} loading={busy === 'card'} disabled={!!busy || card.replace(/\s/g, '').length < 12} />
      </Card>
    </Screen>
  );
}
