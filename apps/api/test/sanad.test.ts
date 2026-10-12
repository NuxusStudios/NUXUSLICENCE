// Features modelled on Jordan's Sanad app: request tracking, appointments,
// consents, personalized plates, PIN, password reset, preferences, feedback.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { Store } from '../src/store.js';
import { seed, DEMO_EMAIL, DEMO_PASSWORD, DEMO_PEOPLE, DEMO_PIN } from '../src/seed.js';
import { checkPlate, dashboardActions, ontarioClock, ontarioInstant, passwordOk } from '../src/shared/platform.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let store: Store;

async function login(identifier = DEMO_EMAIL, password = DEMO_PASSWORD) {
  const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: identifier, password } });
  expect(res.statusCode).toBe(200);
  return { authorization: `Bearer ${res.json().accessToken}` };
}

const post = (url: string, headers: Record<string, string>, payload: unknown = {}) => app.inject({ method: 'POST', url, headers, payload: payload as object });
const get = (url: string, headers: Record<string, string> = {}) => app.inject({ url, headers });

beforeEach(async () => {
  store = new Store();
  await seed(store);
  app = await buildApp({ store });
});

describe('shared core', () => {
  it('the vendored copies match packages/shared', () => {
    const src = readFileSync(new URL('../../../packages/shared/platform.ts', import.meta.url), 'utf8');
    for (const copy of ['../src/shared/platform.ts', '../../mobile/src/lib/shared/platform.ts']) {
      const body = readFileSync(new URL(copy, import.meta.url), 'utf8');
      expect(body.split('\n').slice(1).join('\n'), `${copy} is stale: run node scripts/sync-shared.mjs`).toBe(src);
    }
  });

  it('converts Ontario wall-clock time across daylight saving', () => {
    expect(ontarioInstant('2026-07-01', '09:00').toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(ontarioInstant('2026-01-15', '09:00').toISOString()).toBe('2026-01-15T14:00:00.000Z');
    expect(ontarioClock(new Date('2026-11-01T05:30:00Z'))).toEqual({ date: '2026-11-01', time: '01:30' });
  });

  it('applies password and plate rules', () => {
    expect(passwordOk('Demo1234!')).toBe(true);
    expect(passwordOk('longenough')).toBe(false);
    expect(checkPlate('abcd 123', new Set()).available).toBe(false); // standard format is reserved
    expect(checkPlate('police1', new Set()).available).toBe(false);
    const taken = checkPlate('maple', new Set());
    expect(taken.available).toBe(false);
    expect(taken.suggestions.length).toBeGreaterThan(0);
    expect(checkPlate('Go Leafs', new Set())).toMatchObject({ plate: 'GO LEAFS', available: true });
  });

  it('lists what needs attention, most urgent first', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const actions = dashboardActions({
      now,
      credentials: [{ id: 'dl', type: 'driver_licence', expiresOn: '2026-06-20' }],
      vehicles: [{ id: 'v', plate: 'ABC', plateValidationExpires: '2027-01-01' }],
      overdueTickets: 2,
      requests: [],
      consents: [],
      appointments: [],
    });
    expect(actions.map((a) => a.kind)).toEqual(['overdue_ticket', 'renew_document']);
    expect(actions[1]).toMatchObject({ days: 19, link: '/services/renew-licence' });
  });
});

describe('directory and public info', () => {
  it('serves organizations, service cards, locations and FAQ without signing in', async () => {
    const dir = (await get('/v1/directory')).json();
    expect(dir.organizations.length).toBeGreaterThanOrEqual(6);
    const card = dir.services.find((s: { id: string }) => s.id === 'renew-licence');
    expect(card).toMatchObject({ orgId: 'mto', fee: 90, channels: expect.arrayContaining(['app']) });
    expect(card.steps.length).toBeGreaterThan(1);
    expect(dir.services.some((s: { hidden?: boolean }) => s.hidden)).toBe(false);
    expect((await get('/v1/locations')).json().length).toBeGreaterThan(5);
    expect((await get('/v1/faq')).json()[0].q.fr).toBeTruthy();
  });

  it('takes feedback from guests and validates it', async () => {
    expect((await post('/v1/feedback', {}, { kind: 'rating', rating: 5, improvements: ['speed'] })).statusCode).toBe(201);
    expect((await post('/v1/feedback', {}, { kind: 'complaint', message: 'short' })).statusCode).toBe(400);
    const ok = await post('/v1/feedback', {}, { kind: 'new_service', message: 'Renew my fishing licence in the app' });
    expect(ok.json().reference).toMatch(/^FB-/);
  });
});

