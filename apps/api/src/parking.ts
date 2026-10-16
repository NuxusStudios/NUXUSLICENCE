// Parking tickets: ingestion ("just show up") and the authority provider
// (look up / confirm a ticket by its penalty-notice number — what Ottawa's
// gtechna portal search does). Swappable so the real municipal integration
// drops in without route or model changes.

import { config } from './config.js';
import { newId, referenceNumber } from './crypto.js';
import { notify } from './notifications.js';
import { addDays } from './fines.js';
import { parkingAmountDue, parkingTimeline, type ParkingPenalty } from './shared/parking.js';
import type { Store } from './store.js';
import type { Fine } from './types.js';

/** A parking ticket as the municipality's enforcement system reports it. */
export interface ParkingEvent {
  /** Idempotency + the gtechna "Penalty Notice/Order #". */
  penaltyNoticeNumber: string;
  plate: string;
  jurisdiction: string;
  offence: string;
  bylaw: string;
  location: string;
  municipality: string;
  issuedAt: string;
  /** Reduced early-payment amount and the full set fine. */
  earlyAmount: number;
  setFine: number;
}

export type ParkingIngestResult =
  | { outcome: 'created'; fineId: string; deliveredVia: 'app' | 'mail' }
  | { outcome: 'duplicate'; fineId: string }
  | { outcome: 'unmatched'; reason: 'plate_not_found' | 'out_of_province' };

function buildParkingFine(store: Store, event: ParkingEvent, ownerPersonId: string, vehicleId: string, plate: string): Fine {
  const parking: ParkingPenalty = parkingTimeline({ penaltyNoticeNumber: event.penaltyNoticeNumber, earlyAmount: event.earlyAmount, setFine: event.setFine, issuedAt: event.issuedAt });
  return {
    id: newId('fine'),
    externalId: event.penaltyNoticeNumber,
    source: 'parking',
    liability: 'owner',
    personId: ownerPersonId,
    vehicleId,
    plate,
    offence: event.offence,
    statute: event.bylaw,
    location: event.location,
    municipality: event.municipality,
    occurredAt: event.issuedAt,
    issuedAt: event.issuedAt,
    // Administrative deadline is the screening-review window, not a POA response date.
    dueDate: parking.screeningReviewBy,
    setFine: event.setFine,
    victimFineSurcharge: 0,
    courtCosts: 0,
    total: event.setFine,
    demeritPoints: 0,
    status: 'outstanding',
    parking,
  };
}

/**
 * Push an issued parking ticket onto the registered owner's account by plate.
 * This is the "just show up" path. Idempotent on the penalty-notice number.
 */
export function ingestParkingEvent(store: Store, event: ParkingEvent): ParkingIngestResult {
  const existing = store.processedParkingEvents.get(event.penaltyNoticeNumber);
  if (existing) return { outcome: 'duplicate', fineId: existing };

  const receivedAt = new Date().toISOString();
  if (event.jurisdiction !== config.homeJurisdiction) {
    store.unmatchedParkingEvents.push({ event, reason: 'out_of_province', receivedAt });
    return { outcome: 'unmatched', reason: 'out_of_province' };
  }
  const vehicle = store.findVehicleByPlate(event.plate, event.jurisdiction);
  if (!vehicle) {
    store.unmatchedParkingEvents.push({ event, reason: 'plate_not_found', receivedAt });
    return { outcome: 'unmatched', reason: 'plate_not_found' };
  }

  const fine = buildParkingFine(store, event, vehicle.ownerPersonId, vehicle.id, vehicle.plate);
  store.fines.set(fine.id, fine);
  store.processedParkingEvents.set(event.penaltyNoticeNumber, fine.id);

  const account = store.findAccountByPerson(vehicle.ownerPersonId);
  if (!account) return { outcome: 'created', fineId: fine.id, deliveredVia: 'mail' };
  notify(store, account, {
    category: 'fine',
    title: 'New parking ticket',
    body: `Plate ${vehicle.plate} — ${event.offence} at ${event.location}. Pay $${parkingAmountDue(fine.parking!).toFixed(2)} before ${new Date(fine.parking!.earlyPaymentUntil).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })} (early-payment amount).`,
    link: `/fine/${fine.id}`,
  });
  return { outcome: 'created', fineId: fine.id, deliveredVia: 'app' };
}

// ---------------------------------------------------------------------------
// Authority provider: look up a ticket by its penalty-notice number.
// ---------------------------------------------------------------------------

export interface ParkingLookupResult extends ParkingEvent {
  found: true;
}

export interface ParkingAuthorityProvider {
  readonly source: 'demo' | 'gtechna';
  /** Look up one ticket by its penalty-notice number (gtechna's search). */
  lookup(penaltyNoticeNumber: string): Promise<ParkingLookupResult | { found: false }>;
}

const OFFENCES: { offence: string; bylaw: string; setFine: number; early: number }[] = [
  { offence: 'Park on a street during a prohibited time', bylaw: 'Parking by-law — prohibited time', setFine: 55, early: 40 },
  { offence: 'Stop in a no-stopping zone', bylaw: 'Parking by-law — no stopping', setFine: 75, early: 55 },
  { offence: 'Park in a disabled parking space without a permit', bylaw: 'Parking by-law — accessible space', setFine: 450, early: 450 },
  { offence: 'Exceed the posted time limit', bylaw: 'Parking by-law — time limit', setFine: 40, early: 30 },
  { offence: 'Park within 3 metres of a fire hydrant', bylaw: 'Parking by-law — fire hydrant', setFine: 105, early: 85 },
];

