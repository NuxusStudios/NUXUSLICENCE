import { beforeEach, describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { Store } from '../src/store.js';
import { seed, DEMO_EMAIL, DEMO_PASSWORD, DEMO_PEOPLE, DEMO_PLATES } from '../src/seed.js';

type App = Awaited<ReturnType<typeof buildApp>>;

let app: App;
let store: Store;

async function login(email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } });
  expect(res.statusCode).toBe(200);
  return { authorization: `Bearer ${res.json().accessToken}` };
}

const camera = (overrides: Record<string, unknown> = {}) => ({
  eventId: `evt-${Math.random()}`,
  type: 'red_light',
  plate: DEMO_PLATES.alexCar,
  jurisdiction: 'ON',
  capturedAt: new Date().toISOString(),
  location: 'Test Ave & Spec St',
  municipality: 'Toronto',
  images: ['evidence://a.jpg'],
  secondsIntoRed: 0.8,
  setFine: 325,
  ...overrides,
});

const integrationHeaders = { 'x-api-key': config.integrationApiKey };

beforeEach(async () => {
  store = new Store();
  await seed(store);
  app = await buildApp({ store });
});

describe('auth', () => {
  it('rejects wrong password', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: DEMO_EMAIL, password: 'nope' } });
    expect(res.statusCode).toBe(401);
  });

  it('requires a token for citizen endpoints', async () => {
    expect((await app.inject({ url: '/v1/wallet' })).statusCode).toBe(401);
  });

  it('registers a registry person after identity proofing and links existing tickets', async () => {
    // A camera ticket arrives before Sam has an account → mailed notice path.
    const pre = await app.inject({ method: 'POST', url: '/v1/integrations/camera-events', headers: integrationHeaders, payload: camera({ plate: DEMO_PLATES.samCar }) });
    expect(pre.json().results[0]).toMatchObject({ outcome: 'created', deliveredVia: 'mail' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'sam@example.com', password: 'longenough', licenceNumber: DEMO_PEOPLE.sam.licenceNumber, dateOfBirth: DEMO_PEOPLE.sam.dateOfBirth, idvSessionId: 'idv_test' },
    });
    expect(res.statusCode).toBe(201);
    const headers = { authorization: `Bearer ${res.json().accessToken}` };
    const fines = (await app.inject({ url: '/v1/fines', headers })).json();
    expect(fines).toHaveLength(1);
    const wallet = (await app.inject({ url: '/v1/wallet', headers })).json();
    expect(wallet.map((c: { type: string }) => c.type).sort()).toEqual(['driver_licence', 'vehicle_permit']);
  });

  it('does not reveal whether a licence exists when DOB is wrong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'x@example.com', password: 'longenough', licenceNumber: DEMO_PEOPLE.sam.licenceNumber, dateOfBirth: '2000-01-01', idvSessionId: 'idv_x' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('identity_not_matched');
  });

  it('prevents a second account for the same person', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'other@example.com', password: 'longenough', licenceNumber: DEMO_PEOPLE.alex.licenceNumber, dateOfBirth: DEMO_PEOPLE.alex.dateOfBirth, idvSessionId: 'idv_y' },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('camera ticket ingestion', () => {
  it('rejects calls without the integration key', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/integrations/camera-events', payload: camera() });
    expect(res.statusCode).toBe(401);
  });

  it('links a red light camera event to the registered owner, with no demerit points, and notifies them', async () => {
    const headers = await login();
    const before = (await app.inject({ url: '/v1/inbox', headers })).json().length;

    const res = await app.inject({ method: 'POST', url: '/v1/integrations/camera-events', headers: integrationHeaders, payload: camera({ plate: 'cvps-123' }) });
    expect(res.statusCode).toBe(202);
    const result = res.json().results[0];
    expect(result).toMatchObject({ outcome: 'created', deliveredVia: 'app' });

    const fine = (await app.inject({ url: `/v1/fines/${result.fineId}`, headers })).json();
    expect(fine).toMatchObject({ source: 'red_light_camera', liability: 'owner', demeritPoints: 0, status: 'outstanding', setFine: 325, total: 390 });
    expect(fine.vehicle.plate).toBe(DEMO_PLATES.alexCar);

    const inbox = (await app.inject({ url: '/v1/inbox', headers })).json();
    expect(inbox).toHaveLength(before + 1);
    expect(inbox[0].link).toBe(`/fine/${result.fineId}`);
  });

  it('is idempotent on eventId', async () => {
    const evt = camera();
    const a = await app.inject({ method: 'POST', url: '/v1/integrations/camera-events', headers: integrationHeaders, payload: evt });
    const b = await app.inject({ method: 'POST', url: '/v1/integrations/camera-events', headers: integrationHeaders, payload: evt });
    expect(b.json().results[0]).toEqual({ eventId: evt.eventId, outcome: 'duplicate', fineId: a.json().results[0].fineId });
  });

  it('queues unknown and out-of-province plates for manual review', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations/camera-events',
      headers: integrationHeaders,
      payload: { events: [camera({ plate: 'ZZZZ999' }), camera({ jurisdiction: 'QC', type: 'speed', recordedSpeedKmh: 70, postedLimitKmh: 50, setFine: 95 })] },
    });
    expect(res.json().results.map((r: { reason: string }) => r.reason)).toEqual(['plate_not_found', 'out_of_province']);
    const unmatched = await app.inject({ url: '/v1/integrations/camera-events/unmatched', headers: integrationHeaders });
    expect(unmatched.json()).toHaveLength(2);
  });
});

