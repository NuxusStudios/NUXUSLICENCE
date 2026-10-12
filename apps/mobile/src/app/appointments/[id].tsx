import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Bullets, ResultPanel, useAppointmentStatus } from '../../components/kit';
import { Badge, Button, Card, ErrorState, Loading, Notice, Row, Screen, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { LOCATIONS, checkInWindow, visitName, visitRequirements } from '../../lib/shared/platform';
import { fonts, radius, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const { tr, pick, lang } = useI18n();
  const status = useAppointmentStatus();
  const { data, error, loading, reload } = useAsync(() => api.appointment(id), id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Re-evaluate the check-in window while the screen is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const a = data!;
  const loc = LOCATIONS.find((l) => l.id === a.locationId)!;
  const w = checkInWindow(a);
  const canCheckIn = a.status === 'upcoming' && now >= w.opensAt && now <= w.closesAt;
  const st = status(a);

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
      {a.ticket ? (
        <>
          <ResultPanel title={tr('Your ticket', 'Votre billet')} subtitle={tr('Watch the screen or listen for your number.', 'Surveillez l’écran ou écoutez l’appel de votre numéro.')} />
          <View style={{ alignSelf: 'center', paddingHorizontal: space.xxl, paddingVertical: space.lg, borderRadius: radius.lg, backgroundColor: c.primary }} accessibilityLabel={`${tr('Ticket', 'Billet')} ${a.ticket.number}`}>
            <Text style={{ color: c.primaryText, fontFamily: fonts.monoBold, fontSize: 48, letterSpacing: 4 }}>{a.ticket.number}</Text>
          </View>
          <Card style={{ paddingVertical: space.md }}>
            <Row label={tr('Status', 'Statut')} value={tr('Awaiting call', 'En attente de l’appel')} />
            <Row label={tr('People ahead', 'Personnes devant vous')} value={String(a.ticket.peopleAhead)} />
            <Row label={tr('Issued', 'Émis')} value={dateTime(a.ticket.issuedAt, lang)} />
          </Card>
        </>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="title">
            {a.date} · {a.time}
          </Txt>
          <Badge label={st.label} tone={st.tone} />
        </View>
      )}

      <Card style={{ paddingVertical: space.md }}>
        <Row label={tr('Reference', 'Référence')} value={a.reference} mono />
        <Row label={tr('For', 'Pour')} value={pick(visitName(a.serviceId))} />
        <Row label={tr('Where', 'Où')} value={pick(loc.name)} />
        <Row label={tr('Address', 'Adresse')} value={`${loc.address}, ${loc.city}`} />
        <Row label={tr('Hours', 'Heures')} value={pick(loc.hours)} />
      </Card>

      {a.status === 'upcoming' && (
        <>
          {canCheckIn ? (
            <Button title={tr('Check in and get my ticket', 'M’enregistrer et obtenir mon billet')} icon="ticket" loading={busy} onPress={() => void act(() => api.checkIn(a.id))} />
          ) : (
            <Notice tone="info">{tr('Check-in opens 30 minutes before your appointment.', 'L’enregistrement ouvre 30 minutes avant votre rendez-vous.')}</Notice>
          )}
        </>
      )}

      <SectionHeader>{tr('What to bring', 'À apporter')}</SectionHeader>
      <Card>
        <Bullets items={visitRequirements(a.serviceId).map(pick)} icon="checkmark-circle-outline" />
      </Card>

      <Button title={tr('Directions', 'Itinéraire')} variant="secondary" icon="navigate" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.address}, ${loc.city}, ON`)}`)} />
      {message && <Notice tone="danger">{message}</Notice>}
      {a.status === 'upcoming' &&
        (confirmCancel ? (
          <Card style={{ gap: space.sm }}>
            <Notice tone="warning">{tr('Cancel this appointment?', 'Annuler ce rendez-vous?')}</Notice>
            <Button title={tr('Cancel appointment', 'Annuler le rendez-vous')} variant="danger" loading={busy} onPress={() => void act(() => api.cancelAppointment(a.id))} />
            <Button title={tr('Keep it', 'Le garder')} variant="ghost" size="md" onPress={() => setConfirmCancel(false)} />
          </Card>
        ) : (
          <Button title={tr('Cancel appointment', 'Annuler le rendez-vous')} variant="ghost" size="md" icon="close-circle-outline" onPress={() => setConfirmCancel(true)} />
        ))}
    </Screen>
  );
}
