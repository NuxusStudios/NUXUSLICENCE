import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { FineRow } from '../../components/FineRow';
import { Accordion, Chip, ChipRow } from '../../components/kit';
import { Body, Button, Card, Divider, Empty, ErrorState, Field, IconTile, Loading, Notice, Screen, Segmented, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { DEMO_MODE } from '../../lib/config';
import { money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { space } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Fines() {
  const { t, lang, tr } = useI18n();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [plate, setPlate] = useState<string>('all');
  const { data, error, loading, reload } = useAsync(api.fines);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const open = data!.filter((f) => f.status === 'outstanding' || f.status === 'overdue');
  const plates = [...new Set(data!.map((f) => f.plate ?? 'driver'))];
  const shown = (filter === 'open' ? open : data!).filter((f) => plate === 'all' || (f.plate ?? 'driver') === plate);
  const overdue = open.some((f) => f.status === 'overdue');
  const due = open.reduce((s, f) => s + f.total, 0);

  return (
    <Screen refreshing={loading} onRefresh={reload} title={t('tabFines')} subtitle={`${t('totalDue')} · ${money(due, lang)}`}>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: `${t('filterOpen')} (${open.length})` },
          { value: 'all', label: `${t('filterAll')} (${data!.length})` },
        ]}
      />
      {plates.length > 1 && (
        <ChipRow>
          <Chip label={tr('All', 'Toutes')} on={plate === 'all'} onPress={() => setPlate('all')} />
          {plates.map((p) => (
            <Chip key={p} label={p === 'driver' ? tr('Issued to me', 'À mon nom') : p} icon={p === 'driver' ? 'person' : 'car'} on={plate === p} onPress={() => setPlate(p)} />
          ))}
        </ChipRow>
      )}
      {overdue && <Notice tone="danger">{t('blockedRenewal')}</Notice>}
      {open.length > 1 && (
        <Button
          title={`${tr('Pay all', 'Tout payer')} · ${money(due, lang)}`}
          icon="flash"
          onPress={() => router.push({ pathname: '/pay', params: { kind: 'all-fines', id: 'all', amount: String(due), label: tr(`${open.length} tickets`, `${open.length} contraventions`) } })}
        />
      )}
      <Card style={{ paddingVertical: space.xs }}>
        {shown.length ? (
          shown.map((f, i) => (
            <View key={f.id}>
              {i > 0 && <Divider inset={52} />}
              <FineRow fine={f} />
            </View>
          ))
        ) : (
          <Empty icon="checkmark-done" text={t('noFines')} />
        )}
      </Card>
      <AddTicket onAdded={reload} />
      {DEMO_MODE && <SimulateTicket onCreated={reload} />}
    </Screen>
  );
}

/**
 * Add a ticket by the number printed on it — a paper parking penalty (APS) or a
 * court/camera ticket (POA, by location code + offence number). One card, a
 * single toggle, instead of two near-identical ones.
 */
function AddTicket({ onAdded }: { onAdded: () => Promise<void> }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'parking' | 'court'>('parking');
  const [number, setNumber] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [offenceNumber, setOffenceNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const canSubmit = kind === 'parking' ? number.trim().length >= 3 : locationCode.trim().length >= 2 && offenceNumber.trim().length >= 3;

  async function add() {
    setBusy(true);
    setError(undefined);
    try {
      const res = kind === 'parking' ? await api.addParkingTicket(number.trim()) : await api.addPoaTicket(locationCode.trim(), offenceNumber.trim());
      await onAdded();
      setOpen(false);
      setNumber('');
      setLocationCode('');
      setOffenceNumber('');
      router.push(`/fine/${res.fine.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeader>{tr('Have a ticket we don’t show yet?', 'Une contravention non affichée?')}</SectionHeader>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <IconTile icon="add-circle" />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="strong">{tr('Add a ticket by number', 'Ajouter par numéro')}</Txt>
            <Body muted style={{ fontSize: 14, lineHeight: 20 }}>
              {tr(
                'Camera and plate-matched tickets appear here automatically. For a paper parking ticket or a court/camera ticket, add it by the number printed on it.',
                'Les contraventions de caméra et liées à la plaque apparaissent automatiquement. Pour un billet de stationnement papier ou une contravention judiciaire, ajoutez-la par le numéro qui y figure.',
              )}
            </Body>
          </View>
        </View>
        {open ? (
          <>
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'parking', label: tr('Parking', 'Stationnement') },
                { value: 'court', label: tr('Court / camera', 'Tribunal / caméra') },
              ]}
            />
            {kind === 'parking' ? (
              <Field label={tr('Penalty Notice/Order #', 'Avis de pénalité/ordonnance nº')} value={number} onChangeText={setNumber} autoCapitalize="characters" placeholder="OTT-55512347" />
            ) : (
              <>
                <Field label={tr('Location code', 'Code de lieu')} value={locationCode} onChangeText={setLocationCode} autoCapitalize="characters" placeholder="0311" />
                <Field label={tr('Offence number', 'Numéro d’infraction')} value={offenceNumber} onChangeText={setOffenceNumber} autoCapitalize="characters" placeholder="AJ472210" />
              </>
            )}
            {error && <Notice tone="danger">{error}</Notice>}
            <Button title={tr('Look up and add', 'Rechercher et ajouter')} icon="search" onPress={add} loading={busy} disabled={!canSubmit} />
            <Button title={tr('Cancel', 'Annuler')} variant="ghost" size="md" onPress={() => { setOpen(false); setError(undefined); }} />
          </>
        ) : (
          <Button title={tr('Add by number', 'Ajouter par numéro')} variant="secondary" size="md" icon="add" onPress={() => setOpen(true)} />
        )}
      </Card>
    </>
  );
}

function SimulateTicket({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t, tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ fineId: string; plate: string }>();

  async function simulate(kind: 'camera' | 'parking') {
    setBusy(true);
    try {
      setCreated(await (kind === 'camera' ? api.simulateCameraTicket() : api.simulateParkingTicket()));
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Accordion title={t('demoTools')} icon="construct">
        <Body muted style={{ fontSize: 14, lineHeight: 20 }}>
          {t('simulateTicketBody')}
        </Body>
        {created && (
          <Notice tone="success">
            {t('simulatedTicket')} {created.plate}
          </Notice>
        )}
        {created && <Button title={t('viewTicket')} variant="secondary" size="md" onPress={() => router.push(`/fine/${created.fineId}`)} />}
        <Button title={t('simulateTicket')} icon="videocam" onPress={() => simulate('camera')} loading={busy} />
        <Button title={tr('Simulate a parking ticket', 'Simuler une contravention de stationnement')} variant="secondary" icon="document-text" onPress={() => simulate('parking')} loading={busy} />
      </Accordion>
    </Card>
  );
}
