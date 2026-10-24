// POA court case-status providers, and adding a POA ticket by its location
// code + offence number. Swappable so the real court case-management
// integration drops in without route or model changes.

import { config } from './config.js';
import { newId } from './crypto.js';
import { notify } from './notifications.js';
import { addDays, fineTotals } from './fines.js';
import type { POACaseResult, POACaseCode, POATicketRef } from './shared/poa.js';
import type { Store } from './store.js';
import type { Fine } from './types.js';

export interface POACaseStatusProvider {
  readonly source: 'demo' | 'poa_online';
  /** Status for many tickets in one call, keyed by "locationCode|offenceNumber". */
  check(refs: POATicketRef[]): Promise<Map<string, POACaseResult>>;
  /** Look one ticket up by its printed identifiers (the public search). */
  lookup(ref: POATicketRef): Promise<(POACaseResult & { offence: string; statute: string; location: string; municipality: string; setFine: number; issuedAt: string; found: true }) | { found: false }>;
}

const key = (r: POATicketRef) => `${r.locationCode.replace(/\s/g, '').toUpperCase()}|${r.offenceNumber.replace(/\s/g, '').toUpperCase()}`;

const OFFENCES = [
  { offence: 'Speeding — exceed the posted limit', statute: 'Highway Traffic Act s.128', setFine: 95 },
  { offence: 'Fail to stop at a red light', statute: 'Highway Traffic Act s.144(18)', setFine: 325 },
  { offence: 'Fail to obey a stop sign', statute: 'Highway Traffic Act s.136', setFine: 110 },
  { offence: 'Use a hand-held device while driving', statute: 'Highway Traffic Act s.78.1', setFine: 615 },
  { offence: 'Fail to wear a seat belt', statute: 'Highway Traffic Act s.106', setFine: 240 },
];

/**
 * Deterministic case status with no network. A ticket's status is derived from
 * its identifiers so a given demo ticket always reads the same, and an override
 * map lets the demo tool and tests move a case to convicted / in default.
 */
export class DemoPOACaseStatusProvider implements POACaseStatusProvider {
  readonly source = 'demo' as const;
  private overrides = new Map<string, POACaseCode>();

  setOverride(ref: POATicketRef, code: POACaseCode | null): void {
    const k = key(ref);
    if (code) this.overrides.set(k, code);
    else this.overrides.delete(k);
  }

  private hash(k: string): number {
    let h = 2166136261;
    for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  private result(ref: POATicketRef, setFine: number, issuedAt: string): POACaseResult {
    const k = key(ref);
    const code = this.overrides.get(k) ?? ((): POACaseCode => {
      const b = this.hash(k) % 100;
      if (b < 70) return 'before_court';
      if (b < 82) return 'convicted';
      if (b < 90) return 'early_resolution_scheduled';
      if (b < 96) return 'trial_scheduled';
      return 'paid';
    })();
    const totals = fineTotals(setFine);
    const now = new Date();
    switch (code) {
      case 'convicted':
        return { code, amountOwing: totals.total, fineDueOn: addDays(now.toISOString(), 15) };
      case 'in_default':
        return { code, amountOwing: totals.total };
      case 'early_resolution_scheduled':
        return { code, amountOwing: 0, nextEvent: { kind: 'early_resolution', at: addDays(now.toISOString(), 21), location: 'Provincial Offences Court' } };
      case 'trial_scheduled':
        return { code, amountOwing: 0, nextEvent: { kind: 'trial', at: addDays(now.toISOString(), 45), location: 'Provincial Offences Court' } };
      case 'paid':
      case 'withdrawn':
        return { code, amountOwing: 0 };
      default:
        return { code: 'before_court', amountOwing: 0 };
    }
  }

  async check(refs: POATicketRef[]): Promise<Map<string, POACaseResult>> {
    const out = new Map<string, POACaseResult>();
    for (const r of refs) out.set(key(r), this.result(r, 95, new Date().toISOString()));
    return out;
  }

  async lookup(ref: POATicketRef) {
    const k = key(ref);
    // Offence numbers ending in 0 are treated as "not in the system yet".
    if (ref.offenceNumber.replace(/\s/g, '').endsWith('0')) return { found: false as const };
    const h = this.hash(k);
    const o = OFFENCES[h % OFFENCES.length]!;
    const issuedAt = addDays(new Date().toISOString(), -((h % 20) + 11)); // 11–30 days ago (past the 10-day lag)
    const r = this.result(ref, o.setFine, issuedAt);
    return { ...r, found: true as const, offence: o.offence, statute: o.statute, location: 'Provincial Offences Court', municipality: 'Toronto', setFine: o.setFine, issuedAt };
  }
}

/**
 * POA Online Services provider (production): reads status from the court
 * case-management integration behind justiceservices.jus.gov.on.ca/POA — NOT
 * the public JSF search page (session/ViewState-bound, human-only). Shape is
 * the seam; finalized against the integration spec. Refuses without an endpoint.
 */
export class POAOnlineProvider implements POACaseStatusProvider {
  readonly source = 'poa_online' as const;
  constructor(
    private endpoint: string,
    private apiKey: string,
  ) {}

