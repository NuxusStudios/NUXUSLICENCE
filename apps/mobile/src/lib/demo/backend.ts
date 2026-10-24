// In-app demo backend. When EXPO_PUBLIC_DEMO_MODE=true the API client routes
// every request here instead of the network, so the app can be shown without
// a server (store review, sales demos, the hosted web preview).
//
// It mirrors the rules in apps/api: camera tickets follow the plate's
// registered owner, overdue tickets block plate renewal, QR presentations
// expire and are tamper-evident, revocation invalidates earlier codes. Data is
// fictional and lives in memory; reloading resets it.
//
// Difference from the real API: presentations are sealed with a keyed SHA-256
// hash instead of an ES256 signature, because a real issuer key must never
// ship inside an app.

import { base64url, fromBase64url, sha256Hex } from './hash';
import { buildLicenceStatus, isAdverseChange, shouldRefresh, type LicenceStatusResult, type MtoLicenceStatus } from '../shared/licence-status';
import { canRequestScreening, disputeOptionsFor, parkingAmountDue, parkingStage, parkingTimeline } from '../shared/parking';
import { buildPOACaseStatus, isPOASource, poaIsAdverseChange, poaShouldRefresh, type POACaseCode, type POACaseResult, type POATicketRef } from '../shared/poa';
import {
  FAQ,
  LOCATIONS,
  ORGANIZATIONS,
  PlatformError,
  SERVICES,
  SIGNED_RETENTION_DAYS,
  appointmentView,
  assertPassword,
  assertPin,
  availableSlots,
  bookAppointment,
  bookableDates,
  cancelAppointment,
  cancelRequest,
  cardBrand,
  checkIn,
  checkPlate,
  consentView,
  createRequest,
  dashboardActions,
  decideConsent,
  defaultPreferences,
  driverRecordResult,
  issueOtp,
  mergePreferences,
  payRequest,
  phoneHint,
  resubmitRequest,
  samePhone,
  sampleAppointment,
  sampleConsents,
  sampleRequests,
  serviceById,
  validateFeedback,
  validateServiceData,
  vehicleHistoryResult,
  verifyOtp,
  visitName,
  type Appointment,
  type Consent,
  type Feedback,
  type Otp,
  type Preferences,
  type SavedCard,
  type ServiceRequest as Req,
} from '../shared/platform';
import type {
  AccessLogEntry,
  Address,
  Credential,
  Disclosure,
  Fine,
  InboxMessage,
  Payment,
  PaymentMethod,
  Person,
  SignatureRecord,
  Vehicle,
} from '../types';

export class DemoHttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type Cred = Omit<Credential, 'holder' | 'vehicle'> & { personId: string };
type Veh = Vehicle & { ownerPersonId: string };
type FineRec = Omit<Fine, 'vehicle' | 'payment'> & { personId: string };
interface Account {
  id: string;
  personId: string;
  email: string;
  password: string;
  phone?: string;
  language: 'en' | 'fr';
  createdAt: string;
  pin?: string;
  savedSignature?: string;
}

const DAY = 86400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const day = (offsetDays: number) => iso(offsetDays).slice(0, 10);
let seq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;
const ref = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
const SEAL_KEY = `${Math.random()}${Date.now()}`;
const PRESENTATION_TTL = 90;
const RESPONSE_DAYS = 15;

function surcharge(setFine: number): number {
  const bands: [number, number][] = [[50, 10], [75, 15], [100, 20], [150, 25], [200, 30], [250, 35], [300, 40], [350, 60], [400, 60], [450, 75], [500, 75]];
  for (const [max, s] of bands) if (setFine <= max) return s;
  return Math.round(setFine * 0.25);
}
const totals = (setFine: number) => ({ setFine, victimFineSurcharge: surcharge(setFine), courtCosts: 5, total: setFine + surcharge(setFine) + 5 });

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------

const people = new Map<string, Person>();
const credentials = new Map<string, Cred>();
const vehicles = new Map<string, Veh>();
const accounts = new Map<string, Account>();
const fines = new Map<string, FineRec>();
const inbox = new Map<string, InboxMessage & { accountId: string }>();
const payments = new Map<string, Payment & { accountId: string }>();
const requests = new Map<string, Req>();
const appointments = new Map<string, Appointment>();
const consents = new Map<string, Consent>();
const cards = new Map<string, SavedCard>();
const preferences = new Map<string, Preferences>();
const feedback: Feedback[] = [];
const otps = new Map<string, Otp>();
const resets = new Map<string, { id: string; accountId?: string; otpId?: string; verified: boolean; expiresAt: number }>();
const reservedPlates = new Set<string>();
/** Demo PIN for the sample account; shown on the PIN prompt in demo mode. */
export const DEMO_PIN = '2580';
/** One-time codes in demo mode are always this (no SMS is sent). */
export const DEMO_CODE = '246810';
const signatures = new Map<string, SignatureRecord & { accountId: string }>();
const accessLog = new Map<string, AccessLogEntry & { accountId: string }>();
const walletRevokedAt = new Map<string, number>();
const sessions = new Map<string, string>(); // token -> account id

