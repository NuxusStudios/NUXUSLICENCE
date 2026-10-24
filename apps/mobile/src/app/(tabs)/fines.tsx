import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { FineRow } from '../../components/FineRow';
import { Chip, ChipRow } from '../../components/kit';
import { Body, Button, Card, Divider, Empty, ErrorState, Field, IconTile, Loading, Notice, Screen, Segmented, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { DEMO_MODE } from '../../lib/config';
import { money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Fines() {
  const c = useTheme();
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
      <AddParkingTicket onAdded={reload} />
      <AddCourtTicket onAdded={reload} />
      {DEMO_MODE && <SimulateTicket onCreated={reload} accent={c.accent} />}
    </Screen>
  );
}

/** Add a POA court ticket by its location code + offence number (POA Online Services lookup). */
function AddCourtTicket({ onAdded }: { onAdded: () => Promise<void> }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [locationCode, setLocationCode] = useState('');
  const [offenceNumber, setOffenceNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function add() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.addPoaTicket(locationCode.trim(), offenceNumber.trim());
      await onAdded();
      setOpen(false);
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
      <SectionHeader>{tr('Have a court ticket?', 'Vous avez une contravention judiciaire?')}</SectionHeader>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <IconTile icon="business" />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="strong">{tr('Add a court (POA) ticket', 'Ajouter une contravention (LIP)')}</Txt>
            <Body muted style={{ fontSize: 14, lineHeight: 20 }}>
              {tr('Red-light, speed-camera and officer-issued tickets appear here automatically. To track another, enter the location code and offence number printed on it, and we’ll keep its court status up to date.', 'Les contraventions de feu rouge, de radar et remises par un agent apparaissent ici automatiquement. Pour en suivre une autre, entrez le code de lieu et le numéro d’infraction qui y figurent; nous suivrons son état judiciaire.')}
            </Body>
          </View>
        </View>
        {open ? (
          <>
            <Field label={tr('Location code', 'Code de lieu')} value={locationCode} onChangeText={setLocationCode} autoCapitalize="characters" placeholder="0311" />
            <Field label={tr('Offence number', 'Numéro d’infraction')} value={offenceNumber} onChangeText={setOffenceNumber} autoCapitalize="characters" placeholder="AJ472210" />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button title={tr('Look up and add', 'Rechercher et ajouter')} icon="search" onPress={add} loading={busy} disabled={locationCode.trim().length < 2 || offenceNumber.trim().length < 3} />
            <Button title={tr('Cancel', 'Annuler')} variant="ghost" size="md" onPress={() => { setOpen(false); setError(undefined); }} />
          </>
        ) : (
          <Button title={tr('Add by number', 'Ajouter par numéro')} variant="secondary" size="md" icon="add" onPress={() => setOpen(true)} />
        )}
      </Card>
    </>
  );
}

/** Add a parking ticket by its penalty-notice number (gtechna-style lookup). */
function AddParkingTicket({ onAdded }: { onAdded: () => Promise<void> }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function add() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.addParkingTicket(number.trim());
      await onAdded();
      setOpen(false);
      setNumber('');
      router.push(`/fine/${res.fine.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeader>{tr('Have a paper ticket?', 'Vous avez un billet papier?')}</SectionHeader>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <IconTile icon="document-text" />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="strong">{tr('Add a parking ticket', 'Ajouter une contravention de stationnement')}</Txt>
            <Body muted style={{ fontSize: 14, lineHeight: 20 }}>
              {tr('Camera and plate-matched tickets appear here automatically. For a paper ticket, enter the penalty notice number.', 'Les contraventions de caméra et liées à la plaque apparaissent ici automatiquement. Pour un billet papier, entrez le numéro d’avis de pénalité.')}
            </Body>
          </View>
        </View>
        {open ? (
          <>
            <Field label={tr('Penalty Notice/Order #', 'Avis de pénalité/ordonnance nº')} value={number} onChangeText={setNumber} autoCapitalize="characters" placeholder="OTT-55512347" />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button title={tr('Look up and add', 'Rechercher et ajouter')} icon="search" onPress={add} loading={busy} disabled={number.trim().length < 3} />
            <Button title={tr('Cancel', 'Annuler')} variant="ghost" size="md" onPress={() => { setOpen(false); setError(undefined); }} />
          </>
        ) : (
          <Button title={tr('Add by number', 'Ajouter par numéro')} variant="secondary" size="md" icon="add" onPress={() => setOpen(true)} />
        )}
      </Card>
    </>
  );
}

function SimulateTicket({ onCreated }: { onCreated: () => Promise<void>; accent: string }) {
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
    <>
      <SectionHeader>{t('demoTools')}</SectionHeader>
      <Card>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <IconTile icon="videocam" />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="strong">{t('simulateTicket')}</Txt>
            <Body muted style={{ fontSize: 14, lineHeight: 20 }}>
              {t('simulateTicketBody')}
            </Body>
          </View>
        </View>
        {created && (
          <Notice tone="success">
            {t('simulatedTicket')} {created.plate}
          </Notice>
        )}
        {created && <Button title={t('viewTicket')} variant="secondary" size="md" onPress={() => router.push(`/fine/${created.fineId}`)} />}
        <Button title={t('simulateTicket')} icon="videocam" onPress={() => simulate('camera')} loading={busy} />
        <Button title={tr('Simulate a parking ticket', 'Simuler une contravention de stationnement')} variant="secondary" icon="document-text" onPress={() => simulate('parking')} loading={busy} />
      </Card>
    </>
  );
}
