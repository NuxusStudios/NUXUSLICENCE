// Court case status for Provincial Offences Act (POA) tickets.
//
// Camera tickets (red light / speed) and officer-issued tickets are
// prosecuted in the provincial-offences court, not the municipal APS that
// parking uses. Ontario publishes their case status through POA Online
// Services (justiceservices.jus.gov.on.ca/POA): you look a ticket up by the
// ICON **location code** + **offence number** printed on it (or the case
// number on a summons) and see where it stands — before the court, a meeting
// or trial scheduled, convicted with a fine owing, paid, or in default.
//
// That service is a session-bound JSF app with a 20-minute timeout, built for
// a person with a ticket in hand; it can't list a person's cases and can't be
// safely automated. CivicPass instead refreshes the court status of the POA
// tickets already on the account (camera/officer, matched to the owner/driver),
// and lets a user add a POA ticket by its location code + offence number — the
// same identifiers the public search uses. Production reads status from the
// court case-management integration behind that page.
//
// This module is the framework-free core: the case lifecycle, amount owing,
// next court event, the refresh policy, and bilingual labels. Shared by the API
// and the app's demo backend. POA Online Services excludes parking, criminal
// matters, appeals and young people — so do we here.

import type { L } from './platform.js';

/** Where a POA ticket sits in the court process. */
export type POACaseCode =
  | 'before_court'
  | 'early_resolution_scheduled'
  | 'trial_scheduled'
  | 'convicted'
  | 'paid'
  | 'in_default'
  | 'withdrawn'
  | 'not_found';

export type POACaseSource = 'poa_online' | 'demo' | 'manual';

/** A scheduled court event (meeting or trial). */
export interface POACourtEvent {
  kind: 'early_resolution' | 'trial';
  at: string;
  location: string;
}

/** Live court status stored on a POA ticket, refreshed automatically. */
export interface POACaseStatus {
  code: POACaseCode;
  /** Amount owing to the court right now (0 unless convicted/in default). */
  amountOwing: number;
  /** Set when a fine is owing. */
  fineDueOn?: string;
  /** Set for the scheduled statuses. */
  nextEvent?: POACourtEvent;
  checkedAt: string;
  nextCheckAt: string;
  source: POACaseSource;
}

/** The provider's answer for one ticket, before timestamps are applied. */
export interface POACaseResult {
  code: POACaseCode;
  amountOwing: number;
  fineDueOn?: string;
  nextEvent?: POACourtEvent;
}

/** The identifiers printed on a POA ticket (what the public search takes). */
export interface POATicketRef {
  /** ICON location code (court location on the ticket). */
  locationCode: string;
  /** Offence number on the ticket. */
  offenceNumber: string;
}

export function buildPOACaseStatus(result: POACaseResult, opts: { source: POACaseSource; now: Date; recheckSeconds: number }): POACaseStatus {
  return {
    code: result.code,
    amountOwing: result.amountOwing,
    ...(result.fineDueOn ? { fineDueOn: result.fineDueOn } : {}),
    ...(result.nextEvent ? { nextEvent: result.nextEvent } : {}),
    checkedAt: opts.now.toISOString(),
    nextCheckAt: new Date(opts.now.getTime() + opts.recheckSeconds * 1000).toISOString(),
    source: opts.source,
  };
}

/** Refresh on app open, with a floor so one open doesn't fan out to the court feed. */
export function poaShouldRefresh(status: POACaseStatus | undefined, now: Date, minAgeSeconds: number): boolean {
  if (!status) return true;
  return now.getTime() - new Date(status.checkedAt).getTime() >= minAgeSeconds * 1000;
}

/** A change worth alerting the holder about (conviction or default). */
export function poaIsAdverseChange(from: POACaseStatus | undefined, to: POACaseStatus): boolean {
  const bad = (c: POACaseCode) => c === 'convicted' || c === 'in_default';
  return bad(to.code) && (!from || !bad(from.code));
}

export const POA_CASE_LABEL: Record<POACaseCode, L> = {
  before_court: { en: 'Before the court', fr: 'Devant le tribunal' },
  early_resolution_scheduled: { en: 'Meeting scheduled', fr: 'Rencontre fixée' },
  trial_scheduled: { en: 'Trial scheduled', fr: 'Procès fixé' },
  convicted: { en: 'Convicted — fine owing', fr: 'Déclaré coupable — amende due' },
  paid: { en: 'Paid — closed', fr: 'Payée — classée' },
  in_default: { en: 'Fine in default', fr: 'Amende en défaut' },
  withdrawn: { en: 'Withdrawn', fr: 'Retirée' },
  not_found: { en: 'Not in the system yet', fr: 'Pas encore au système' },
};

export const POA_CASE_TONE: Record<POACaseCode, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  before_court: 'info',
  early_resolution_scheduled: 'info',
  trial_scheduled: 'info',
  convicted: 'warning',
  paid: 'success',
  in_default: 'danger',
  withdrawn: 'success',
  not_found: 'neutral',
};

/** One-line explanation of what the status means / what to do. */
export function poaCaseMessage(status: POACaseStatus): L {
  switch (status.code) {
    case 'before_court':
      return { en: 'Your ticket is before the court. You can pay it, request a meeting with a prosecutor, or request a trial.', fr: 'Votre contravention est devant le tribunal. Vous pouvez la payer, demander une rencontre avec un procureur ou demander un procès.' };
    case 'early_resolution_scheduled':
      return { en: 'A meeting with a prosecutor is scheduled. Bring your evidence.', fr: 'Une rencontre avec un procureur est fixée. Apportez vos preuves.' };
    case 'trial_scheduled':
      return { en: 'A trial is scheduled. Attend on the date shown or the case may proceed without you.', fr: 'Un procès est fixé. Présentez-vous à la date indiquée, sinon l’affaire peut se poursuivre sans vous.' };
    case 'convicted':
      return { en: 'You were convicted. Pay the fine by the due date to avoid default.', fr: 'Vous avez été déclaré coupable. Payez l’amende avant l’échéance pour éviter le défaut.' };
    case 'paid':
      return { en: 'The fine is paid and the case is closed.', fr: 'L’amende est payée et l’affaire est classée.' };
    case 'in_default':
      return { en: 'The fine is unpaid and in default. This can block your plate renewal and be sent to collections.', fr: 'L’amende est impayée et en défaut. Cela peut bloquer le renouvellement de votre plaque et être transmis au recouvrement.' };
    case 'withdrawn':
      return { en: 'The charge was withdrawn. Nothing is owing.', fr: 'L’accusation a été retirée. Rien n’est dû.' };
    case 'not_found':
      return { en: 'This ticket isn’t in the court system yet. It can take 10 or more days to appear.', fr: 'Cette contravention n’est pas encore au système judiciaire. Cela peut prendre 10 jours ou plus.' };
  }
}

/** POA Online Services covers these ticket kinds (not parking, which uses the APS). */
export function isPOASource(source: string): boolean {
  return source === 'red_light_camera' || source === 'speed_camera' || source === 'officer_issued';
}

export const POA_EXCLUDED_NOTE: L = {
  en: 'POA Online Services does not cover parking, criminal matters, appeals or young people.',
  fr: 'Les services en ligne de la LIP ne visent pas le stationnement, les affaires criminelles, les appels ni les adolescents.',
};