function seed() {
  const alexAddr: Address = { line1: '100 Example Street', line2: 'Unit 4', city: 'Toronto', province: 'ON', postalCode: 'M5V 0A1' };
  people.set('per_alex', { id: 'per_alex', licenceNumber: 'T7654-32109-80514', givenNames: 'Alex Jordan', surname: 'Tremblay', dateOfBirth: '1990-05-14', sex: 'X', heightCm: 175, address: alexAddr });
  people.set('per_sam', { id: 'per_sam', licenceNumber: 'L4321-09876-50302', givenNames: 'Sam', surname: 'Example', dateOfBirth: '1985-03-02', sex: 'F', heightCm: 168, address: { line1: '55 Placeholder Rd', city: 'Ottawa', province: 'ON', postalCode: 'K1A 0B1' } });

  vehicles.set('veh_alex_car', { id: 'veh_alex_car', ownerPersonId: 'per_alex', plate: 'CVPS 123', jurisdiction: 'ON', vin: '1HGCV1F30LA000001', make: 'Honda', model: 'Civic', year: 2021, colour: 'Blue', bodyType: 'SEDAN', plateValidationExpires: day(24), insurance: { provider: 'Example Mutual', policyNumber: 'EM-55120-88', expiresOn: day(140) } });
  vehicles.set('veh_alex_bike', { id: 'veh_alex_bike', ownerPersonId: 'per_alex', plate: '7AB12', jurisdiction: 'ON', vin: 'JYARN23E09A000002', make: 'Yamaha', model: 'MT-07', year: 2019, colour: 'Black', bodyType: 'MOTORCYCLE', plateValidationExpires: day(210), insurance: { provider: 'Example Mutual', policyNumber: 'EM-55120-91', expiresOn: day(140) } });
  vehicles.set('veh_sam_car', { id: 'veh_sam_car', ownerPersonId: 'per_sam', plate: 'DEMO 456', jurisdiction: 'ON', vin: '2T1BURHE0KC000003', make: 'Toyota', model: 'Corolla', year: 2019, colour: 'Silver', bodyType: 'SEDAN', plateValidationExpires: day(90), insurance: { provider: 'Sample Insurance Co.', policyNumber: 'SIC-0091', expiresOn: day(60) } });

  const creds: Cred[] = [
    { id: 'cred_alex_dl', personId: 'per_alex', type: 'driver_licence', documentNumber: 'T7654-32109-80514', issuedOn: '2022-05-14', expiresOn: '2027-05-14', status: 'valid', licenceClass: 'G, M', discriminator: 'DD7K41093', controlNumber: 'CP0041977', conditions: ['X — corrective lenses'] },
    { id: 'cred_alex_hc', personId: 'per_alex', type: 'health_card', documentNumber: '9876-543-210-XY', discriminator: 'HC2209318', issuedOn: '2021-05-14', expiresOn: '2026-11-14', status: 'valid' },
    { id: 'cred_alex_vp_car', personId: 'per_alex', type: 'vehicle_permit', documentNumber: 'VP-21-0045521', issuedOn: '2021-08-02', expiresOn: day(24), status: 'valid', vehicleId: 'veh_alex_car' },
    { id: 'cred_alex_vp_bike', personId: 'per_alex', type: 'vehicle_permit', documentNumber: 'VP-19-0099310', issuedOn: '2019-04-20', expiresOn: day(210), status: 'valid', vehicleId: 'veh_alex_bike' },
    { id: 'cred_sam_dl', personId: 'per_sam', type: 'driver_licence', documentNumber: 'L4321-09876-50302', issuedOn: '2023-03-02', expiresOn: '2028-03-02', status: 'valid', licenceClass: 'G', discriminator: 'DD3Q88214', controlNumber: 'CP0090512' },
    { id: 'cred_sam_vp', personId: 'per_sam', type: 'vehicle_permit', documentNumber: 'VP-19-0071234', issuedOn: '2019-06-11', expiresOn: day(90), status: 'valid', vehicleId: 'veh_sam_car' },
  ];
  for (const c of creds) credentials.set(c.id, c);

  accounts.set('acc_alex', { id: 'acc_alex', personId: 'per_alex', email: 'demo@civicpass.example', password: 'Demo1234!', phone: '+1 416 555 0100', language: 'en', createdAt: iso(-200), pin: DEMO_PIN });
  const now = new Date();
  for (const r of sampleRequests('acc_alex', now, newId, ref)) requests.set(r.id, r);
  for (const c of sampleConsents('acc_alex', now, newId)) consents.set(c.id, c);
  const apt = sampleAppointment('acc_alex', now, newId, ref);
  appointments.set(apt.id, apt);
  cards.set('card_alex_visa', { id: 'card_alex_visa', accountId: 'acc_alex', brand: 'visa', last4: '4242', expiry: '08/29', addedAt: iso(-200) });
  preferences.set('acc_alex', { ...defaultPreferences(), favouriteCards: ['cred_alex_dl', 'cred_alex_vp_car', 'cred_alex_hc'] });

  const seeded: FineRec[] = [
    { id: 'fine_rlc_1', externalId: 'JPC-RLC-2026-000187', source: 'red_light_camera', liability: 'owner', personId: 'per_alex', vehicleId: 'veh_alex_car', plate: 'CVPS 123', offence: 'Fail to stop for red light — vehicle owner (camera)', statute: 'Highway Traffic Act — red light camera, owner liability', location: 'Example Ave & Sample St (northbound)', municipality: 'Toronto', occurredAt: iso(-6), issuedAt: iso(-3), dueDate: iso(12), ...totals(325), demeritPoints: 0, status: 'outstanding', evidence: { images: ['evidence://a', 'evidence://b'], secondsIntoRed: 1.4 }, poaRef: { locationCode: '0311', offenceNumber: 'AJ472210' } },
    { id: 'fine_officer_1', externalId: 'POA-4471-889120', source: 'officer_issued', liability: 'driver', personId: 'per_alex', offence: 'Speeding — 72 km/h in a 50 km/h zone', statute: 'Highway Traffic Act s.128', location: 'Lakeshore Example Blvd W', municipality: 'Toronto', occurredAt: iso(-20), issuedAt: iso(-20), dueDate: iso(-5), ...totals(95), demeritPoints: 3, status: 'outstanding', poaRef: { locationCode: '0311', offenceNumber: 'AJ447189' } },
    { id: 'fine_ase_1', externalId: 'JPC-ASE-2025-104552', source: 'speed_camera', liability: 'owner', personId: 'per_alex', vehicleId: 'veh_alex_car', plate: 'CVPS 123', offence: 'Speeding 51 km/h in a 40 km/h zone — vehicle owner (camera)', statute: 'Highway Traffic Act s.128 — automated speed enforcement, owner liability', location: 'Sample Rd near Example Public School (community safety zone)', municipality: 'Toronto', occurredAt: '2025-10-02T14:12:00.000Z', issuedAt: '2025-10-09T10:00:00.000Z', dueDate: '2025-10-24T10:00:00.000Z', ...totals(50), demeritPoints: 0, status: 'paid', evidence: { images: ['evidence://c'], recordedSpeedKmh: 51, postedLimitKmh: 40 }, paymentId: 'pay_hist_1' },
    { id: 'fine_parking_1', externalId: 'PKG-TOR-77810023', source: 'parking', liability: 'owner', personId: 'per_alex', vehicleId: 'veh_alex_bike', plate: '7AB12', offence: 'Park in a prohibited area during prohibited times', statute: 'Municipal parking by-law', location: '200 Sample Street', municipality: 'Toronto', occurredAt: iso(-2), issuedAt: iso(-2), dueDate: iso(43), setFine: 55, victimFineSurcharge: 0, courtCosts: 0, total: 55, demeritPoints: 0, status: 'outstanding', parking: parkingTimeline({ penaltyNoticeNumber: 'PKG-TOR-77810023', earlyAmount: 40, setFine: 55, issuedAt: iso(-2) }) },
  ];
  for (const f of seeded) fines.set(f.id, f);

  payments.set('pay_hist_1', { id: 'pay_hist_1', accountId: 'acc_alex', purpose: 'fine', referenceId: 'fine_ase_1', amount: 65, currency: 'CAD', method: 'apple_pay', status: 'succeeded', receiptNumber: 'RCPT-DEMO-0001', createdAt: '2025-10-11T16:30:00.000Z', label: 'Ticket JPC-ASE-2025-104552' });
  payments.set('pay_hist_2', { id: 'pay_hist_2', accountId: 'acc_alex', purpose: 'service_fee', referenceId: 'driver-record', amount: 12, currency: 'CAD', method: 'card', status: 'succeeded', receiptNumber: 'RCPT-DEMO-0002', createdAt: iso(-12), label: 'Driver record (abstract)', cardLast4: '4242' });
  payments.set('pay_hist_3', { id: 'pay_hist_3', accountId: 'acc_alex', purpose: 'service_fee', referenceId: 'birth-certificate', amount: 25, currency: 'CAD', method: 'interac', status: 'succeeded', receiptNumber: 'RCPT-DEMO-0003', createdAt: iso(-1), label: 'Birth certificate' });

  const msgs: Omit<InboxMessage, 'id'>[] = [
    { category: 'security', title: 'New device signed in', body: 'Your account was signed in on a new iPhone. If this was not you, use Account → Lost your phone.', createdAt: iso(-30), read: true },
    { category: 'fine', title: 'New red light camera ticket', body: 'Plate CVPS 123 was recorded at Example Ave & Sample St. Total payable: $390.00.', link: '/fine/fine_rlc_1', createdAt: iso(-3), read: false },
    { category: 'renewal', title: 'Plate renewal due soon', body: 'The plate validation for CVPS 123 expires in 24 days. Renew in the app in under a minute.', link: '/vehicle/veh_alex_car', createdAt: iso(-1), read: false },
  ];
  for (const m of msgs) {
    const id = newId('msg');
    inbox.set(id, { id, accountId: 'acc_alex', ...m });
  }
}
seed();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const fail = (status: number, code: string, message: string): never => {
  throw new DemoHttpError(status, code, message);
};
const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, '').toUpperCase();