/**
 * Demo provider: a penalty-notice number deterministically resolves to a
 * ticket (so "add a ticket by number" and tests are reproducible). Numbers
 * ending in 0 are treated as "not found".
 */
export class DemoParkingAuthorityProvider implements ParkingAuthorityProvider {
  readonly source = 'demo' as const;
  constructor(private municipality = 'Ottawa') {}

  async lookup(penaltyNoticeNumber: string): Promise<ParkingLookupResult | { found: false }> {
    const key = penaltyNoticeNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!key || key.endsWith('0')) return { found: false };
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const o = OFFENCES[h % OFFENCES.length]!;
    // Issued a few days ago so the ticket is still inside the early-payment window.
    const issuedAt = addDays(new Date().toISOString(), -((h % 5) + 1));
    return {
      found: true,
      penaltyNoticeNumber,
      plate: '',
      jurisdiction: config.homeJurisdiction,
      offence: o.offence,
      bylaw: o.bylaw,
      location: `${100 + (h % 900)} Sample Street`,
      municipality: this.municipality,
      issuedAt,
      earlyAmount: o.early,
      setFine: o.setFine,
    };
  }
}

/**
 * gtechna provider (production): looks a ticket up through the municipality's
 * parking system integration (vendor: gtechna). NOT the public JSF pay/dispute
 * webpage — that is a session/ViewState-bound, human-only page. Shape is the
 * seam; finalized against the municipal integration spec. Refuses without an
 * endpoint so a misconfigured production deploy fails loudly.
 */
export class GtechnaParkingProvider implements ParkingAuthorityProvider {
  readonly source = 'gtechna' as const;
  constructor(
    private endpoint: string,
    private apiKey: string,
  ) {}

  async lookup(penaltyNoticeNumber: string): Promise<ParkingLookupResult | { found: false }> {
    const res = await fetch(`${this.endpoint}/tickets/${encodeURIComponent(penaltyNoticeNumber)}`, { headers: { 'x-api-key': this.apiKey } });
    if (res.status === 404) return { found: false };
    if (!res.ok) throw new Error(`parking authority returned ${res.status}`);
    return { found: true, ...((await res.json()) as ParkingEvent) };
  }
}

let provider: ParkingAuthorityProvider = buildFromConfig();

function buildFromConfig(): ParkingAuthorityProvider {
  if (config.parking.provider === 'gtechna') {
    const { endpoint, apiKey } = config.parking;
    if (!endpoint || !apiKey) throw new Error('PARKING_ENDPOINT and PARKING_API_KEY must be set when PARKING_PROVIDER=gtechna');
    return new GtechnaParkingProvider(endpoint, apiKey);
  }
  return new DemoParkingAuthorityProvider();
}

export function getParkingProvider(): ParkingAuthorityProvider {
  return provider;
}
export function setParkingProvider(p: ParkingAuthorityProvider): void {
  provider = p;
}

/**
 * Add a ticket the user already holds (e.g. a paper ticket) by its penalty-
 * notice number: look it up, confirm it belongs to one of the user's plates,
 * and attach it to their account. Returns the created/duplicate fine id.
 */
export async function addTicketByNumber(store: Store, personId: string, penaltyNoticeNumber: string): Promise<{ outcome: 'created' | 'duplicate' | 'not_found' | 'not_your_plate'; fineId?: string }> {
  const existing = store.processedParkingEvents.get(penaltyNoticeNumber);
  if (existing) {
    const fine = store.fines.get(existing);
    if (fine && fine.personId === personId) return { outcome: 'duplicate', fineId: existing };
  }
  const result = await getParkingProvider().lookup(penaltyNoticeNumber);
  if (!result.found) return { outcome: 'not_found' };
  // Match to one of this person's vehicles. The demo provider returns no plate,
  // so the user confirms ownership by holding the ticket; production matches the
  // plate on the authority's record to the person's registered plates.
  const vehicles = store.vehiclesFor(personId);
  if (result.plate && !vehicles.some((v) => v.plate.replace(/[^A-Z0-9]/gi, '').toUpperCase() === result.plate.replace(/[^A-Z0-9]/gi, '').toUpperCase())) {
    return { outcome: 'not_your_plate' };
  }
  const vehicle = result.plate ? store.findVehicleByPlate(result.plate, result.jurisdiction) : vehicles[0];
  const fine = buildParkingFine(store, result, personId, vehicle?.id ?? '', vehicle?.plate ?? result.plate);
  store.fines.set(fine.id, fine);
  store.processedParkingEvents.set(penaltyNoticeNumber, fine.id);
  const account = store.findAccountByPerson(personId);
  if (account) {
    notify(store, account, { category: 'fine', title: 'Parking ticket added', body: `${fine.offence} — ${fine.municipality}. Reference ${referenceNumber('PK')}.`, link: `/fine/${fine.id}` });
  }
  return { outcome: 'created', fineId: fine.id };
}
