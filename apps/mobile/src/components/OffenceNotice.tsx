import { Text, View } from 'react-native';
import { cardDate, money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { fonts } from '../lib/theme';
import type { Fine } from '../lib/types';
import { Box, FieldRow, PAPER, Part, Sheet } from './FormSheet';

const TITLE: Record<Fine['source'], [string, string]> = {
  red_light_camera: ['OFFENCE NOTICE', "AVIS D'INFRACTION"],
  speed_camera: ['OFFENCE NOTICE', "AVIS D'INFRACTION"],
  officer_issued: ['OFFENCE NOTICE', "AVIS D'INFRACTION"],
  parking: ['PARKING VIOLATION NOTICE', "AVIS D'INFRACTION DE STATIONNEMENT"],
};

const TIME_FMT = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto' });
const DATE_FMT = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Toronto' });

/** A ticket laid out as the paper notice it replaces. */
export function OffenceNotice({ fine: f }: { fine: Fine }) {
  const { lang } = useI18n();
  const camera = f.source === 'red_light_camera' || f.source === 'speed_camera';
  const subtitle =
    f.source === 'parking'
      ? `Municipal by-law · ${f.municipality}`
      : `${camera ? 'Automated enforcement · ' : ''}Provincial Offences Act · ${f.municipality}`;
  const when = new Date(f.occurredAt);
  const accent = f.status === 'overdue' ? '#8E2A1C' : f.status === 'paid' ? '#155E49' : '#16325C';

  return (
    <Sheet title={TITLE[f.source]} subtitle={subtitle} accent={accent}>
      <FieldRow>
        <Box en="OFFENCE NO" fr="NO D'INFRACTION" value={f.externalId} mono flex={2} />
        <Box en="LIABILITY" fr="RESP." value={f.liability === 'owner' ? 'OWNER / PROPR.' : 'DRIVER / COND.'} />
      </FieldRow>
      <FieldRow>
        <Box en="DATE" fr="DATE" value={DATE_FMT.format(when).replace(/-/g, '/')} mono />
        <Box en="TIME" fr="HEURE" value={TIME_FMT.format(when)} mono />
        {f.plate ? <Box en="PLATE" fr="PLAQUE" value={f.plate} mono /> : null}
      </FieldRow>
      <FieldRow>
        <Box en="LOCATION" fr="LIEU" value={`${f.location.toUpperCase()}\n${f.municipality.toUpperCase()}`} />
      </FieldRow>
      <FieldRow>
        <Box en="OFFENCE" fr="INFRACTION" value={f.offence} />
      </FieldRow>
      <FieldRow>
        <Box en="STATUTE" fr="LOI" value={f.statute} />
      </FieldRow>

      <Part en="AMOUNT" fr="MONTANT" />
      <FieldRow>
        <Box en="SET FINE" fr="AMENDE" value={money(f.setFine, lang)} />
        <Box en="SURCHG" fr="SURAM." value={money(f.victimFineSurcharge, lang)} />
        <Box en="COSTS" fr="FRAIS" value={money(f.courtCosts, lang)} />
      </FieldRow>
      <FieldRow>
        <Box en="TOTAL PAYABLE" fr="TOTAL EXIGIBLE" value={money(f.total, lang)} strong flex={2} />
        <Box en="DEMERIT PTS" fr="POINTS" value={String(f.demeritPoints)} mono />
      </FieldRow>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Text style={{ color: PAPER.muted, fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 0.8 }}>RESPOND BY / RÉPONDRE AVANT</Text>
        <Text style={{ color: f.status === 'overdue' ? '#B42318' : PAPER.ink, fontFamily: fonts.monoBold, fontSize: 13 }}>{cardDate(f.dueDate)}</Text>
      </View>
    </Sheet>
  );
}
