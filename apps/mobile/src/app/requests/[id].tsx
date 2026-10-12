import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RequestStatusBadge, Timeline } from '../../components/kit';
import { Button, Card, Divider, ErrorState, Field, IconTile, Loading, Notice, Row, Screen, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { date, dateTime, money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { CATEGORY_ICON } from '../../lib/icons';
import { ORGANIZATIONS, serviceById } from '../../lib/shared/platform';
import { space } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

/** Labels for data added outside the service form (resubmissions, plate orders). */
const EXTRA_LABELS: Record<string, { en: string; fr: string }> = {
  update: { en: 'Additional information', fr: 'Information supplémentaire' },
  plate: { en: 'Plate', fr: 'Plaque' },
  vehicle: { en: 'Vehicle', fr: 'Véhicule' },
};

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tr, pick, lang } = useI18n();
  const { data, error, loading, reload } = useAsync(() => api.serviceRequest(id), id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const r = data!;
  const s = serviceById(r.serviceId);
  const org = s && ORGANIZATIONS.find((o) => o.id === s.orgId);
  const name = s ? pick(s.name) : r.serviceId;
  const cancellable = ['in_review', 'awaiting_payment', 'action_required'].includes(r.status);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <IconTile icon={s ? CATEGORY_ICON[s.category] : 'document'} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt v="headline">{name}</Txt>
          {org && (
            <Txt v="caption" muted>
              {pick(org.name)}
            </Txt>
          )}
        </View>
        <RequestStatusBadge status={r.status} />
      </View>

      {r.status === 'action_required' && r.note && <Notice tone="warning">{pick(r.note)}</Notice>}
      {r.status === 'awaiting_payment' && <Notice tone="warning">{tr('Pay the fee to continue processing.', 'Payez les frais pour poursuivre le traitement.')}</Notice>}

      <Card style={{ paddingVertical: space.md }}>
        <Row label={tr('Request number', 'Numéro de demande')} value={r.reference} mono />
        <Row label={tr('Submitted', 'Soumise le')} value={date(r.createdAt, lang)} />
        <Row label={tr('Last update', 'Dernière mise à jour')} value={dateTime(r.updatedAt, lang)} />
        <Row label={tr('Amount', 'Montant')} value={r.amount ? money(r.amount, lang) : tr('Free', 'Gratuit')} />
        {r.payment && <Row label={tr('Receipt', 'Reçu')} value={r.payment.receiptNumber} mono />}
        {Object.entries(r.data).map(([k, v]) => (
          <Row key={k} label={pick(s?.fields.find((f) => f.key === k)?.label ?? EXTRA_LABELS[k] ?? { en: k, fr: k })} value={v} />
        ))}
      </Card>

      {r.result && (
        <>
          <SectionHeader>{pick(r.result.title)}</SectionHeader>
          <Card style={{ paddingVertical: space.md }}>
            {r.result.lines.map((l, i) => (
              <Row key={`${l.label.en}${i}`} label={pick(l.label)} value={l.value} />
            ))}
          </Card>
        </>
      )}

      {r.status === 'awaiting_payment' && (
        <Button
          title={`${tr('Pay now', 'Payer maintenant')} · ${money(r.amount, lang)}`}
          icon="card"
          onPress={() => router.push({ pathname: '/pay', params: { kind: 'request', id: r.id, amount: String(r.amount), label: name } })}
        />
      )}

      {r.status === 'action_required' && (
        <Card style={{ gap: space.md }}>
          <Txt v="headline">{tr('Update and resubmit', 'Mettre à jour et soumettre de nouveau')}</Txt>
          <Field label={tr('Missing or corrected information', 'Information manquante ou corrigée')} value={extra} onChangeText={setExtra} multiline />
          <Button title={tr('Resubmit request', 'Soumettre de nouveau')} icon="send" loading={busy} disabled={extra.trim().length < 3} onPress={() => void act(() => api.resubmitRequest(r.id, { update: extra.trim() }))} />
        </Card>
      )}

      <SectionHeader>{tr('History', 'Historique')}</SectionHeader>
      <Card>
        <Timeline events={r.history} />
      </Card>

      {message && <Notice tone="danger">{message}</Notice>}
      {cancellable &&
        (confirmCancel ? (
          <Card style={{ gap: space.sm }}>
            <Notice tone="warning">{tr('Cancel this request? This can’t be undone.', 'Annuler cette demande? C’est irréversible.')}</Notice>
            <Button title={tr('Cancel request', 'Annuler la demande')} variant="danger" loading={busy} onPress={() => void act(() => api.cancelRequest(r.id)).then(() => setConfirmCancel(false))} />
            <Button title={tr('Keep it', 'La garder')} variant="ghost" size="md" onPress={() => setConfirmCancel(false)} />
          </Card>
        ) : (
          <>
            <Divider />
            <Button title={tr('Cancel request', 'Annuler la demande')} variant="ghost" size="md" icon="close-circle-outline" onPress={() => setConfirmCancel(true)} />
          </>
        ))}
      {s && (
        <Button title={tr('Service details', 'Fiche du service')} variant="ghost" size="md" onPress={() => router.push(`/services/${s.id}`)} />
      )}
    </Screen>
  );
}
