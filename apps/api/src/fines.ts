import { config } from './config.js';
import { newId } from './crypto.js';
import { notify } from './notifications.js';
import type { Store } from './store.js';
import type { CameraEvent, Fine, FineStatus } from './types.js';

/**
 * Victim fine surcharge by set-fine band.
 * PLACEHOLDER SCHEDULE — replace with the official provincial schedule before
 * launch. Kept as data so policy staff can update it without code changes.
 */
const SURCHARGE_BANDS: Array<[maxSetFine: number, surcharge: number]> = [
  [50, 10],
  [75, 15],
  [100, 20],
  [150, 25],
  [200, 30],
  [250, 35],
  [300, 40],
  [350, 60],
  [400, 60],
  [450, 75],
  [500, 75],
];

export const COURT_COSTS = 5;

export function victimFineSurcharge(setFine: number): number {
  for (const [max, surcharge] of SURCHARGE_BANDS) if (setFine <= max) return surcharge;
  return Math.round(setFine * 0.25);
}

export function fineTotals(setFine: number) {
  const vfs = victimFineSurcharge(setFine);
  return { setFine, victimFineSurcharge: vfs, courtCosts: COURT_COSTS, total: setFine + vfs + COURT_COSTS };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Outstanding fines past their due date are reported as overdue. */
export function effectiveStatus(fine: Fine, now = new Date()): FineStatus {
  if (fine.status === 'outstanding' && new Date(fine.dueDate) < now) return 'overdue';
  return fine.status;
}

export type CameraIngestResult =
  | { outcome: 'created'; fineId: string; deliveredVia: 'app' | 'mail' }
  | { outcome: 'duplicate'; fineId: string }
  | { outcome: 'unmatched'; reason: 'plate_not_found' | 'out_of_province' };

/**
 * Turn an automated-enforcement camera event into a fine on the registered
 * owner's account. Camera offences are owner-liability: the ticket follows the
 * plate, not the driver, and carries no demerit points.
 *
 * Idempotent on `event.eventId` so the upstream system can safely retry.
 */
export function ingestCameraEvent(store: Store, event: CameraEvent): CameraIngestResult {
  const existing = store.processedCameraEvents.get(event.eventId);
  if (existing) return { outcome: 'duplicate', fineId: existing };

  const receivedAt = new Date().toISOString();

  if (event.jurisdiction !== config.homeJurisdiction) {
    // Out-of-province plates go through inter-jurisdictional owner lookup.
    store.unmatchedCameraEvents.push({ event, reason: 'out_of_province', receivedAt });
    return { outcome: 'unmatched', reason: 'out_of_province' };
  }

  const vehicle = store.findVehicleByPlate(event.plate, event.jurisdiction);
  if (!vehicle) {
    store.unmatchedCameraEvents.push({ event, reason: 'plate_not_found', receivedAt });
    return { outcome: 'unmatched', reason: 'plate_not_found' };
  }

  const isRedLight = event.type === 'red_light';
  const fine: Fine = {
    id: newId('fine'),
    externalId: event.eventId,
    source: isRedLight ? 'red_light_camera' : 'speed_camera',
    liability: 'owner',
    personId: vehicle.ownerPersonId,
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    offence: isRedLight
      ? 'Fail to stop for red light — vehicle owner (camera)'
      : `Speeding ${event.recordedSpeedKmh} km/h in a ${event.postedLimitKmh} km/h zone — vehicle owner (camera)`,
    statute: isRedLight ? 'Highway Traffic Act — red light camera, owner liability' : 'Highway Traffic Act s.128 — automated speed enforcement, owner liability',
    location: event.location,
    municipality: event.municipality,
    occurredAt: event.capturedAt,
    issuedAt: receivedAt,
    dueDate: addDays(receivedAt, config.fineResponseDays),
    ...fineTotals(event.setFine),
    demeritPoints: 0,
    status: 'outstanding',
    evidence: {
      images: event.images,
      recordedSpeedKmh: event.recordedSpeedKmh,
      postedLimitKmh: event.postedLimitKmh,
      secondsIntoRed: event.secondsIntoRed,
    },
  };
  store.fines.set(fine.id, fine);
  store.processedCameraEvents.set(event.eventId, fine.id);

  // The fine always exists on the owner's record. If they have a digital
  // account we notify in-app + push; otherwise the legacy mailed notice path
  // remains the legal service method.
  const account = store.findAccountByPerson(vehicle.ownerPersonId);
  if (!account) return { outcome: 'created', fineId: fine.id, deliveredVia: 'mail' };

  notify(store, account, {
    category: 'fine',
    title: isRedLight ? 'New red light camera ticket' : 'New speed camera ticket',
    body: `Plate ${vehicle.plate} was recorded at ${event.location} on ${new Date(event.capturedAt).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}. Total payable: $${fine.total.toFixed(2)}. Respond by ${new Date(fine.dueDate).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })}.`,
    link: `/fine/${fine.id}`,
  });
  return { outcome: 'created', fineId: fine.id, deliveredVia: 'app' };
}
