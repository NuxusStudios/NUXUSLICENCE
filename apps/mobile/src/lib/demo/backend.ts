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
import { SERVICES } from './catalog';
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
  ServiceRequest,
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
const requests = new Map<string, ServiceRequest & { accountId: string; data: Record<string, string> }>();
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
    { id: 'cred_alex_dl', personId: 'per_alex', type: 'driver_licence', documentNumber: 'T7654-32109-80514', issuedOn: '2022-05-14', expiresOn: '2027-05-14', status: 'valid', licenceClass: 'G, M', conditions: ['X — corrective lenses'] },
    { id: 'cred_alex_hc', personId: 'per_alex', type: 'health_card', documentNumber: '9876-543-210-XY', issuedOn: '2021-05-14', expiresOn: '2026-11-14', status: 'valid' },
    { id: 'cred_alex_vp_car', personId: 'per_alex', type: 'vehicle_permit', documentNumber: 'VP-21-0045521', issuedOn: '2021-08-02', expiresOn: day(24), status: 'valid', vehicleId: 'veh_alex_car' },
    { id: 'cred_alex_vp_bike', personId: 'per_alex', type: 'vehicle_permit', documentNumber: 'VP-19-0099310', issuedOn: '2019-04-20', expiresOn: day(210), status: 'valid', vehicleId: 'veh_alex_bike' },
    { id: 'cred_sam_dl', personId: 'per_sam', type: 'driver_licence', documentNumber: 'L4321-09876-50302', issuedOn: '2023-03-02', expiresOn: '2028-03-02', status: 'valid', licenceClass: 'G' },
    { id: 'cred_sam_vp', personId: 'per_sam', type: 'vehicle_permit', documentNumber: 'VP-19-0071234', issuedOn: '2019-06-11', expiresOn: day(90), status: 'valid', vehicleId: 'veh_sam_car' },
  ];
  for (const c of creds) credentials.set(c.id, c);

  accounts.set('acc_alex', { id: 'acc_alex', personId: 'per_alex', email: 'demo@civicpass.example', password: 'Demo1234!', phone: '+1 416 555 0100', language: 'en', createdAt: iso(-200) });

  const seeded: FineRec[] = [
    { id: 'fine_rlc_1', externalId: 'JPC-RLC-2026-000187', source: 'red_light_camera', liability: 'owner', personId: 'per_alex', vehicleId: 'veh_alex_car', plate: 'CVPS 123', offence: 'Fail to stop for red light — vehicle owner (camera)', statute: 'Highway Traffic Act — red light camera, owner liability', location: 'Example Ave & Sample St (northbound)', municipality: 'Toronto', occurredAt: iso(-6), issuedAt: iso(-3), dueDate: iso(12), ...totals(325), demeritPoints: 0, status: 'outstanding', evidence: { images: ['evidence://a', 'evidence://b'], secondsIntoRed: 1.4 } },
    { id: 'fine_officer_1', externalId: 'POA-4471-889120', source: 'officer_issued', liability: 'driver', personId: 'per_alex', offence: 'Speeding — 72 km/h in a 50 km/h zone', statute: 'Highway Traffic Act s.128', location: 'Lakeshore Example Blvd W', municipality: 'Toronto', occurredAt: iso(-20), issuedAt: iso(-20), dueDate: iso(-5), ...totals(95), demeritPoints: 3, status: 'outstanding' },
    { id: 'fine_ase_1', externalId: 'JPC-ASE-2025-104552', source: 'speed_camera', liability: 'owner', personId: 'per_alex', vehicleId: 'veh_alex_car', plate: 'CVPS 123', offence: 'Speeding 51 km/h in a 40 km/h zone — vehicle owner (camera)', statute: 'Highway Traffic Act s.128 — automated speed enforcement, owner liability', location: 'Sample Rd near Example Public School (community safety zone)', municipality: 'Toronto', occurredAt: '2025-10-02T14:12:00.000Z', issuedAt: '2025-10-09T10:00:00.000Z', dueDate: '2025-10-24T10:00:00.000Z', ...totals(50), demeritPoints: 0, status: 'paid', evidence: { images: ['evidence://c'], recordedSpeedKmh: 51, postedLimitKmh: 40 }, paymentId: 'pay_hist_1' },
    { id: 'fine_parking_1', externalId: 'PKG-TOR-77810023', source: 'parking', liability: 'owner', personId: 'per_alex', vehicleId: 'veh_alex_bike', plate: '7AB12', offence: 'Park in a prohibited area during prohibited times', statute: 'Municipal parking by-law', location: '200 Sample Street', municipality: 'Toronto', occurredAt: iso(-2), issuedAt: iso(-2), dueDate: iso(13), setFine: 50, victimFineSurcharge: 0, courtCosts: 0, total: 50, demeritPoints: 0, status: 'outstanding' },
  ];
  for (const f of seeded) fines.set(f.id, f);

  payments.set('pay_hist_1', { id: 'pay_hist_1', accountId: 'acc_alex', purpose: 'fine', referenceId: 'fine_ase_1', amount: 65, currency: 'CAD', method: 'apple_pay', status: 'succeeded', receiptNumber: 'RCPT-DEMO-0001', createdAt: '2025-10-11T16:30:00.000Z' });

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
const fineView = (f: FineRec): Fine => ({ ...f, status: status(f) });
const finesOf = (personId: string) => [...fines.values()].filter((f) => f.personId === personId).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
const inboxOf = (accountId: string) => [...inbox.values()].filter((m) => m.accountId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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

function charge(accountId: string, purpose: Payment['purpose'], referenceId: string, amount: number, method: PaymentMethod, token: string) {
  const p = { id: newId('pay'), accountId, purpose, referenceId, amount: Math.round(amount * 100) / 100, currency: 'CAD' as const, method, status: token === 'tok_decline' ? ('failed' as const) : ('succeeded' as const), receiptNumber: ref('RCPT'), createdAt: new Date().toISOString() };
  payments.set(p.id, p);
  return p;
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

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

type Body = Record<string, any> | undefined;

export async function demoRequest(method: string, path: string, body: Body, token: string | null): Promise<unknown> {
  // A short pause so loading states behave like the real network.
  await new Promise((r) => setTimeout(r, 120));
  const m = method.toUpperCase();
  const seg = path.split('?')[0]!.split('/').filter(Boolean); // ['v1', ...]
  // Collections whose second segment is a record id: /v1/fines/:id/pay etc.
  const withIds = new Set(['wallet', 'vehicles', 'fines', 'services', 'inbox']);
  const id = withIds.has(seg[1] ?? '') ? seg[2] : undefined;
  const route = `${m} /${seg.slice(1).map((s, i) => (i === 1 && id ? ':id' : s)).join('/')}`;

  // ---- public ---------------------------------------------------------------
  if (route === 'POST /auth/login') {
    const a = [...accounts.values()].find((x) => x.email === String(body?.email ?? '').trim().toLowerCase());
    if (!a || a.password !== body?.password) fail(401, 'invalid_credentials', 'Email or password is incorrect.');
    return login(a!.id);
  }
  if (route === 'POST /auth/register') {
    const b = body ?? {};
    if (!String(b.email).includes('@') || String(b.password ?? '').length < 8) fail(400, 'validation_error', 'Enter a valid email and a password of at least 8 characters.');
    const person = [...people.values()].find((p) => norm(p.licenceNumber) === norm(String(b.licenceNumber ?? '')));
    if (!person || person.dateOfBirth !== b.dateOfBirth) fail(422, 'identity_not_matched', 'We could not match these details to a licensing record.');
    if ([...accounts.values()].some((a) => a.personId === person!.id)) fail(409, 'already_registered', 'An account already exists for this person.');
    if ([...accounts.values()].some((a) => a.email === String(b.email).toLowerCase())) fail(409, 'email_taken', 'This email is already in use.');
    const a: Account = { id: newId('acc'), personId: person!.id, email: String(b.email).toLowerCase(), password: b.password, phone: b.phone, language: b.language ?? 'en', createdAt: new Date().toISOString() };
    accounts.set(a.id, a);
    const pending = finesOf(person!.id).filter((f) => f.status === 'outstanding').length;
    notify(a.id, { category: 'general', title: 'Welcome to your digital wallet', body: pending ? `Your documents are ready. You have ${pending} outstanding ticket(s) linked to your record.` : 'Your documents are ready to use.' });
    return login(a.id);
  }
  if (route === 'GET /services') return SERVICES;
  if (route === 'POST /verify') {
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

  // ---- signed in ------------------------------------------------------------
  const accountId = token ? sessions.get(token) : undefined;
  const a = accountId ? accounts.get(accountId) : undefined;
  if (!a) return fail(401, 'unauthenticated', 'Please sign in again.');
  const person = people.get(a.personId)!;

  switch (route) {
    case 'GET /me':
      return { account: { id: a.id, email: a.email, phone: a.phone, language: a.language, identityAssurance: 'IAL2', createdAt: a.createdAt }, person, summary: summary(a) };
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
    case 'POST /demo/camera-event':
      return simulateCameraTicket(a);

    case 'GET /wallet':
      return [...credentials.values()].filter((c) => c.personId === a.personId).map(credentialView);
    case 'GET /wallet/:id': {
      const c = credentials.get(id!);
      if (!c || c.personId !== a.personId) fail(404, 'not_found', 'Credential not found');
      return credentialView(c!);
    }
    case 'POST /wallet/:id/presentations': {
      const c = credentials.get(id!);
      if (!c || c.personId !== a.personId) fail(404, 'not_found', 'Credential not found');
      const view = credentialView(c!);
      if (view.status !== 'valid') fail(409, 'credential_not_valid', `Credential is ${view.status}`);
      const disclosure: Disclosure = body?.disclosure ?? 'full';
      const now = Math.floor(Date.now() / 1000);
      const payload = base64url(JSON.stringify({ cid: c!.id, ctype: c!.type, disclosure, claims: claims(c!, disclosure), iat: now, exp: now + PRESENTATION_TTL }));
      return { token: `demo.${payload}.${seal(payload)}`, expiresInSeconds: PRESENTATION_TTL };
    }

    case 'GET /vehicles':
      return [...vehicles.values()].filter((v) => v.ownerPersonId === a.personId);
    case 'GET /vehicles/:id': {
      const v = vehicles.get(id!);
      if (!v || v.ownerPersonId !== a.personId) fail(404, 'not_found', 'Vehicle not found');
      return { ...v, fines: finesOf(a.personId).filter((f) => f.vehicleId === id).map(fineView) };
    }
    case 'POST /vehicles/:id/renew': {
      const v = vehicles.get(id!);
      if (!v || v.ownerPersonId !== a.personId) fail(404, 'not_found', 'Vehicle not found');
      const overdue = finesOf(a.personId).map(fineView).filter((f) => f.status === 'overdue');
      if (overdue.length) fail(409, 'unpaid_fines', `Pay ${overdue.length} overdue fine(s) before renewing.`);
      const years = body?.years === 2 ? 2 : 1;
      const base = new Date(Math.max(Date.now(), new Date(v!.plateValidationExpires).getTime()));
      base.setUTCFullYear(base.getUTCFullYear() + years);
      v!.plateValidationExpires = base.toISOString().slice(0, 10);
      for (const c of credentials.values()) if (c.vehicleId === v!.id) c.expiresOn = v!.plateValidationExpires;
      notify(a.id, { category: 'renewal', title: 'Plate renewed', body: `${v!.plate} is now valid until ${v!.plateValidationExpires}.`, link: `/vehicle/${v!.id}` });
      return { vehicle: v, fee: 0 };
    }

    case 'GET /fines':
      return finesOf(a.personId).map(fineView);
    case 'GET /fines/:id': {
      const f = fines.get(id!);
      if (!f || f.personId !== a.personId) fail(404, 'not_found', 'Fine not found');
      return { ...fineView(f!), vehicle: f!.vehicleId ? vehicles.get(f!.vehicleId) : undefined, payment: f!.paymentId ? payments.get(f!.paymentId) : undefined };
    }
    case 'POST /fines/:id/pay': {
      const f = fines.get(id!);
      if (!f || f.personId !== a.personId) fail(404, 'not_found', 'Fine not found');
      const st = status(f!);
      if (st !== 'outstanding' && st !== 'overdue') fail(409, 'not_payable', `Fine is ${st}`);
      const p = charge(a.id, 'fine', f!.id, f!.total, body?.method ?? 'card', String(body?.paymentToken ?? ''));
      if (p.status !== 'succeeded') fail(402, 'payment_declined', 'Payment was declined');
      f!.status = 'paid';
      f!.paymentId = p.id;
      notify(a.id, { category: 'fine', title: 'Payment received', body: `Receipt ${p.receiptNumber}: $${p.amount.toFixed(2)} for ticket ${f!.externalId}.`, link: `/fine/${f!.id}` });
      return { fine: fineView(f!), payment: p };
    }
    case 'POST /fines/:id/dispute': {
      const f = fines.get(id!);
      if (!f || f.personId !== a.personId) fail(404, 'not_found', 'Fine not found');
      const st = status(f!);
      if (st !== 'outstanding') fail(409, 'not_disputable', st === 'overdue' ? 'The response period has ended' : `Fine is ${st}`);
      if (String(body?.reason ?? '').trim().length < 10) fail(400, 'validation_error', 'Please give a reason of at least 10 characters.');
      f!.status = 'disputed';
      f!.dispute = { option: body!.option, reason: body!.reason, submittedAt: new Date().toISOString(), reference: ref('DSP') };
      notify(a.id, { category: 'fine', title: body!.option === 'trial' ? 'Trial requested' : 'Early resolution meeting requested', body: `Reference ${f!.dispute.reference}. The court office will notify you here with your date.`, link: `/fine/${f!.id}` });
      return fineView(f!);
    }

    case 'POST /services/:id/requests': {
      const svc = SERVICES.find((s) => s.id === id);
      if (!svc) return fail(404, 'not_found', 'Service not found');
      const data: Record<string, string> = body?.data ?? {};
      const missing = svc.fields.filter((f) => f.required && !data[f.key]?.trim()).map((f) => f.key);
      if (missing.length) fail(400, 'missing_fields', `Missing: ${missing.join(', ')}`);
      let paymentId: string | undefined;
      if (svc.fee > 0) {
        if (!body?.method || !body?.paymentToken) fail(400, 'payment_required', 'Payment details required');
        const p = charge(a.id, 'service_fee', svc.id, svc.fee, body!.method, body!.paymentToken);
        if (p.status !== 'succeeded') fail(402, 'payment_declined', 'Payment was declined');
        paymentId = p.id;
      }
      if (svc.id === 'change-address') {
        person.address = { ...person.address, line1: data.line1!, line2: undefined, city: data.city!, postalCode: data.postalCode!.toUpperCase() };
      }
      const r = { id: newId('req'), accountId: a.id, serviceId: svc.id, data, status: svc.id === 'change-address' ? ('completed' as const) : ('submitted' as const), reference: ref('SR'), createdAt: new Date().toISOString(), paymentId };
      requests.set(r.id, r);
      notify(a.id, { category: 'service', title: `${svc.name.en}: ${r.status}`, body: `Reference ${r.reference}.` });
      return r;
    }
    case 'GET /service-requests':
      return [...requests.values()].filter((r) => r.accountId === a.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));

    case 'GET /inbox':
      return inboxOf(a.id);
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
      const documentSha256 = sha256Hex(String(body?.documentContent ?? ''));
      const s = { id: newId('sig'), accountId: a.id, documentTitle: String(body?.documentTitle), documentSha256, signedAt: new Date().toISOString(), signature: `demo.${documentSha256}.${seal(documentSha256)}` };
      signatures.set(s.id, s);
      return s;
    }
    case 'GET /signatures':
      return [...signatures.values()].filter((s) => s.accountId === a.id);
  }
  return fail(404, 'not_found', `No demo route for ${m} ${path}`);
}