describe('sign-in and account security', () => {
  it('signs in with a licence number as well as an email', async () => {
    await login(DEMO_PEOPLE.alex.licenceNumber);
  });

  it('resets a forgotten password with the phone on file and a code', async () => {
    const start = (await post('/v1/auth/password-reset/start', {}, { identifier: DEMO_EMAIL })).json();
    expect(start.phoneHint).toBe('•••• 0100');
    expect((await post(`/v1/auth/password-reset/${start.resetId}/phone`, {}, { phone: '+1 416 555 9999' })).statusCode).toBe(422);
    const sent = (await post(`/v1/auth/password-reset/${start.resetId}/phone`, {}, { phone: '416-555-0100' })).json();
    expect(sent.devCode).toMatch(/^\d{6}$/);
    expect((await post(`/v1/auth/password-reset/${start.resetId}/complete`, {}, { password: 'NewPass123!' })).statusCode).toBe(409);
    expect((await post(`/v1/auth/password-reset/${start.resetId}/verify`, {}, { code: '000000' })).statusCode).toBe(422);
    expect((await post(`/v1/auth/password-reset/${start.resetId}/verify`, {}, { code: sent.devCode })).statusCode).toBe(200);
    expect((await post(`/v1/auth/password-reset/${start.resetId}/complete`, {}, { password: 'weak' })).statusCode).toBe(400);
    expect((await post(`/v1/auth/password-reset/${start.resetId}/complete`, {}, { password: 'NewPass123!' })).statusCode).toBe(200);
    await login(DEMO_EMAIL, 'NewPass123!');
  });

  it('does not reveal unknown accounts when starting a reset', async () => {
    const res = await post('/v1/auth/password-reset/start', {}, { identifier: 'nobody@example.com' });
    expect(res.statusCode).toBe(200);
    expect(res.json().resetId).toBeTruthy();
  });

  it('registers with a verified phone and a PIN', async () => {
    const otp = (await post('/v1/auth/otp', {}, { phone: '+1 613 555 0144' })).json();
    const res = await post('/v1/auth/register', {}, {
      email: 'sam@example.com', password: 'Longenough1!', phone: '+1 613 555 0144', licenceNumber: DEMO_PEOPLE.sam.licenceNumber, dateOfBirth: DEMO_PEOPLE.sam.dateOfBirth,
      idvSessionId: 'idv_t', pin: '4826', otpId: otp.otpId, otpCode: otp.devCode,
    });
    expect(res.statusCode).toBe(201);
    const headers = { authorization: `Bearer ${res.json().accessToken}` };
    expect((await get('/v1/me', headers)).json().account.pinSet).toBe(true);
    // New accounts see a pending data request to try the consent flow.
    expect((await get('/v1/consents', headers)).json()[0].status).toBe('pending');
  });

  it('rejects weak PINs and changes the PIN only with the current one', async () => {
    const headers = await login();
    expect((await post('/v1/me/pin', headers, { currentPin: DEMO_PIN, newPin: '1234' })).statusCode).toBe(400);
    expect((await post('/v1/me/pin', headers, { currentPin: '9999', newPin: '4826' })).statusCode).toBe(422);
    expect((await post('/v1/me/pin', headers, { currentPin: DEMO_PIN, newPin: '4826' })).statusCode).toBe(200);
  });

  it('changes the password with the current one and the rules', async () => {
    const headers = await login();
    expect((await post('/v1/me/password', headers, { currentPassword: 'nope', newPassword: 'Another123!' })).statusCode).toBe(422);
    expect((await post('/v1/me/password', headers, { currentPassword: DEMO_PASSWORD, newPassword: 'short' })).statusCode).toBe(400);
    expect((await post('/v1/me/password', headers, { currentPassword: DEMO_PASSWORD, newPassword: 'Another123!' })).statusCode).toBe(200);
  });

  it('saves favourite cards and services within the limits', async () => {
    const headers = await login();
    const put = (payload: object) => app.inject({ method: 'PUT', url: '/v1/me/preferences', headers, payload });
    expect((await put({ favouriteCards: ['cred_alex_hc'] })).json().favouriteCards).toEqual(['cred_alex_hc']);
    expect((await put({ favouriteCards: ['cred_sam_dl'] })).statusCode).toBe(400);
    expect((await put({ favouriteServices: Array(9).fill('renew-licence').map((s, i) => (i ? `${s}${i}` : s)) })).statusCode).toBe(400);
    expect((await get('/v1/me', headers)).json().preferences.favouriteCards).toEqual(['cred_alex_hc']);
  });
});

