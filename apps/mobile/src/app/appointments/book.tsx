import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bullets, Check, Chip, ChipRow, ResultPanel, Steps } from '../../components/kit';
import { Button, Card, Divider, ListItem, Loading, Notice, Row, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { LOCATIONS, visitName, visitRequirements, type Appointment, type Period, type Slot } from '../../lib/shared/platform';
import { fonts, space } from '../../lib/theme';

/** Book a ServiceOntario or DriveTest visit (Sanad "Book your turn"). */
export default function Book() {
  const params = useLocalSearchParams<{ service?: string; location?: string }>();
  const { tr, pick, lang } = useI18n();
  const [step, setStep] = useState(0);
  const fromLocation = LOCATIONS.find((l) => l.id === params.location);
  const [org, setOrg] = useState<'serviceontario' | 'drivetest'>(fromLocation?.orgId ?? (params.service === 'vision-test' || params.service === 'book-road-test' ? 'drivetest' : 'serviceontario'));
  const [locationId, setLocationId] = useState<string | undefined>(params.location);
  const [serviceId, setServiceId] = useState<string | undefined>(params.service);
  const [dates, setDates] = useState<string[]>([]);
  const [day, setDay] = useState<string>();
  const [slots, setSlots] = useState<Slot[]>();
  const [slot, setSlot] = useState<Slot>();
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [booked, setBooked] = useState<Appointment>();

  const location = LOCATIONS.find((l) => l.id === locationId);
  const steps = [tr('Place and service', 'Lieu et service'), tr('Date and time', 'Date et heure'), tr('Requirements', 'Exigences')];

  async function loadDay(d?: string) {
    if (!locationId) return;
    setSlots(undefined);
    setSlot(undefined);
    const res = await api.slots(locationId, d);
    setDates(res.dates);
    setDay(res.date);
    setSlots(res.slots);
  }

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      setBooked(await api.book({ locationId: locationId!, serviceId: serviceId!, startsAt: slot!.startsAt, acknowledged: ack }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (booked) {
    return (
      <Screen>
        <ResultPanel title={tr('Appointment booked', 'Rendez-vous confirmé')} subtitle={tr('Check in when you arrive to get your queue ticket. Check-in opens 30 minutes before.', 'Enregistrez-vous à votre arrivée pour obtenir votre billet. L’enregistrement ouvre 30 minutes avant.')} />
        <Card style={{ paddingVertical: space.md }}>
          <Row label={tr('Reference', 'Référence')} value={booked.reference} mono />
          <Row label={tr('When', 'Quand')} value={`${booked.date} · ${booked.time}`} />
          <Row label={tr('Where', 'Où')} value={pick(location!.name)} />
          <Row label={tr('For', 'Pour')} value={pick(visitName(booked.serviceId))} />
        </Card>
        <Button title={tr('View appointment', 'Voir le rendez-vous')} onPress={() => router.replace(`/appointments/${booked.id}`)} />
      </Screen>
    );
  }

  const periodName: Record<Period, string> = { morning: tr('Morning', 'Matin'), afternoon: tr('Afternoon', 'Après-midi'), evening: tr('Late afternoon', 'Fin d’après-midi') };
  const fmtDay = (d: string) => new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

  return (
    <Screen>
      <Steps steps={steps} current={step} />
      {step === 0 && (
        <>
          <ChipRow>
            <Chip label="ServiceOntario" on={org === 'serviceontario'} onPress={() => { setOrg('serviceontario'); setLocationId(undefined); setServiceId(undefined); }} />
            <Chip label={tr('DriveTest', 'TestVolant')} on={org === 'drivetest'} onPress={() => { setOrg('drivetest'); setLocationId(undefined); setServiceId(undefined); }} />
          </ChipRow>
          <Txt v="label" muted>
            {tr('Location', 'Bureau')}
          </Txt>
          <Card style={{ paddingVertical: space.xs }}>
            {LOCATIONS.filter((l) => l.orgId === org).map((l, i) => (
              <View key={l.id}>
                {i > 0 && <Divider inset={52} />}
                <ListItem
                  icon={locationId === l.id ? 'radio-button-on' : 'radio-button-off'}
                  title={pick(l.name)}
                  subtitle={`${l.address}, ${l.city}`}
                  onPress={() => {
                    setLocationId(l.id);
                    if (serviceId && !l.services.includes(serviceId)) setServiceId(undefined);
                  }}
                />
              </View>
            ))}
          </Card>
          {location && (
            <>
              <Txt v="label" muted>
                {tr('Service', 'Service')}
              </Txt>
              <ChipRow>
                {location.services.map((s) => (
                  <Chip key={s} label={pick(visitName(s))} on={serviceId === s} onPress={() => setServiceId(s)} />
                ))}
              </ChipRow>
            </>
          )}
          <Notice tone="info">{tr('You can book up to one week ahead.', 'Vous pouvez réserver jusqu’à une semaine à l’avance.')}</Notice>
          <Button
            title={tr('Next', 'Suivant')}
            disabled={!location || !serviceId || !location.services.includes(serviceId)}
            onPress={() => {
              setStep(1);
              void loadDay();
            }}
          />
        </>
      )}

      {step === 1 && (
        <>
          <Txt v="label" muted>
            {tr('Available dates', 'Dates disponibles')}
          </Txt>
          <ChipRow>
            {dates.map((d) => (
              <Chip key={d} label={fmtDay(d)} on={day === d} onPress={() => void loadDay(d)} />
            ))}
          </ChipRow>
          {!slots ? (
            <Loading />
          ) : slots.length === 0 ? (
            <Notice tone="warning">{tr('No times left on this date. Pick another date.', 'Plus de plages ce jour-là. Choisissez une autre date.')}</Notice>
          ) : (
            (['morning', 'afternoon', 'evening'] as Period[]).map((p) => {
              const list = slots.filter((s) => s.period === p);
              return list.length ? (
                <View key={p} style={{ gap: space.sm }}>
                  <Txt v="caption" muted style={{ fontFamily: fonts.semibold }}>
                    {periodName[p]}
                  </Txt>
                  <ChipRow>
                    {list.map((s) => (
                      <Chip key={s.startsAt} label={s.time} on={slot?.startsAt === s.startsAt} onPress={() => setSlot(s)} />
                    ))}
                  </ChipRow>
                </View>
              ) : null;
            })
          )}
          <Button title={tr('Next', 'Suivant')} disabled={!slot} onPress={() => setStep(2)} />
          <Button title={tr('Back', 'Retour')} variant="ghost" size="md" onPress={() => setStep(0)} />
        </>
      )}

      {step === 2 && serviceId && location && slot && (
        <>
          <Card style={{ paddingVertical: space.md }}>
            <Row label={tr('Where', 'Où')} value={pick(location.name)} />
            <Row label={tr('Address', 'Adresse')} value={`${location.address}, ${location.city}`} />
            <Row label={tr('When', 'Quand')} value={`${day} · ${slot.time}`} />
            <Row label={tr('For', 'Pour')} value={pick(visitName(serviceId))} />
          </Card>
          <Card style={{ gap: space.md }}>
            <Txt v="headline">{tr('What to bring', 'À apporter')}</Txt>
            <Txt v="caption" muted>
              {tr('Missing items may mean your appointment is cancelled.', 'S’il manque un élément, votre rendez-vous pourrait être annulé.')}
            </Txt>
            <Bullets items={visitRequirements(serviceId).map(pick)} icon="checkmark-circle-outline" />
            <Check checked={ack} onToggle={() => setAck((v) => !v)}>
              {tr('I have reviewed the requirements and will bring them.', 'J’ai lu les exigences et j’apporterai les documents.')}
            </Check>
          </Card>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button title={tr('Confirm appointment', 'Confirmer le rendez-vous')} icon="checkmark" disabled={!ack} loading={busy} onPress={confirm} />
          <Button title={tr('Back', 'Retour')} variant="ghost" size="md" onPress={() => setStep(1)} />
        </>
      )}
    </Screen>
  );
}
