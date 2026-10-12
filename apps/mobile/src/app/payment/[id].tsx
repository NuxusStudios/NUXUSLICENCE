import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Badge, Card, ErrorState, IconTile, Loading, Notice, Row, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { METHOD, dateTime, money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { fonts, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const { tr, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(api.payments);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const p = data!.find((x) => x.id === id);
  if (!p) return <ErrorState error={new Error(tr('Payment not found', 'Paiement introuvable'))} onRetry={reload} />;
  const ok = p.status === 'succeeded';
  const purpose = { fine: tr('Ticket', 'Contravention'), plate_renewal: tr('Plate renewal', 'Renouvellement de plaque'), service_fee: tr('Service fee', 'Frais de service') }[p.purpose];
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
        <IconTile icon={ok ? 'checkmark' : 'close'} tone={ok ? 'success' : 'danger'} size={64} />
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1.2, color: c.text, fontVariant: ['tabular-nums'] }}>{money(p.amount, lang)}</Text>
        <Badge label={ok ? tr('Successful', 'Réussi') : tr('Failed', 'Échoué')} tone={ok ? 'success' : 'danger'} />
      </View>
      {!ok && <Notice tone="info">{tr('Nothing was charged. Try again or use another method.', 'Rien n’a été prélevé. Réessayez ou utilisez un autre mode.')}</Notice>}
      <Card style={{ paddingVertical: space.md }}>
        <Row label={tr('Service', 'Service')} value={p.label ?? purpose} />
        <Row label={tr('Type', 'Type')} value={purpose} />
        <Row label={tr('Biller', 'Facturier')} value={tr('Minister of Finance (Ontario)', 'Ministre des Finances (Ontario)')} />
        <Row label={tr('Payment number', 'Numéro de paiement')} value={p.id} mono />
        <Row label={tr('Receipt number', 'Numéro de reçu')} value={p.receiptNumber} mono />
        <Row label={tr('Method', 'Mode')} value={`${METHOD[p.method]}${p.cardLast4 ? ` •••• ${p.cardLast4}` : ''}`} />
        <Row label={tr('Date and time', 'Date et heure')} value={dateTime(p.createdAt, lang)} />
        <Row label={tr('Card fees', 'Frais de carte')} value={money(0, lang)} />
      </Card>
      <Txt v="caption" faint style={{ textAlign: 'center' }}>
        {tr('Prototype: simulated payment.', 'Prototype : paiement simulé.')}
      </Txt>
    </Screen>
  );
}