describe('My requests', () => {
  it('seeds requests across the lifecycle and lists actions on the dashboard', async () => {
    const headers = await login();
    const statuses = (await get('/v1/service-requests', headers)).json().map((r: { status: string }) => r.status);
    expect(statuses).toEqual(expect.arrayContaining(['completed', 'action_required', 'in_review']));
    const kinds = (await get('/v1/me', headers)).json().summary.actions.map((a: { kind: string }) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(['overdue_ticket', 'request_action', 'consent', 'check_in', 'renew_plate']));
  });

  it('pays a request later, then completes it with a result', async () => {
    const headers = await login();
    const r = (await post('/v1/services/vehicle-history/requests', headers, { data: { vin: '1HGCV1F30LA000001' } })).json();
    expect(r.status).toBe('awaiting_payment');
    const declined = await post(`/v1/service-requests/${r.id}/pay`, headers, { method: 'card', paymentToken: 'tok_decline' });
    expect(declined.statusCode).toBe(402);
    const paid = (await post(`/v1/service-requests/${r.id}/pay`, headers, { method: 'card', paymentToken: 'tok_ok', saveCard: { last4: '1881', expiry: '01/30', brand: 'visa' } })).json();
    expect(paid.request.status).toBe('completed');
    expect(paid.request.result.lines[0].value).toBe('1HGCV1F30LA000001');
    expect(paid.request.history.map((h: { status: string }) => h.status)).toEqual(['submitted', 'awaiting_payment', 'completed']);
    expect((await get('/v1/me/cards', headers)).json().map((c: { last4: string }) => c.last4)).toContain('1881');
    expect((await get('/v1/payments', headers)).json()[0]).toMatchObject({ label: 'Used vehicle history report', cardLast4: '1881' });
  });

  it('renews the licence instantly and extends the digital licence', async () => {
    const headers = await login();
    const before = (await get('/v1/wallet/cred_alex_dl', headers)).json().expiresOn;
    const res = (await post('/v1/services/renew-licence/requests', headers, { data: { visionDeclaration: 'Yes' }, method: 'apple_pay', paymentToken: 'tok_ok' })).json();
    expect(res.status).toBe('completed');
    const after = (await get('/v1/wallet/cred_alex_dl', headers)).json().expiresOn;
    expect(Number(after.slice(0, 4)) - Number(before.slice(0, 4))).toBe(5);
  });

  it('resubmits after "action required" and cancels open requests', async () => {
    const headers = await login();
    const list = (await get('/v1/service-requests', headers)).json();
    const needsAction = list.find((r: { status: string }) => r.status === 'action_required');
    const done = list.find((r: { status: string }) => r.status === 'completed');
    expect((await post(`/v1/service-requests/${done.id}/resubmit`, headers, { data: {} })).statusCode).toBe(409);
    const back = (await post(`/v1/service-requests/${needsAction.id}/resubmit`, headers, { data: { registration: 'CPSO 12345' } })).json();
    expect(back).toMatchObject({ status: 'in_review', data: { practitioner: 'Dr. Example', registration: 'CPSO 12345' } });
    expect((await post(`/v1/service-requests/${back.id}/cancel`, headers)).json().status).toBe('cancelled');
    expect((await post(`/v1/service-requests/${done.id}/cancel`, headers)).statusCode).toBe(409);
  });

  it('pays every open ticket at once', async () => {
    const headers = await login();
    const res = await post('/v1/fines/pay-all', headers, { method: 'card', paymentToken: 'tok_ok' });
    expect(res.statusCode).toBe(200);
    expect(res.json().fines.length).toBe(3);
    expect((await get('/v1/me', headers)).json().summary.openFines).toBe(0);
    expect((await post('/v1/fines/pay-all', headers, { method: 'card', paymentToken: 'tok_ok' })).statusCode).toBe(409);
  });
});

describe('personalized plates', () => {
  it('checks availability, orders, and holds the combination', async () => {
    const headers = await login();
    expect((await post('/v1/plates/check', {}, { plate: 'GO LEAFS' })).json().available).toBe(true);
    const order = await post('/v1/plates/orders', headers, { plate: 'go leafs', vehicleId: 'veh_alex_car' });
    expect(order.statusCode).toBe(201);
    expect(order.json()).toMatchObject({ serviceId: 'personalized-plates', status: 'awaiting_payment', amount: 400, data: { plate: 'GO LEAFS' } });
    expect((await post('/v1/plates/check', {}, { plate: 'GOLEAFS' })).json().available).toBe(false);
    expect((await post('/v1/plates/orders', headers, { plate: 'GO LEAFS', vehicleId: 'veh_alex_car' })).statusCode).toBe(409);
    await post(`/v1/service-requests/${order.json().id}/cancel`, headers);
    expect((await post('/v1/plates/check', {}, { plate: 'GO LEAFS' })).json().available).toBe(true);
  });
});

