// Parking tickets under Ontario's Administrative Penalty System (APS).
//
// Ontario municipalities (Toronto, Ottawa and others) have moved parking
// enforcement off the provincial-offences court and onto an APS: a parking
// ticket is an administrative "penalty notice", you pay it or ask for a
// screening review (then a hearing), and the timelines/penalties are set by
// by-law. Ottawa's portal (gtechna) spells out the current timeline, which
// this module models:
//
//   • day 0    penalty notice issued (early-payment amount applies)
//   • day 1–15 early-payment period — reduced amount
//   • day 16   set fine applies + Notice of Overdue Parking Penalty
//   • day 45   last day to request a screening review
//   • day 46   Notice of Impending Default
//
// CivicPass does NOT drive the public gtechna pay/dispute webpage (it is a
// session/ViewState-bound JSF app meant for a person with one ticket). It
// integrates with the municipality's parking system: issued tickets are pushed
// to the registered owner by plate ("just show up"), and a ticket can also be
// looked up/added by its penalty-notice number. This module is the framework-
// free core (timeline maths, amount due now, labels), shared by the API and the
// app's demo backend.

import type { L } from './platform.js';

export const APS = {
  /** Early-payment period, in days from issue. */
  earlyPaymentDays: 15,
  /** Set fine + overdue penalty apply on this day. */
  overdueDay: 16,
  /** Last day to request a screening review. */
  screeningReviewDays: 45,
  /** Notice of Impending Default issued on this day. */
  defaultNoticeDay: 46,
  /** Overdue penalty added to the set fine after the early-payment period (placeholder). */
  overduePenalty: 20,
};

/** Where a parking ticket sits on the APS timeline. */
export type ParkingStage = 'early_payment' | 'set_fine' | 'overdue' | 'in_default';

/** Parking-specific fields carried on a Fine with source 'parking'. */
export interface ParkingPenalty {
  /** The "Penalty Notice/Order #" printed on the ticket (gtechna search key). */
  penaltyNoticeNumber: string;
  /** Reduced amount if paid within the early-payment period. */
  earlyAmount: number;
  /** Set fine once the early-payment period ends. */
  setFine: number;
  /** ISO dates computed from the issue date. */
  earlyPaymentUntil: string;
  overdueOn: string;
  screeningReviewBy: string;
  defaultNoticeOn: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Build the APS timeline for a ticket issued at `issuedAt`. */
export function parkingTimeline(input: { penaltyNoticeNumber: string; earlyAmount: number; setFine: number; issuedAt: string }): ParkingPenalty {
  return {
    penaltyNoticeNumber: input.penaltyNoticeNumber,
    earlyAmount: input.earlyAmount,
    setFine: input.setFine,
    earlyPaymentUntil: addDays(input.issuedAt, APS.earlyPaymentDays),
    overdueOn: addDays(input.issuedAt, APS.overdueDay),
    screeningReviewBy: addDays(input.issuedAt, APS.screeningReviewDays),
    defaultNoticeOn: addDays(input.issuedAt, APS.defaultNoticeDay),
  };
}

export function parkingStage(p: ParkingPenalty, now: Date = new Date()): ParkingStage {
  const t = now.getTime();
  if (t < Date.parse(p.earlyPaymentUntil)) return 'early_payment';
  if (t < Date.parse(p.overdueOn)) return 'set_fine';
  if (t < Date.parse(p.defaultNoticeOn)) return 'overdue';
  return 'in_default';
}

/** Amount payable right now: early amount in the discount window, else set fine (+ overdue penalty once overdue). */
export function parkingAmountDue(p: ParkingPenalty, now: Date = new Date()): number {
  const stage = parkingStage(p, now);
  if (stage === 'early_payment') return p.earlyAmount;
  if (stage === 'set_fine') return p.setFine;
  return Math.round((p.setFine + APS.overduePenalty) * 100) / 100;
}

/** Can a screening review still be requested? */
export function canRequestScreening(p: ParkingPenalty, now: Date = new Date()): boolean {
  return now.getTime() <= Date.parse(p.screeningReviewBy);
}

export const PARKING_STAGE_LABEL: Record<ParkingStage, L> = {
  early_payment: { en: 'Early-payment period', fr: 'Période de paiement anticipé' },
  set_fine: { en: 'Set fine due', fr: 'Amende fixée à payer' },
  overdue: { en: 'Overdue', fr: 'En retard' },
  in_default: { en: 'In default', fr: 'En défaut' },
};

export const PARKING_STAGE_TONE: Record<ParkingStage, 'success' | 'info' | 'warning' | 'danger'> = {
  early_payment: 'success',
  set_fine: 'info',
  overdue: 'warning',
  in_default: 'danger',
};

/** One-line explanation of the stage. */
export function parkingStageMessage(p: ParkingPenalty, now: Date = new Date()): L {
  const stage = parkingStage(p, now);
  switch (stage) {
    case 'early_payment':
      return { en: `Pay the reduced amount before the early-payment period ends.`, fr: `Payez le montant réduit avant la fin de la période de paiement anticipé.` };
    case 'set_fine':
      return { en: 'The early-payment period has ended. The set fine now applies.', fr: 'La période de paiement anticipé est terminée. L’amende fixée s’applique.' };
    case 'overdue':
      return { en: 'This penalty is overdue. An overdue penalty has been added.', fr: 'Cette pénalité est en retard. Une pénalité de retard a été ajoutée.' };
    case 'in_default':
      return { en: 'This penalty is in default and may be added to your plate-renewal denial list.', fr: 'Cette pénalité est en défaut et pourrait bloquer le renouvellement de votre plaque.' };
  }
}

/**
 * Dispute options by ticket type. Parking tickets follow the APS
 * (screening review, then hearing); camera and officer-issued tickets follow
 * the provincial-offences court (early resolution, then trial).
 */
export type DisputeOption = 'early_resolution' | 'trial' | 'screening_review' | 'hearing';

export function disputeOptionsFor(source: string): { option: DisputeOption; label: L; body: L }[] {
  if (source === 'parking') {
    return [
      {
        option: 'screening_review',
        label: { en: 'Request a screening review', fr: 'Demander une révision' },
        body: { en: 'A screening officer reviews the penalty with you. You can ask for it within 45 days of the notice.', fr: 'Un agent de révision examine la pénalité avec vous. Vous pouvez en faire la demande dans les 45 jours suivant l’avis.' },
      },
      {
        option: 'hearing',
        label: { en: 'Request a hearing', fr: 'Demander une audience' },
        body: { en: 'An independent hearing officer decides. Available after a screening review.', fr: 'Un agent d’audience indépendant décide. Possible après une révision.' },
      },
    ];
  }
  return [
    {
      option: 'early_resolution',
      label: { en: 'Request a meeting (early resolution)', fr: 'Demander une rencontre (résolution rapide)' },
      body: { en: 'Meet a prosecutor to resolve the ticket without a trial.', fr: 'Rencontrez un procureur pour régler la contravention sans procès.' },
    },
    {
      option: 'trial',
      label: { en: 'Request a trial', fr: 'Demander un procès' },
      body: { en: 'Have your ticket heard by the court.', fr: 'Faites entendre votre contravention par le tribunal.' },
    },
  ];
}