function status(f: FineRec): Fine['status'] {
  return f.status === 'outstanding' && new Date(f.dueDate) < new Date() ? 'overdue' : f.status;
}
const fineView = (f: FineRec): Fine => (f.source === 'parking' && f.parking ? { ...f, status: status(f), amountDue: parkingAmountDue(f.parking), parkingStage: parkingStage(f.parking) } : { ...f, status: status(f) });
const chargeAmount = (f: FineRec) => (f.source === 'parking' && f.parking ? parkingAmountDue(f.parking) : f.total);
const finesOf = (personId: string) => [...fines.values()].filter((f) => f.personId === personId).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
const inboxOf = (accountId: string) => [...inbox.values()].filter((m) => m.accountId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// Automatic licence-status checking (mirrors apps/api; the real app pulls from
// the MTO driver record). Deterministic status per licence number, with an
// override map the demo tool uses to show a suspension arriving.
const RECHECK_SECONDS = 86400;
const licenceOverrides = new Map<string, MtoLicenceStatus>();
function demoLicenceStatus(licenceNumber: string): LicenceStatusResult {
  const key = norm(licenceNumber);
  const code = licenceOverrides.get(key) ?? ((): MtoLicenceStatus => {
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const b = h % 100;
    return b < 90 ? 'Valid' : b < 96 ? 'ValidWithIgnitionInterlock' : b < 98 ? 'ValidWithIgnitionInterlockAndWCode' : 'NotValid';
  })();
  return { code, interlock: code === 'ValidWithIgnitionInterlock' || code === 'ValidWithIgnitionInterlockAndWCode', wCode: code === 'ValidWithIgnitionInterlockAndWCode' };
}

/** Refresh the account's driver's-licence status on open; returns true if anything changed. */
function refreshLicence(a: Account, force = false): boolean {
  const now = new Date();
  let changed = false;
  for (const c of credentials.values()) {
    if (c.personId !== a.personId || c.type !== 'driver_licence') continue;
    if (!force && !shouldRefresh(c.licenceStatus, now, 0)) continue;
    const previous = c.licenceStatus;
    const next = buildLicenceStatus(demoLicenceStatus(c.documentNumber), { expiresOn: c.expiresOn, source: 'demo', now, recheckSeconds: RECHECK_SECONDS });
    c.licenceStatus = next;
    c.status = next.display === 'suspended' ? 'suspended' : next.display === 'not_found' ? 'revoked' : c.status === 'revoked' ? 'revoked' : 'valid';
    if (!previous || previous.code !== next.code) {
      changed = true;
      if (isAdverseChange(previous, next)) {
        notify(a.id, next.display === 'suspended'
          ? { category: 'security', title: 'Your driver’s licence is no longer valid', body: 'A status check shows your licence is not currently valid to drive. Contact ServiceOntario.', link: `/credential/${c.id}` }
          : { category: 'security', title: 'We couldn’t confirm your driver’s licence', body: 'The registry has no matching record for your licence right now. Please contact support.', link: `/credential/${c.id}` });
      } else if (previous && (previous.display === 'suspended' || previous.display === 'not_found') && next.display === 'valid') {
        notify(a.id, { category: 'general', title: 'Your driver’s licence is valid again', body: 'A status check shows your licence is back in good standing.', link: `/credential/${c.id}` });
      }
    }
  }
  return changed;
}

// POA court case status (mirrors apps/api; the real app reads POA Online Services).
const POA_RECHECK_SECONDS = 86400;
const POA_OFFENCES = [
  { offence: 'Speeding — exceed the posted limit', statute: 'Highway Traffic Act s.128', setFine: 95 },
  { offence: 'Fail to stop at a red light', statute: 'Highway Traffic Act s.144(18)', setFine: 325 },
  { offence: 'Fail to obey a stop sign', statute: 'Highway Traffic Act s.136', setFine: 110 },
  { offence: 'Use a hand-held device while driving', statute: 'Highway Traffic Act s.78.1', setFine: 615 },
];
const poaKey = (r: POATicketRef) => `${r.locationCode.replace(/\s/g, '').toUpperCase()}|${r.offenceNumber.replace(/\s/g, '').toUpperCase()}`;
const poaOverrides = new Map<string, POACaseCode>();
function poaHash(k: string): number {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
  return h >>> 0;
}
function poaResult(ref: POATicketRef, setFine: number): POACaseResult {
  const k = poaKey(ref);
  const code = poaOverrides.get(k) ?? ((): POACaseCode => {
    const b = poaHash(k) % 100;
    if (b < 70) return 'before_court';
    if (b < 82) return 'convicted';
    if (b < 90) return 'early_resolution_scheduled';
    if (b < 96) return 'trial_scheduled';
    return 'paid';
  })();
  const total = totals(setFine).total;
  switch (code) {
    case 'convicted': return { code, amountOwing: total, fineDueOn: iso(15) };
    case 'in_default': return { code, amountOwing: total };
    case 'early_resolution_scheduled': return { code, amountOwing: 0, nextEvent: { kind: 'early_resolution', at: iso(21), location: 'Provincial Offences Court' } };
    case 'trial_scheduled': return { code, amountOwing: 0, nextEvent: { kind: 'trial', at: iso(45), location: 'Provincial Offences Court' } };
    default: return { code, amountOwing: 0 };
  }
}

/** Refresh the court status of the account's POA tickets; returns true if anything changed. */
function refreshPOA(a: Account, force = false): boolean {
  const now = new Date();
  let changed = false;
  for (const f of fines.values()) {
    if (f.personId !== a.personId || !isPOASource(f.source) || !f.poaRef) continue;
    if (['paid', 'cancelled'].includes(f.status)) continue;
    if (!force && !poaShouldRefresh(f.caseStatus, now, 0)) continue;
    const previous = f.caseStatus;
    const next = buildPOACaseStatus(poaResult(f.poaRef, f.setFine || 95), { source: 'demo', now, recheckSeconds: POA_RECHECK_SECONDS });
    f.caseStatus = next;
    if (next.code === 'paid') f.status = 'paid';
    else if (next.code === 'withdrawn') f.status = 'cancelled';
    else if (next.code === 'in_default') f.status = 'overdue';
    if (!previous || previous.code !== next.code) {
      changed = true;
      if (poaIsAdverseChange(previous, next)) {
        notify(a.id, next.code === 'in_default'
          ? { category: 'fine', title: 'A ticket is now in default', body: 'An unpaid fine on your record is in default. Pay it to avoid a plate-renewal block and collections.', link: `/fine/${f.id}` }
          : { category: 'fine', title: 'You were convicted on a ticket', body: `A ticket on your record was convicted. $${next.amountOwing.toFixed(2)} is owing.`, link: `/fine/${f.id}` });
      }
    }
  }
  return changed;
}

/** Add a POA ticket by its location code + offence number. */
function addPOAByNumber(a: Account, ref: POATicketRef) {
  const k = poaKey(ref);
  const dup = [...fines.values()].find((f) => f.personId === a.personId && f.poaRef && poaKey(f.poaRef) === k);
  if (dup) { refreshPOA(a, true); return { outcome: 'duplicate', fine: fineView(dup) }; }
  if (ref.offenceNumber.replace(/\s/g, '').endsWith('0')) return fail(404, 'ticket_not_found', 'No case matches those numbers yet. It can take 10+ days to appear.');
  const o = POA_OFFENCES[poaHash(k) % POA_OFFENCES.length]!;
  const issuedAt = iso(-((poaHash(k) % 20) + 11));
  const fine: FineRec = {
    id: newId('fine'), externalId: `${ref.locationCode}-${ref.offenceNumber}`, source: 'officer_issued', liability: 'driver', personId: a.personId,
    offence: o.offence, statute: o.statute, location: 'Provincial Offences Court', municipality: 'Toronto', occurredAt: issuedAt, issuedAt,
    dueDate: iso(RESPONSE_DAYS), ...totals(o.setFine), demeritPoints: 0, status: 'outstanding', poaRef: ref,
  };
  fines.set(fine.id, fine);
  notify(a.id, { category: 'fine', title: 'Ticket added', body: `${o.offence} — Toronto. We'll keep its court status up to date.`, link: `/fine/${fine.id}` });
  refreshPOA(a, true);
  return { outcome: 'created', fine: fineView(fines.get(fine.id)!) };
}

function credentialView(c: Cred): Credential {
  const p = people.get(c.personId)!;
  const expired = new Date(c.expiresOn) < new Date();
  const { id: _id, licenceNumber: _ln, ...holder } = p;
  return { ...c, status: c.status === 'valid' && expired ? 'expired' : c.status, holder, vehicle: c.vehicleId ? vehicles.get(c.vehicleId) : undefined };
}

function notify(accountId: string, m: Pick<InboxMessage, 'category' | 'title' | 'body' | 'link'>) {
  const id = newId('msg');
  inbox.set(id, { id, accountId, createdAt: new Date().toISOString(), read: false, ...m });
}

function charge(accountId: string, purpose: Payment['purpose'], referenceId: string, amount: number, method: PaymentMethod, token: string, label?: string, cardLast4?: string) {
  const p = { id: newId('pay'), accountId, purpose, referenceId, amount: Math.round(amount * 100) / 100, currency: 'CAD' as const, method, status: token === 'tok_decline' ? ('failed' as const) : ('succeeded' as const), receiptNumber: ref('RCPT'), createdAt: new Date().toISOString(), ...(label ? { label } : {}), ...(cardLast4 ? { cardLast4 } : {}) };
  payments.set(p.id, p);
  return p;
}

type Body = Record<string, any> | undefined;

/** Charges and fails with 402 on decline; handles saved cards like the API. */
function takePayment(a: Account, purpose: Payment['purpose'], referenceId: string, amount: number, label: string, body: Body) {
  if (!body?.method || !body?.paymentToken) return fail(400, 'payment_required', 'Payment details required');
  let last4: string | undefined = body.saveCard?.last4;
  if (body.cardId) {
    const card = cards.get(body.cardId);
    if (!card || card.accountId !== a.id) fail(404, 'not_found', 'Card not found');
    last4 = card!.last4;
  }
  const p = charge(a.id, purpose, referenceId, amount, body.method, String(body.paymentToken), label, last4);
  if (p.status !== 'succeeded') fail(402, 'payment_declined', 'Payment was declined');
  const sc = body.saveCard as { last4: string; expiry: string; brand?: SavedCard['brand'] } | undefined;
  if (sc && ![...cards.values()].some((c) => c.accountId === a.id && c.last4 === sc.last4 && c.expiry === sc.expiry)) {
    const id = newId('card');
    cards.set(id, { id, accountId: a.id, brand: sc.brand ?? cardBrand(sc.last4), last4: sc.last4, expiry: sc.expiry, addedAt: new Date().toISOString() });
  }
  return p;
}

const requestsOf = (accountId: string) => [...requests.values()].filter((r) => r.accountId === accountId).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
const appointmentsOf = (accountId: string) => [...appointments.values()].filter((x) => x.accountId === accountId).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
const consentsOf = (accountId: string) => [...consents.values()].filter((c) => c.accountId === accountId).sort((x, y) => y.requestedAt.localeCompare(x.requestedAt));
const prefsOf = (accountId: string) => preferences.get(accountId) ?? defaultPreferences();

function findAccount(identifier: string): Account | undefined {
  const id = identifier.trim().toLowerCase();
  if (id.includes('@')) return [...accounts.values()].find((x) => x.email === id);
  const p = [...people.values()].find((x) => norm(x.licenceNumber) === norm(identifier));
  return p ? [...accounts.values()].find((x) => x.personId === p.id) : undefined;
}

function requirePin(a: Account, pin: unknown) {
  if (!a.pin) fail(409, 'pin_not_set', 'Set a digital ID PIN under Account first.');
  if (String(pin ?? '') !== a.pin) fail(422, 'wrong_pin', 'The digital ID PIN is incorrect.');
}

function sendOtp(target: string) {
  const otp = issueOtp(newId('otp'), target, DEMO_CODE, new Date());
  otps.set(otp.id, otp);
  return { otpId: otp.id, devCode: otp.code };
}

const STATUS_TEXT: Record<Req['status'], string> = { in_review: 'in review', action_required: 'action required', awaiting_payment: 'awaiting payment', completed: 'completed', rejected: 'rejected', cancelled: 'cancelled' };
function notifyRequest(a: Account, r: Req) {
  notify(a.id, { category: 'service', title: `${serviceById(r.serviceId)?.name.en ?? r.serviceId}: ${STATUS_TEXT[r.status]}`, body: `Request ${r.reference}.`, link: `/requests/${r.id}` });
}

/** Registry side effects and results of a completed request (mirrors apps/api completeRequest). */
function completeRequest(a: Account, r: Req) {
  const person = people.get(a.personId)!;
  const dl = [...credentials.values()].find((c) => c.personId === a.personId && c.type === 'driver_licence');
  if (r.serviceId === 'change-address') {
    person.address = { ...person.address, line1: r.data.line1!, line2: undefined, city: r.data.city!, postalCode: r.data.postalCode!.toUpperCase() };
  }
  if (r.serviceId === 'renew-licence' && dl) {
    const base = new Date(Math.max(Date.now(), new Date(dl.expiresOn).getTime()));
    base.setUTCFullYear(base.getUTCFullYear() + 5);
    dl.expiresOn = base.toISOString().slice(0, 10);
    dl.issuedOn = new Date().toISOString().slice(0, 10);
    r.result = { title: { en: 'Licence renewed', fr: 'Permis renouvelé' }, lines: [{ label: { en: 'New expiry date', fr: 'Nouvelle date d’expiration' }, value: dl.expiresOn }] };
  }
  if (r.serviceId === 'driver-record') {
    const convictions = finesOf(a.personId).filter((f) => f.liability === 'driver' && f.status === 'paid').map((f) => ({ date: f.occurredAt.slice(0, 10), offence: f.offence, points: f.demeritPoints }));
    r.result = driverRecordResult({ licenceNumber: person.licenceNumber, licenceClass: dl?.licenceClass, status: dl?.status ?? 'none', expiresOn: dl?.expiresOn ?? '—', convictions, period: r.data.years ?? '3 years' });
  }
  if (r.serviceId === 'vehicle-history') r.result = vehicleHistoryResult(r.data.vin ?? '');
}

function age(dob: string): number {
  const d = new Date(dob);
  const n = new Date();
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

function claims(c: Cred, disclosure: Disclosure): Record<string, unknown> {
  const p = people.get(c.personId)!;
  const name = { givenNames: p.givenNames, surname: p.surname };
  switch (disclosure) {
    case 'age_over_19':
      return { ageOver19: age(p.dateOfBirth) >= 19, photo: true };
    case 'age_over_18':
      return { ageOver18: age(p.dateOfBirth) >= 18, photo: true };
    case 'name_photo':
      return { ...name, photo: true };
    case 'licence_status':
      return { ...name, licenceClass: c.licenceClass, conditions: c.conditions ?? [], status: c.status, expiresOn: c.expiresOn };
    case 'full': {
      const v = c.vehicleId ? vehicles.get(c.vehicleId) : undefined;
      return {
        ...name,
        dateOfBirth: p.dateOfBirth,
        sex: p.sex,
        heightCm: p.heightCm,
        address: p.address,
        documentNumber: c.documentNumber,
        licenceClass: c.licenceClass,
        conditions: c.conditions ?? [],
        issuedOn: c.issuedOn,
        expiresOn: c.expiresOn,
        ...(v ? { vehicle: { plate: v.plate, vin: v.vin, make: v.make, model: v.model, year: v.year } } : {}),
      };
    }
  }
}

const seal = (payload: string) => sha256Hex(`${SEAL_KEY}.${payload}`).slice(0, 43);

function summary(a: Account) {
  const open = finesOf(a.personId).map(fineView).filter((f) => f.status === 'outstanding' || f.status === 'overdue');
  const soon = Date.now() + 60 * DAY;
  return {
    openFines: open.length,
    openFinesTotal: Math.round(open.reduce((s, f) => s + f.total, 0) * 100) / 100,
    overdueFines: open.filter((f) => f.status === 'overdue').length,
    unreadMessages: inboxOf(a.id).filter((m) => !m.read).length,
    renewalsDue: [
      ...[...vehicles.values()].filter((v) => v.ownerPersonId === a.personId && new Date(v.plateValidationExpires).getTime() < soon).map((v) => ({ kind: 'plate', id: v.id, label: v.plate, expiresOn: v.plateValidationExpires })),
      ...[...credentials.values()].filter((c) => c.personId === a.personId && c.type !== 'vehicle_permit' && new Date(c.expiresOn).getTime() < soon).map((c) => ({ kind: c.type, id: c.id, label: c.documentNumber, expiresOn: c.expiresOn })),
    ],
    actions: dashboardActions({
      now: new Date(),
      credentials: [...credentials.values()].filter((c) => c.personId === a.personId && c.type !== 'vehicle_permit'),
      vehicles: [...vehicles.values()].filter((v) => v.ownerPersonId === a.personId),
      overdueTickets: open.filter((f) => f.status === 'overdue').length,
      requests: requestsOf(a.id),
      consents: consentsOf(a.id),
      appointments: appointmentsOf(a.id),
    }),
  };
}

function login(accountId: string) {
  const token = `demo_session_${newId('s')}`;
  sessions.set(token, accountId);
  return { accessToken: token };
}

/** Simulates the camera processing centre posting an event for one of the user's plates. */
function simulateCameraTicket(a: Account) {
  const vehicle = [...vehicles.values()].find((v) => v.ownerPersonId === a.personId);
  if (!vehicle) return fail(409, 'no_vehicle', 'You have no registered vehicle to ticket.');
  const spots = ['Demo Rd & Test Ave (eastbound)', 'Example Blvd & Sample St (southbound)', 'Placeholder Ave & Model Rd (westbound)'];
  const location = spots[Math.floor(Math.random() * spots.length)]!;
  const occurredAt = iso(-0.05);
  const issuedAt = new Date().toISOString();
  const fine: FineRec = {
    id: newId('fine'),
    externalId: ref('JPC-RLC'),
    source: 'red_light_camera',
    liability: 'owner',
    personId: vehicle.ownerPersonId,
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    offence: 'Fail to stop for red light — vehicle owner (camera)',
    statute: 'Highway Traffic Act — red light camera, owner liability',
    location,
    municipality: 'Toronto',
    occurredAt,
    issuedAt,
    dueDate: iso(RESPONSE_DAYS),
    ...totals(325),
    demeritPoints: 0,
    status: 'outstanding',
    evidence: { images: ['evidence://sim-1', 'evidence://sim-2'], secondsIntoRed: Math.round((0.5 + Math.random() * 2) * 10) / 10 },
  };
  fines.set(fine.id, fine);
  notify(a.id, { category: 'fine', title: 'New red light camera ticket', body: `Plate ${vehicle.plate} was recorded at ${location}. Total payable: $${fine.total.toFixed(2)}.`, link: `/fine/${fine.id}` });
  return { fineId: fine.id, plate: vehicle.plate };
}

const PARKING_OFFENCES = [
  { offence: 'Park on a street during a prohibited time', bylaw: 'Parking by-law — prohibited time', setFine: 55, early: 40 },
  { offence: 'Stop in a no-stopping zone', bylaw: 'Parking by-law — no stopping', setFine: 75, early: 55 },
  { offence: 'Exceed the posted time limit', bylaw: 'Parking by-law — time limit', setFine: 40, early: 30 },
  { offence: 'Park within 3 metres of a fire hydrant', bylaw: 'Parking by-law — fire hydrant', setFine: 105, early: 85 },
];

/** Demo: a municipality pushes a parking ticket to one of the user's plates (it "just shows up"). */
function simulateParkingTicket(a: Account) {
  const vehicle = [...vehicles.values()].find((v) => v.ownerPersonId === a.personId);
  if (!vehicle) return fail(409, 'no_vehicle', 'You have no registered vehicle to ticket.');
  const o = PARKING_OFFENCES[Math.floor(Math.random() * PARKING_OFFENCES.length)]!;
  const issuedAt = new Date().toISOString();
  const penaltyNoticeNumber = ref('PK-OTT');
  const fine: FineRec = {
    id: newId('fine'), externalId: penaltyNoticeNumber, source: 'parking', liability: 'owner', personId: vehicle.ownerPersonId,
    vehicleId: vehicle.id, plate: vehicle.plate, offence: o.offence, statute: o.bylaw,
    location: `${100 + Math.floor(Math.random() * 900)} Sample Street`, municipality: 'Ottawa', occurredAt: issuedAt, issuedAt,
    dueDate: parkingTimeline({ penaltyNoticeNumber, earlyAmount: o.early, setFine: o.setFine, issuedAt }).screeningReviewBy,
    setFine: o.setFine, victimFineSurcharge: 0, courtCosts: 0, total: o.setFine, demeritPoints: 0, status: 'outstanding',
    parking: parkingTimeline({ penaltyNoticeNumber, earlyAmount: o.early, setFine: o.setFine, issuedAt }),
  };
  fines.set(fine.id, fine);
  notify(a.id, { category: 'fine', title: 'New parking ticket', body: `Plate ${vehicle.plate} — ${o.offence}. Pay $${o.early.toFixed(2)} (early-payment amount).`, link: `/fine/${fine.id}` });
  return { fineId: fine.id, plate: vehicle.plate };
}

/** Add a ticket by its penalty-notice number (gtechna-style lookup). Numbers ending in 0 are "not found". */
function addParkingByNumber(a: Account, penaltyNoticeNumber: string) {
  const key = penaltyNoticeNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!key) return fail(400, 'validation_error', 'Enter the penalty notice number.');
  const dup = [...fines.values()].find((f) => f.externalId === penaltyNoticeNumber && f.personId === a.personId);
  if (dup) return { outcome: 'duplicate', fine: fineView(dup) };
  if (key.endsWith('0')) return fail(404, 'ticket_not_found', 'No parking ticket matches that number.');
  const vehicle = [...vehicles.values()].find((v) => v.ownerPersonId === a.personId);
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const o = PARKING_OFFENCES[h % PARKING_OFFENCES.length]!;
  const issuedAt = iso(-((h % 5) + 1));
  const fine: FineRec = {
    id: newId('fine'), externalId: penaltyNoticeNumber, source: 'parking', liability: 'owner', personId: a.personId,
    vehicleId: vehicle?.id, plate: vehicle?.plate, offence: o.offence, statute: o.bylaw,
    location: `${100 + (h % 900)} Sample Street`, municipality: 'Ottawa', occurredAt: issuedAt, issuedAt,
    dueDate: parkingTimeline({ penaltyNoticeNumber, earlyAmount: o.early, setFine: o.setFine, issuedAt }).screeningReviewBy,
    setFine: o.setFine, victimFineSurcharge: 0, courtCosts: 0, total: o.setFine, demeritPoints: 0, status: 'outstanding',
    parking: parkingTimeline({ penaltyNoticeNumber, earlyAmount: o.early, setFine: o.setFine, issuedAt }),
  };
  fines.set(fine.id, fine);
  notify(a.id, { category: 'fine', title: 'Parking ticket added', body: `${o.offence} — Ottawa.`, link: `/fine/${fine.id}` });
  return { outcome: 'created', fine: fineView(fine) };
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

// Second path segment -> index of the record id in the path.
const ID_AT: Record<string, number> = { wallet: 2, vehicles: 2, fines: 2, services: 2, inbox: 2, 'service-requests': 2, appointments: 2, consents: 2, locations: 2, demo: 3 };
const NOT_IDS = new Set(['pay-all', 'read-all', 'start', 'orders', 'check']);

export async function demoRequest(method: string, path: string, body: Body, token: string | null): Promise<unknown> {
  // A short pause so loading states behave like the real network.
  await new Promise((r) => setTimeout(r, 120));
  try {
    return route(method, path, body, token);
  } catch (e) {
    if (e instanceof PlatformError) throw new DemoHttpError(e.status, e.code, e.message);
    throw e;
  }
}

function route(method: string, path: string, body: Body, token: string | null): unknown {
  const m = method.toUpperCase();
  const [pathname, search] = path.split('?');
  const query = new URLSearchParams(search ?? '');
  const seg = pathname!.split('/').filter(Boolean); // ['v1', ...]
  let at = ID_AT[seg[1] ?? ''];
  if (seg[1] === 'me' && seg[2] === 'cards') at = 3;
  if (seg[1] === 'auth' && seg[2] === 'password-reset') at = 3;
  const id = at && seg[at] && !NOT_IDS.has(seg[at]!) ? seg[at] : undefined;
  const route = `${m} /${seg.slice(1).map((s, i) => (i + 1 === at && id ? ':id' : s)).join('/')}`;
  const now = new Date();

  // ---- public ---------------------------------------------------------------
  switch (route) {
    case 'POST /auth/login': {
      const a = findAccount(String(body?.email ?? ''));
      if (!a || a.password !== body?.password) fail(401, 'invalid_credentials', 'Email, licence number or password is incorrect.');
      return login(a!.id);
    }
    case 'POST /auth/otp':
      if (String(body?.phone ?? '').replace(/\D/g, '').length < 7) fail(400, 'validation_error', 'Enter a valid mobile number.');
      return sendOtp(String(body!.phone));
    case 'POST /auth/register': {
      const b = body ?? {};
      if (!String(b.email).includes('@')) fail(400, 'validation_error', 'Enter a valid email.');
      assertPassword(String(b.password ?? ''));
      if (b.pin) assertPin(String(b.pin));
      if (b.otpId) {
        const otp = otps.get(b.otpId);
        verifyOtp(otp, String(b.otpCode ?? ''), now);
        if (!samePhone(String(b.phone ?? ''), otp!.target)) fail(422, 'otp_invalid', 'The code was sent to a different number.');
      }
      const person = [...people.values()].find((p) => norm(p.licenceNumber) === norm(String(b.licenceNumber ?? '')));
      if (!person || person.dateOfBirth !== b.dateOfBirth) fail(422, 'identity_not_matched', 'We could not match these details to a licensing record.');
      if ([...accounts.values()].some((a) => a.personId === person!.id)) fail(409, 'already_registered', 'An account already exists for this person.');
      if ([...accounts.values()].some((a) => a.email === String(b.email).toLowerCase())) fail(409, 'email_taken', 'This email is already in use.');
      const a: Account = { id: newId('acc'), personId: person!.id, email: String(b.email).toLowerCase(), password: b.password, phone: b.phone, language: b.language ?? 'en', createdAt: now.toISOString(), ...(b.pin ? { pin: String(b.pin) } : {}) };
      accounts.set(a.id, a);
      for (const c of sampleConsents(a.id, now, newId).filter((c) => c.status === 'pending')) consents.set(c.id, c);
      const pending = finesOf(person!.id).filter((f) => f.status === 'outstanding').length;
      notify(a.id, { category: 'general', title: 'Welcome to your digital wallet', body: pending ? `Your documents are ready. You have ${pending} outstanding ticket(s) linked to your record.` : 'Your documents are ready to use.' });
      return login(a.id);
    }
    case 'POST /auth/password-reset/start': {
      const a = findAccount(String(body?.identifier ?? ''));
      const r = { id: newId('rst'), accountId: a?.id, verified: false, expiresAt: Date.now() + 15 * 60_000 };
      resets.set(r.id, r);
      return { resetId: r.id, phoneHint: phoneHint(a?.phone) };
    }
    case 'POST /auth/password-reset/:id/phone':
    case 'POST /auth/password-reset/:id/verify':
    case 'POST /auth/password-reset/:id/complete': {
      const r = resets.get(id!);
      if (!r || r.expiresAt < Date.now()) return fail(410, 'reset_expired', 'Start again.');
      const a = r.accountId ? accounts.get(r.accountId) : undefined;
      if (route.endsWith('/phone')) {
        if (!a || !samePhone(String(body?.phone ?? ''), a.phone)) fail(422, 'phone_mismatch', 'That number doesn’t match the one on the account.');
        const sent = sendOtp(a!.phone!);
        r.otpId = sent.otpId;
        return { sent: true, devCode: sent.devCode };
      }
      if (route.endsWith('/verify')) {
        verifyOtp(r.otpId ? otps.get(r.otpId) : undefined, String(body?.code ?? ''), now);
        r.verified = true;
        return { ok: true };
      }
      if (!r.verified || !a) fail(409, 'not_verified', 'Verify the code first.');
      assertPassword(String(body?.password ?? ''));
      a!.password = String(body!.password);
      resets.delete(r.id);
      notify(a!.id, { category: 'security', title: 'Password reset', body: 'Your password was reset with a code sent to your phone.' });
      return { ok: true };
    }
    case 'GET /services':
      return SERVICES;
    case 'GET /directory':
      return { organizations: ORGANIZATIONS, services: SERVICES.filter((s) => !s.hidden) };
    case 'GET /locations':
      return LOCATIONS;
    case 'GET /locations/:id/slots': {
      const dates = bookableDates(now);
      const q = query.get('date');
      const date = q && dates.includes(q) ? q : dates[0]!;
      const booked = new Set([...appointments.values()].filter((x) => x.status !== 'cancelled').map((x) => `${x.locationId}|${x.startsAt}`));
      return { dates, date, slots: availableSlots(id!, date, booked, now) };
    }
    case 'GET /faq':
      return FAQ;
    case 'POST /plates/check':
      return checkPlate(String(body?.plate ?? ''), reservedPlates);
    case 'POST /feedback': {
      const f = { kind: body?.kind, topic: body?.topic, message: body?.message, rating: body?.rating, improvements: body?.improvements };
      validateFeedback(f);
      const item: Feedback = { ...f, id: newId('fb'), accountId: token ? sessions.get(token) : undefined, reference: ref('FB'), createdAt: now.toISOString() };
      feedback.push(item);
      return { reference: item.reference };
    }
    case 'POST /verify':
      return verify(body);
  }

  // ---- signed in ------------------------------------------------------------
  const accountId = token ? sessions.get(token) : undefined;
  const a = accountId ? accounts.get(accountId) : undefined;
  if (!a) return fail(401, 'unauthenticated', 'Please sign in again.');
  const person = people.get(a.personId)!;
  const ownRequest = () => {
    const r = requests.get(id!);
    if (!r || r.accountId !== a.id) fail(404, 'not_found', 'Request not found');
    return r!;
  };
  const ownAppointment = () => {
    const x = appointments.get(id!);
    if (!x || x.accountId !== a.id) fail(404, 'not_found', 'Appointment not found');
    return x!;
  };
  const ownVehicle = (vid: string) => {
    const v = vehicles.get(vid);
    if (!v || v.ownerPersonId !== a.personId) fail(404, 'not_found', 'Vehicle not found');
    return v!;
  };

  switch (route) {
    case 'GET /me':
      refreshLicence(a);
      refreshPOA(a);
      return { account: { id: a.id, email: a.email, phone: a.phone, language: a.language, identityAssurance: 'IAL2', createdAt: a.createdAt, pinSet: !!a.pin }, person, summary: summary(a), preferences: prefsOf(a.id) };
    case 'PATCH /me':
      if (body?.language) a.language = body.language;
      if (body?.phone) a.phone = body.phone;
      return { ok: true };
    case 'POST /me/push-tokens':
      return { ok: true };
    case 'GET /me/access-log':
      return [...accessLog.values()].filter((e) => e.accountId === a.id).sort((x, y) => y.verifiedAt.localeCompare(x.verifiedAt));
    case 'POST /me/revoke-wallet':
      walletRevokedAt.set(a.id, Date.now());
      notify(a.id, { category: 'security', title: 'Wallet revoked', body: 'All QR codes issued before now are no longer valid.' });
      return { ok: true };
    case 'POST /me/password':
      if (body?.currentPassword !== a.password) fail(422, 'wrong_password', 'The current password is incorrect.');
      assertPassword(String(body?.newPassword ?? ''));
      a.password = String(body!.newPassword);
      notify(a.id, { category: 'security', title: 'Password changed', body: 'Your password was changed. If this wasn’t you, reset it now.' });
      return { ok: true };
    case 'POST /me/pin':
      if (a.pin) requirePin(a, body?.currentPin);
      assertPin(String(body?.newPin ?? ''));
      a.pin = String(body!.newPin);
      notify(a.id, { category: 'security', title: 'Digital ID PIN changed', body: 'Your digital ID PIN was changed.' });
      return { ok: true };
    case 'GET /me/preferences':
      return prefsOf(a.id);
    case 'PUT /me/preferences': {
      const owned = new Set([...credentials.values()].filter((c) => c.personId === a.personId).map((c) => c.id));
      if ((body?.favouriteCards as string[] | undefined)?.some((c) => !owned.has(c))) fail(400, 'unknown_card', 'Unknown document.');
      const next = mergePreferences(prefsOf(a.id), body ?? {});
      preferences.set(a.id, next);
      return next;
    }
    case 'GET /me/cards':
      return [...cards.values()].filter((c) => c.accountId === a.id);
    case 'DELETE /me/cards/:id': {
      const c = cards.get(id!);
      if (!c || c.accountId !== a.id) fail(404, 'not_found', 'Card not found');
      cards.delete(id!);
      return { ok: true };
    }
    case 'GET /me/signature':
      return { path: a.savedSignature ?? null };
    case 'PUT /me/signature':
      if (body?.path != null && !/^[MLQCZ0-9 .,-]*$/i.test(String(body.path))) fail(400, 'validation_error', 'Invalid signature.');
      a.savedSignature = body?.path ?? undefined;
      return { path: a.savedSignature ?? null };
    case 'POST /demo/camera-event':
      return simulateCameraTicket(a);
    case 'POST /demo/parking-event':
      return simulateParkingTicket(a);
    case 'POST /parking/lookup':
      return addParkingByNumber(a, String(body?.penaltyNoticeNumber ?? ''));

    case 'GET /wallet':
      refreshLicence(a);
      return [...credentials.values()].filter((c) => c.personId === a.personId).map(credentialView);
    case 'GET /wallet/:id': {
      const c = credentials.get(id!);
      if (!c || c.personId !== a.personId) fail(404, 'not_found', 'Credential not found');
      if (c!.type === 'driver_licence') refreshLicence(a);
      return credentialView(c!);
    }
    case 'POST /wallet/:id/status/refresh': {
      const c = credentials.get(id!);
      if (!c || c.personId !== a.personId) fail(404, 'not_found', 'Credential not found');
      if (c!.type !== 'driver_licence') fail(400, 'not_a_licence', 'Only driver’s licences have a live status.');
      refreshLicence(a, true);
      return credentialView(credentials.get(id!)!);
    }
    case 'POST /demo/licence-status': {
      const lic = [...credentials.values()].find((c) => c.personId === a.personId && c.type === 'driver_licence');
      if (!lic) fail(404, 'not_found', 'No driver’s licence on file.');
      licenceOverrides.set(norm(lic!.documentNumber), String(body?.code) as MtoLicenceStatus);
      const changed = refreshLicence(a, true);
      return { credentialId: lic!.id, status: lic!.licenceStatus, changed };
    }
    case 'POST /wallet/:id/presentations': {
      const c = credentials.get(id!);
      if (!c || c.personId !== a.personId) fail(404, 'not_found', 'Credential not found');
      const view = credentialView(c!);
      if (view.status !== 'valid') fail(409, 'credential_not_valid', `Credential is ${view.status}`);
      const disclosure: Disclosure = body?.disclosure ?? 'full';
      const t = Math.floor(Date.now() / 1000);
      const payload = base64url(JSON.stringify({ cid: c!.id, ctype: c!.type, disclosure, claims: claims(c!, disclosure), iat: t, exp: t + PRESENTATION_TTL }));
      return { token: `demo.${payload}.${seal(payload)}`, expiresInSeconds: PRESENTATION_TTL };
    }

    case 'GET /vehicles':
      return [...vehicles.values()].filter((v) => v.ownerPersonId === a.personId);
    case 'GET /vehicles/:id': {
      const v = ownVehicle(id!);
      return { ...v, fines: finesOf(a.personId).filter((f) => f.vehicleId === v.id).map(fineView) };
    }
    case 'POST /vehicles/:id/renew': {
      const v = ownVehicle(id!);
      const overdue = finesOf(a.personId).map(fineView).filter((f) => f.status === 'overdue');
      if (overdue.length) fail(409, 'unpaid_fines', `Pay ${overdue.length} overdue fine(s) before renewing.`);
      if (new Date(v.insurance.expiresOn) < now) fail(409, 'no_insurance', 'Valid insurance is required to renew.');
      const years = body?.years === 2 ? 2 : 1;
      const base = new Date(Math.max(Date.now(), new Date(v.plateValidationExpires).getTime()));
      base.setUTCFullYear(base.getUTCFullYear() + years);
      v.plateValidationExpires = base.toISOString().slice(0, 10);
      for (const c of credentials.values()) if (c.vehicleId === v.id) c.expiresOn = v.plateValidationExpires;
      notify(a.id, { category: 'renewal', title: 'Plate renewed', body: `${v.plate} is now valid until ${v.plateValidationExpires}.`, link: `/vehicle/${v.id}` });
      return { vehicle: v, fee: 0 };
    }

    case 'GET /fines':
      refreshPOA(a);
      return finesOf(a.personId).map(fineView);
    case 'GET /fines/:id': {
      const f = fines.get(id!);
      if (!f || f.personId !== a.personId) fail(404, 'not_found', 'Fine not found');
      if (isPOASource(f!.source) && f!.poaRef) refreshPOA(a);
      return { ...fineView(f!), vehicle: f!.vehicleId ? vehicles.get(f!.vehicleId) : undefined, payment: f!.paymentId ? payments.get(f!.paymentId) : undefined };
    }
    case 'POST /fines/:id/case-status/refresh': {
      const f = fines.get(id!);
      if (!f || f.personId !== a.personId) fail(404, 'not_found', 'Fine not found');
      if (!isPOASource(f!.source) || !f!.poaRef) fail(400, 'no_case', 'This ticket has no court case status.');
      refreshPOA(a, true);
      return fineView(fines.get(id!)!);
    }
    case 'POST /poa/lookup':
      return addPOAByNumber(a, { locationCode: String(body?.locationCode ?? ''), offenceNumber: String(body?.offenceNumber ?? '') });
    case 'POST /demo/case-status/:id': {
      const f = fines.get(id!);
      if (!f || f.personId !== a.personId || !f.poaRef) fail(404, 'not_found', 'Ticket not found.');
      poaOverrides.set(poaKey(f!.poaRef!), String(body?.code) as POACaseCode);
      refreshPOA(a, true);
      return fineView(fines.get(f!.id)!);
    }
    case 'POST /fines/pay-all': {
      const open = finesOf(a.personId).filter((f) => ['outstanding', 'overdue'].includes(status(f)));
      if (!open.length) fail(409, 'nothing_to_pay', 'No open tickets.');
      const p = takePayment(a, 'fine', open.map((f) => f.id).join(','), open.reduce((s, f) => s + f.total, 0), `${open.length} tickets`, body);
      for (const f of open) {
        f.status = 'paid';
        f.paymentId = p.id;
      }
      notify(a.id, { category: 'fine', title: 'Payment received', body: `Receipt ${p.receiptNumber}: $${p.amount.toFixed(2)} for ${open.length} tickets.`, link: '/fines' });
      return { fines: open.map(fineView), payment: p };
    }
    case 'POST /fines/:id/pay': {
      const f = fines.get(id!);
      if (!f || f.personId !== a.personId) fail(404, 'not_found', 'Fine not found');
      const st = status(f!);
      if (st !== 'outstanding' && st !== 'overdue') fail(409, 'not_payable', `Fine is ${st}`);
      const p = takePayment(a, 'fine', f!.id, chargeAmount(f!), `Ticket ${f!.externalId}`, body);
      f!.status = 'paid';
      f!.paymentId = p.id;
      notify(a.id, { category: 'fine', title: 'Payment received', body: `Receipt ${p.receiptNumber}: $${p.amount.toFixed(2)} for ticket ${f!.externalId}.`, link: `/fine/${f!.id}` });
      return { fine: fineView(f!), payment: p };
    }
    case 'POST /fines/:id/dispute': {
      const f = fines.get(id!);
      if (!f || f.personId !== a.personId) fail(404, 'not_found', 'Fine not found');
      if (String(body?.reason ?? '').trim().length < 10) fail(400, 'validation_error', 'Please give a reason of at least 10 characters.');
      const allowed = new Set(disputeOptionsFor(f!.source).map((o) => o.option));
      if (!allowed.has(body!.option)) fail(400, 'invalid_option', 'That response option does not apply to this ticket.');
      if (f!.source === 'parking' && f!.parking) {
        if (['paid', 'disputed', 'cancelled'].includes(f!.status)) fail(409, 'not_disputable', `Fine is ${f!.status}`);
        if (!canRequestScreening(f!.parking)) fail(409, 'screening_closed', 'The screening-review window has closed.');
      } else if (status(f!) !== 'outstanding') {
        fail(409, 'not_disputable', status(f!) === 'overdue' ? 'The response period has ended' : `Fine is ${status(f!)}`);
      }
      f!.status = 'disputed';
      f!.dispute = { option: body!.option, reason: body!.reason, submittedAt: now.toISOString(), reference: ref('DSP') };
      const titles: Record<string, string> = { trial: 'Trial requested', early_resolution: 'Early resolution meeting requested', screening_review: 'Screening review requested', hearing: 'Hearing requested' };
      const office = body!.option === 'screening_review' || body!.option === 'hearing' ? 'penalty office' : 'court office';
      notify(a.id, { category: 'fine', title: titles[body!.option] ?? 'Response submitted', body: `Reference ${f!.dispute.reference}. The ${office} will notify you here with your date.`, link: `/fine/${f!.id}` });
      return fineView(f!);
    }

    case 'POST /services/:id/requests': {
      const svc = serviceById(id!);
      if (!svc || svc.link) return fail(404, 'not_found', 'Service not found');
      const data: Record<string, string> = body?.data ?? {};
      validateServiceData(svc, data);
      const paymentId = svc.fee > 0 && body?.method && body?.paymentToken ? takePayment(a, 'service_fee', svc.id, svc.fee, svc.name.en, body).id : undefined;
      const r = createRequest({ id: newId('req'), reference: ref('SR'), accountId: a.id, service: svc, data, paymentId, now });
      requests.set(r.id, r);
      if (r.status === 'completed') completeRequest(a, r);
      notifyRequest(a, r);
      return r;
    }
    case 'GET /service-requests':
      return requestsOf(a.id);
    case 'GET /service-requests/:id': {
      const r = ownRequest();
      return { ...r, payment: r.paymentId ? payments.get(r.paymentId) : undefined };
    }
    case 'POST /service-requests/:id/pay': {
      const r = ownRequest();
      if (r.status !== 'awaiting_payment') fail(409, 'not_payable', `Request is ${r.status}`);
      const p = takePayment(a, 'service_fee', r.id, r.amount, serviceById(r.serviceId)!.name.en, body);
      const paid = payRequest(r, p.id, now);
      if (paid.status === 'completed') completeRequest(a, paid);
      notifyRequest(a, paid);
      return { request: paid, payment: p };
    }
    case 'POST /service-requests/:id/cancel': {
      const r = cancelRequest(ownRequest(), now);
      if (r.serviceId === 'personalized-plates' && r.data.plate) reservedPlates.delete(r.data.plate.replace(/ /g, ''));
      return r;
    }
    case 'POST /service-requests/:id/resubmit': {
      const r = resubmitRequest(ownRequest(), body?.data ?? {}, now);
      notifyRequest(a, r);
      return r;
    }

    case 'POST /plates/orders': {
      const v = ownVehicle(String(body?.vehicleId ?? ''));
      const check = checkPlate(String(body?.plate ?? ''), reservedPlates);
      if (!check.available) fail(409, 'plate_unavailable', check.reason!.en);
      reservedPlates.add(check.plate.replace(/ /g, ''));
      const r = createRequest({ id: newId('req'), reference: ref('SR'), accountId: a.id, service: serviceById('personalized-plates')!, data: { plate: check.plate, vehicle: v.plate }, amount: check.fee, now });
      requests.set(r.id, r);
      notifyRequest(a, r);
      return r;
    }

    case 'GET /appointments':
      return appointmentsOf(a.id).map((x) => appointmentView(x, now));
    case 'POST /appointments': {
      const apt = bookAppointment({ id: newId('apt'), reference: ref('APT'), accountId: a.id, locationId: String(body?.locationId), serviceId: String(body?.serviceId), startsAt: String(body?.startsAt), acknowledged: !!body?.acknowledged, existing: [...appointments.values()], now });
      appointments.set(apt.id, apt);
      const loc = LOCATIONS.find((l) => l.id === apt.locationId)!;
      notify(a.id, { category: 'service', title: 'Appointment booked', body: `${visitName(apt.serviceId).en} at ${loc.name.en}, ${apt.date} ${apt.time}. Reference ${apt.reference}.`, link: `/appointments/${apt.id}` });
      return apt;
    }
    case 'GET /appointments/:id':
      return appointmentView(ownAppointment(), now);
    case 'POST /appointments/:id/cancel':
      return cancelAppointment(ownAppointment());
    case 'POST /appointments/:id/check-in':
      return checkIn(ownAppointment(), now);

    case 'GET /consents':
      return consentsOf(a.id).map((c) => consentView(c, now));
    case 'POST /consents/:id/decision': {
      const c = consents.get(id!);
      if (!c || c.accountId !== a.id) fail(404, 'not_found', 'Consent not found');
      if (body?.action === 'approve') requirePin(a, body?.pin);
      decideConsent(c!, body?.action, now);
      return consentView(c!, now);
    }

    case 'GET /inbox':
      return inboxOf(a.id);
    case 'POST /inbox/read-all':
      for (const msg of inboxOf(a.id)) msg.read = true;
      return { ok: true };
    case 'POST /inbox/:id/read': {
      const msg = inbox.get(id!);
      if (!msg || msg.accountId !== a.id) fail(404, 'not_found', 'Message not found');
      msg!.read = true;
      return msg;
    }

    case 'GET /payments':
      return [...payments.values()].filter((p) => p.accountId === a.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));

    case 'POST /signatures': {
      if (body?.consent !== true) fail(400, 'validation_error', 'Consent is required to sign.');
      requirePin(a, body?.pin);
      const documentSha256 = sha256Hex(String(body?.documentContent ?? ''));
      const s = { id: newId('sig'), accountId: a.id, documentTitle: String(body?.documentTitle), documentSha256, signedAt: now.toISOString(), retainedUntil: new Date(now.getTime() + SIGNED_RETENTION_DAYS * DAY).toISOString(), signature: `demo.${documentSha256}.${seal(documentSha256)}` };
      signatures.set(s.id, s);
      return s;
    }
    case 'GET /signatures':
      return [...signatures.values()].filter((s) => s.accountId === a.id).sort((x, y) => y.signedAt.localeCompare(x.signedAt));
  }
  return fail(404, 'not_found', `No demo route for ${m} ${path}`);
}

function verify(body: Body) {
  const parts = String(body?.token ?? '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'demo' || seal(parts[1]!) !== parts[2]) return { valid: false, reason: 'bad_signature' };
  let payload: any;
  try {
    payload = JSON.parse(fromBase64url(parts[1]!));
  } catch {
    return { valid: false, reason: 'bad_signature' };
  }
  if (payload.exp * 1000 < Date.now()) return { valid: false, reason: 'expired' };
  const c = credentials.get(payload.cid);
  if (!c) return { valid: false, reason: 'unknown_credential' };
  const owner = [...accounts.values()].find((a) => a.personId === c.personId);
  const wiped = owner ? walletRevokedAt.get(owner.id) : undefined;
  if (wiped && payload.iat * 1000 <= wiped) return { valid: false, reason: 'revoked' };
  const view = credentialView(c);
  if (view.status !== 'valid') return { valid: false, reason: `credential_${view.status}` };
  if (owner) {
    const lid = newId('log');
    accessLog.set(lid, { id: lid, accountId: owner.id, credentialId: c.id, verifier: String(body?.verifier || 'Unidentified verifier'), claims: Object.keys(payload.claims ?? {}), verifiedAt: new Date().toISOString() });
  }
  return { valid: true, credentialType: c.type, disclosure: payload.disclosure, claims: payload.claims, issuedAt: payload.iat, expiresAt: payload.exp };
}