describe('appointments', () => {
  it('books a free slot with acknowledged requirements, then cancels', async () => {
    const headers = await login();
    const first = (await get('/v1/locations/loc_tor_dt/slots')).json();
    expect(first.dates.length).toBeGreaterThanOrEqual(6);
    const day = first.dates[1];
    const { slots } = (await get(`/v1/locations/loc_tor_dt/slots?date=${day}`)).json();
    expect(slots.length).toBeGreaterThan(0);
    const body = { locationId: 'loc_tor_dt', serviceId: 'photo-card', startsAt: slots[0].startsAt };
    expect((await post('/v1/appointments', headers, { ...body, acknowledged: false })).statusCode).toBe(400);
    expect((await post('/v1/appointments', headers, { ...body, serviceId: 'book-road-test', acknowledged: true })).statusCode).toBe(400);
    const booked = await post('/v1/appointments', headers, { ...body, acknowledged: true });
    expect(booked.statusCode).toBe(201);
    expect(booked.json()).toMatchObject({ date: day, time: slots[0].time, status: 'upcoming' });
    // The slot is gone for everyone.
    expect((await post('/v1/appointments', headers, { ...body, acknowledged: true })).statusCode).toBe(409);
    expect((await get(`/v1/locations/loc_tor_dt/slots?date=${day}`)).json().slots.map((s: { startsAt: string }) => s.startsAt)).not.toContain(slots[0].startsAt);
    expect((await post(`/v1/appointments/${booked.json().id}/check-in`, headers)).statusCode).toBe(409); // too early
    expect((await post(`/v1/appointments/${booked.json().id}/cancel`, headers)).json().status).toBe('cancelled');
  });

  it('checks in near the start time and issues a queue ticket', async () => {
    const headers = await login();
    const soon = (await get('/v1/appointments', headers)).json()[0];
    const res = await post(`/v1/appointments/${soon.id}/check-in`, headers);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'checked_in', ticket: { number: expect.stringMatching(/^D-\d{3}$/) } });
  });
});

describe('consents', () => {
  it('approves only with the PIN, then revokes', async () => {
    const headers = await login();
    const pending = (await get('/v1/consents', headers)).json().find((c: { status: string }) => c.status === 'pending');
    expect((await post(`/v1/consents/${pending.id}/decision`, headers, { action: 'approve' })).statusCode).toBe(422);
    const ok = await post(`/v1/consents/${pending.id}/decision`, headers, { action: 'approve', pin: DEMO_PIN });
    expect(ok.json().status).toBe('approved');
    expect((await post(`/v1/consents/${pending.id}/decision`, headers, { action: 'reject' })).statusCode).toBe(409);
    expect((await post(`/v1/consents/${pending.id}/decision`, headers, { action: 'revoke' })).json().status).toBe('revoked');
  });

  it('cannot act on an expired request', async () => {
    const headers = await login();
    const expired = (await get('/v1/consents', headers)).json().find((c: { expired: boolean }) => c.expired);
    expect((await post(`/v1/consents/${expired.id}/decision`, headers, { action: 'revoke' })).statusCode).toBe(409);
  });
});

describe('inbox and signature', () => {
  it('marks everything read', async () => {
    const headers = await login();
    await post('/v1/inbox/read-all', headers);
    expect((await get('/v1/me', headers)).json().summary.unreadMessages).toBe(0);
  });

  it('saves a handwritten signature and keeps signed copies for 7 days', async () => {
    const headers = await login();
    const path = 'M10 20 L30 40 Q50 10 70 40';
    expect((await app.inject({ method: 'PUT', url: '/v1/me/signature', headers, payload: { path } })).statusCode).toBe(200);
    expect((await get('/v1/me/signature', headers)).json().path).toBe(path);
    expect((await app.inject({ method: 'PUT', url: '/v1/me/signature', headers, payload: { path: '<script>' } })).statusCode).toBe(400);
    const signed = (await post('/v1/signatures', headers, { documentTitle: 'Doc', documentContent: 'x', consent: true, pin: DEMO_PIN })).json();
    expect(Date.parse(signed.retainedUntil) - Date.parse(signed.signedAt)).toBe(7 * 86400_000);
  });
});