describe('fines', () => {
  it('reports past-due tickets as overdue and blocks plate renewal until paid', async () => {
    const headers = await login();
    const fines = (await app.inject({ url: '/v1/fines', headers })).json();
    expect(fines.find((f: { id: string }) => f.id === 'fine_officer_1').status).toBe('overdue');

    const blocked = await app.inject({ method: 'POST', url: '/v1/vehicles/veh_alex_car/renew', headers, payload: {} });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error).toBe('unpaid_fines');

    const paid = await app.inject({ method: 'POST', url: '/v1/fines/fine_officer_1/pay', headers, payload: { method: 'apple_pay', paymentToken: 'tok_ok' } });
    expect(paid.statusCode).toBe(200);
    expect(paid.json().fine.status).toBe('paid');

    const renewed = await app.inject({ method: 'POST', url: '/v1/vehicles/veh_alex_car/renew', headers, payload: {} });
    expect(renewed.statusCode).toBe(200);
    expect(new Date(renewed.json().vehicle.plateValidationExpires).getTime()).toBeGreaterThan(Date.now() + 300 * 86400_000);
  });

  it('keeps the fine outstanding when payment is declined', async () => {
    const headers = await login();
    const res = await app.inject({ method: 'POST', url: '/v1/fines/fine_rlc_1/pay', headers, payload: { method: 'card', paymentToken: 'tok_decline' } });
    expect(res.statusCode).toBe(402);
    expect(store.fines.get('fine_rlc_1')!.status).toBe('outstanding');
  });

  it('refuses double payment', async () => {
    const headers = await login();
    const res = await app.inject({ method: 'POST', url: '/v1/fines/fine_ase_1/pay', headers, payload: { method: 'card', paymentToken: 'tok_ok' } });
    expect(res.statusCode).toBe(409);
  });

  it('lets the owner request a trial while the response window is open', async () => {
    const headers = await login();
    const res = await app.inject({ method: 'POST', url: '/v1/fines/fine_rlc_1/dispute', headers, payload: { option: 'trial', reason: 'The light was yellow when I entered.' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('disputed');
    expect(res.json().dispute.reference).toMatch(/^DSP-/);
  });

  it('hides other people’s fines', async () => {
    await app.inject({ method: 'POST', url: '/v1/integrations/camera-events', headers: integrationHeaders, payload: camera({ plate: DEMO_PLATES.samCar }) });
    const samFine = [...store.fines.values()].find((f) => f.personId === 'per_sam')!;
    const headers = await login();
    expect((await app.inject({ url: `/v1/fines/${samFine.id}`, headers })).statusCode).toBe(404);
  });
});

describe('digital wallet', () => {
  it('issues a signed, short-lived presentation that a verifier can check', async () => {
    const headers = await login();
    const p = await app.inject({ method: 'POST', url: '/v1/wallet/cred_alex_dl/presentations', headers, payload: { disclosure: 'full' } });
    expect(p.statusCode).toBe(200);
    const { token, expiresInSeconds } = p.json();
    expect(expiresInSeconds).toBe(config.presentationTtlSeconds);

    const v = await app.inject({ method: 'POST', url: '/v1/verify', payload: { token, verifier: 'Test Police Service' } });
    expect(v.json()).toMatchObject({ valid: true, credentialType: 'driver_licence', claims: { surname: 'Tremblay', documentNumber: DEMO_PEOPLE.alex.licenceNumber } });

    const log = (await app.inject({ url: '/v1/me/access-log', headers })).json();
    expect(log[0]).toMatchObject({ verifier: 'Test Police Service', credentialId: 'cred_alex_dl' });
  });

  it('age-only disclosure reveals nothing but the age check', async () => {
    const headers = await login();
    const { token } = (await app.inject({ method: 'POST', url: '/v1/wallet/cred_alex_dl/presentations', headers, payload: { disclosure: 'age_over_19' } })).json();
    const claims = decodeJwt(token).claims as Record<string, unknown>;
    expect(claims).toEqual({ ageOver19: true, photo: true });
  });

  it('rejects tampered tokens', async () => {
    const headers = await login();
    const { token } = (await app.inject({ method: 'POST', url: '/v1/wallet/cred_alex_dl/presentations', headers, payload: {} })).json();
    const [h, , s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...decodeJwt(token), claims: { ageOver19: true } })).toString('base64url');
    const v = await app.inject({ method: 'POST', url: '/v1/verify', payload: { token: `${h}.${forged}.${s}` } });
    expect(v.json()).toEqual({ valid: false, reason: 'bad_signature' });
  });

  it('invalidates outstanding QR codes after a lost-device wallet revoke', async () => {
    const headers = await login();
    const { token } = (await app.inject({ method: 'POST', url: '/v1/wallet/cred_alex_dl/presentations', headers, payload: {} })).json();
    await new Promise((r) => setTimeout(r, 5));
    await app.inject({ method: 'POST', url: '/v1/me/revoke-wallet', headers });
    const v = await app.inject({ method: 'POST', url: '/v1/verify', payload: { token } });
    expect(v.json()).toEqual({ valid: false, reason: 'revoked' });
  });

  it('reports a suspended licence as invalid at verification time', async () => {
    const headers = await login();
    const { token } = (await app.inject({ method: 'POST', url: '/v1/wallet/cred_alex_dl/presentations', headers, payload: {} })).json();
    store.credentials.get('cred_alex_dl')!.status = 'suspended';
    const v = await app.inject({ method: 'POST', url: '/v1/verify', payload: { token } });
    expect(v.json()).toEqual({ valid: false, reason: 'credential_suspended' });
  });

  it('publishes a JWKS for offline verification', async () => {
    const res = await app.inject({ url: '/.well-known/jwks.json' });
    expect(res.json().keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256' });
  });
});

describe('services & signatures', () => {
  it('changing address updates every document at once', async () => {
    const headers = await login();
    const res = await app.inject({ method: 'POST', url: '/v1/services/change-address/requests', headers, payload: { data: { line1: '1 New Road', city: 'Hamilton', postalCode: 'l8p 4r5' } } });
    expect(res.statusCode).toBe(201);
    const wallet = (await app.inject({ url: '/v1/wallet', headers })).json();
    for (const c of wallet) expect(c.holder.address).toMatchObject({ line1: '1 New Road', city: 'Hamilton', postalCode: 'L8P 4R5' });
  });

  it('charges the service fee', async () => {
    const headers = await login();
    const noPay = await app.inject({ method: 'POST', url: '/v1/services/driver-record/requests', headers, payload: { data: { years: '3 years' } } });
    expect(noPay.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/v1/services/driver-record/requests', headers, payload: { data: { years: '3 years' }, method: 'card', paymentToken: 'tok_ok' } });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().paymentId).toBeTruthy();
  });

  it('signs a document hash', async () => {
    const headers = await login();
    const res = await app.inject({ method: 'POST', url: '/v1/signatures', headers, payload: { documentTitle: 'Bill of sale', documentContent: 'I sell my car', consent: true } });
    expect(res.statusCode).toBe(201);
    expect(decodeJwt(res.json().signature)).toMatchObject({ doc: res.json().documentSha256, sub: 'acc_alex' });
  });
});

describe('dashboard summary', () => {
  it('summarises open fines, unread mail and upcoming renewals', async () => {
    const headers = await login();
    const { summary } = (await app.inject({ url: '/v1/me', headers })).json();
    expect(summary.openFines).toBe(3);
    expect(summary.overdueFines).toBe(1);
    expect(summary.unreadMessages).toBe(2);
    expect(summary.renewalsDue.map((r: { label: string }) => r.label)).toContain(DEMO_PLATES.alexCar);
  });
});

describe('cors', () => {
  it('allows PATCH from the web build (language preference)', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/me',
      headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'PATCH' },
    });
    expect(res.statusCode).toBe(204);
    expect(String(res.headers['access-control-allow-methods'])).toContain('PATCH');
  });
});