  async check(refs: POATicketRef[]): Promise<Map<string, POACaseResult>> {
    const res = await fetch(`${this.endpoint}/cases/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({ tickets: refs }),
    });
    if (!res.ok) throw new Error(`POA case feed returned ${res.status}`);
    const body = (await res.json()) as { results: ({ locationCode: string; offenceNumber: string } & POACaseResult)[] };
    const out = new Map<string, POACaseResult>();
    for (const r of body.results) out.set(key(r), r);
    return out;
  }

  async lookup(ref: POATicketRef) {
    const res = await fetch(`${this.endpoint}/cases/${encodeURIComponent(ref.locationCode)}/${encodeURIComponent(ref.offenceNumber)}`, { headers: { 'x-api-key': this.apiKey } });
    if (res.status === 404) return { found: false as const };
    if (!res.ok) throw new Error(`POA case lookup returned ${res.status}`);
    return { found: true as const, ...((await res.json()) as POACaseResult & { offence: string; statute: string; location: string; municipality: string; setFine: number; issuedAt: string }) };
  }
}

let provider: POACaseStatusProvider = buildFromConfig();

function buildFromConfig(): POACaseStatusProvider {
  if (config.poa.provider === 'poa_online') {
    const { endpoint, apiKey } = config.poa;
    if (!endpoint || !apiKey) throw new Error('POA_ENDPOINT and POA_API_KEY must be set when POA_PROVIDER=poa_online');
    return new POAOnlineProvider(endpoint, apiKey);
  }
  return new DemoPOACaseStatusProvider();
}

export function getPOAProvider(): POACaseStatusProvider {
  return provider;
}
export function setPOAProvider(p: POACaseStatusProvider): void {
  provider = p;
}

export const poaKey = key;

/**
 * Add a POA ticket by its location code + offence number (what the public
 * search does), matched to the person. Returns the created/duplicate fine.
 */
export async function addPOATicketByNumber(store: Store, personId: string, ref: POATicketRef): Promise<{ outcome: 'created' | 'duplicate' | 'not_found'; fineId?: string }> {
  const k = key(ref);
  const existing = store.processedPoaTickets.get(k);
  if (existing) {
    const fine = store.fines.get(existing);
    if (fine && fine.personId === personId) return { outcome: 'duplicate', fineId: existing };
  }
  const result = await getPOAProvider().lookup(ref);
  if (!result.found) return { outcome: 'not_found' };
  const totals = fineTotals(result.setFine);
  const fine: Fine = {
    id: newId('fine'),
    externalId: `${ref.locationCode}-${ref.offenceNumber}`,
    source: 'officer_issued',
    liability: 'driver',
    personId,
    offence: result.offence,
    statute: result.statute,
    location: result.location,
    municipality: result.municipality,
    occurredAt: result.issuedAt,
    issuedAt: result.issuedAt,
    dueDate: addDays(result.issuedAt, config.fineResponseDays),
    ...totals,
    demeritPoints: 0,
    status: 'outstanding',
    poaRef: { locationCode: ref.locationCode, offenceNumber: ref.offenceNumber },
  };
  store.fines.set(fine.id, fine);
  store.processedPoaTickets.set(k, fine.id);
  const account = store.findAccountByPerson(personId);
  if (account) notify(store, account, { category: 'fine', title: 'Ticket added', body: `${result.offence} — ${result.municipality}. We'll keep its court status up to date.`, link: `/fine/${fine.id}` });
  return { outcome: 'created', fineId: fine.id };
}
