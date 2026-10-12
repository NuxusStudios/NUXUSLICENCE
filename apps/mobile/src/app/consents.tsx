import { useState } from 'react';
import { View } from 'react-native';
import { Chip, ChipRow, PinPad } from '../components/kit';
import { Badge, Button, Card, Divider, Empty, ErrorState, Loading, Notice, Row, Screen, Txt } from '../components/ui';
import { api } from '../lib/api';
import { date } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';
import type { ConsentView } from '../lib/types';
import { useAsync } from '../lib/useAsync';

type Filter = 'all' | 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';

/**
 * Third parties (insurers, car rentals, landlords) ask to read specific data.
 * Nothing is shared until the holder approves with their PIN (Sanad "My consents").
 */
export default function Consents() {
  const { tr, pick, lang } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const [pinFor, setPinFor] = useState<string>();
  const [confirm, setConfirm] = useState<{ id: string; action: 'reject' | 'revoke' }>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const { data, error, loading, reload } = useAsync(api.consents);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const statusOf = (c: ConsentView): Exclude<Filter, 'all'> => (c.expired && c.status !== 'revoked' && c.status !== 'rejected' ? 'expired' : c.status);
  const tone = { pending: 'warning', approved: 'success', rejected: 'neutral', revoked: 'neutral', expired: 'neutral' } as const;
  const name: Record<Filter, string> = {
    all: tr('All', 'Toutes'),
    pending: tr('Awaiting action', 'En attente'),
    approved: tr('Approved', 'Approuvées'),
    rejected: tr('Rejected', 'Refusées'),
    revoked: tr('Revoked', 'Révoquées'),
    expired: tr('Expired', 'Expirées'),
  };
  const list = data!.filter((c) => filter === 'all' || statusOf(c) === filter);

  async function decide(id: string, action: 'approve' | 'reject' | 'revoke', pin?: string) {
    await api.decideConsent(id, action, pin);
    setMessage({ tone: 'success', text: { approve: tr('Approved. The data is shared.', 'Approuvée. Les données sont partagées.'), reject: tr('Request rejected.', 'Demande refusée.'), revoke: tr('Access revoked. The data can no longer be used.', 'Accès révoqué. Les données ne peuvent plus être utilisées.') }[action] });
    setPinFor(undefined);
    setConfirm(undefined);
    await reload();
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Txt v="callout" muted>
        {tr('Organizations can ask to read specific information. Nothing is shared until you approve with your digital ID PIN, and you can revoke at any time.', 'Des organismes peuvent demander à consulter certains renseignements. Rien n’est partagé avant votre approbation avec votre NIP, et vous pouvez révoquer en tout temps.')}
      </Txt>
      <ChipRow>
        {(Object.keys(name) as Filter[]).map((f) => (
          <Chip key={f} label={name[f]} on={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ChipRow>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {list.length === 0 && <Empty icon="hand-left-outline" text={tr('No data requests.', 'Aucune demande de données.')} />}
      {list.map((c) => {
        const st = statusOf(c);
        return (
          <Card key={c.id} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="headline">{c.requester}</Txt>
                <Txt v="caption" muted>
                  {pick(c.requesterKind)}
                </Txt>
              </View>
              <Badge label={name[st]} tone={tone[st]} />
            </View>
            <Divider />
            <Row label={tr('Data', 'Données')} value={pick(c.data)} />
            <Row label={tr('Purpose', 'Raison')} value={pick(c.purpose)} />
            <Row label={tr('Requested', 'Demandée le')} value={date(c.requestedAt, lang)} />
            <Row label={st === 'pending' ? tr('Answer by', 'Répondre avant le') : tr('Valid until', 'Valide jusqu’au')} value={date(c.expiresAt, lang)} />
            {(st === 'revoked' || st === 'expired') && (
              <Txt v="caption" muted>
                {tr('No further action. The information shared can no longer be used.', 'Aucune autre action. L’information partagée ne peut plus être utilisée.')}
              </Txt>
            )}
            {pinFor === c.id ? (
              <PinPad title={tr('Enter your digital ID PIN to approve', 'Entrez votre NIP pour approuver')} onComplete={(pin) => decide(c.id, 'approve', pin)} onCancel={() => setPinFor(undefined)} />
            ) : confirm?.id === c.id ? (
              <View style={{ gap: space.sm }}>
                <Notice tone="warning">{confirm.action === 'reject' ? tr('Reject this request?', 'Refuser cette demande?') : tr('Revoke access? The organization can no longer use your data.', 'Révoquer l’accès? L’organisme ne pourra plus utiliser vos données.')}</Notice>
                <Button title={confirm.action === 'reject' ? tr('Reject', 'Refuser') : tr('Revoke', 'Révoquer')} variant="danger" size="md" onPress={() => void decide(c.id, confirm.action)} />
                <Button title={tr('Cancel', 'Annuler')} variant="ghost" size="md" onPress={() => setConfirm(undefined)} />
              </View>
            ) : st === 'pending' ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button title={tr('Approve', 'Approuver')} size="md" icon="checkmark" onPress={() => setPinFor(c.id)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={tr('Reject', 'Refuser')} size="md" variant="secondary" onPress={() => setConfirm({ id: c.id, action: 'reject' })} />
                </View>
              </View>
            ) : st === 'approved' ? (
              <Button title={tr('Revoke access', 'Révoquer l’accès')} size="md" variant="secondary" icon="close-circle-outline" onPress={() => setConfirm({ id: c.id, action: 'revoke' })} />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
