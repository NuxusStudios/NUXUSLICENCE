/* eslint-disable @typescript-eslint/no-explicit-any */
// Automatic licence-status checking: refresh on open, scheduled sweep, alerts.
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { Store } from '../src/store.js';
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from '../src/seed.js';
import { DemoLicenceStatusProvider, setLicenceStatusProvider } from '../src/licence-status.js';
import { buildLicenceStatus, decodeMtoStatus, isAdverseChange, shouldRefresh } from '../src/shared/licence-status.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let store: Store;
let provider: DemoLicenceStatusProvider;

const ALEX_LICENCE = 'T7654-32109-80514';

async function login() {
  const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: DEMO_EMAIL, password: DEMO_PASSWORD } });
  return { authorization: `Bearer ${res.json().accessToken}` };
}
const get = (url: string, headers: Record<string, string>) => app.inject({ url, headers });
const post = (url: string, headers: Record<string, string>, payload: unknown = {}) => app.inject({ method: 'POST', url, headers, payload: payload as object });
const licence = (wallet: any[]) => wallet.find((c: any) => c.type === 'driver_licence');

beforeEach(async () => {
  provider = new DemoLicenceStatusProvider();
  setLicenceStatusProvider(provider);
  store = new Store();
  await seed(store);
  app = await buildApp({ store });
});

describe('licence-status core', () => {
  it('decodes every MTO status', () => {
    expect(decodeMtoStatus('Valid')).toMatchObject({ display: 'valid', interlock: false });
    expect(decodeMtoStatus('ValidWithIgnitionInterlock')).toMatchObject({ display: 'valid', interlock: true, wCode: false });
    expect(decodeMtoStatus('ValidWithIgnitionInterlockAndWCode')).toMatchObject({ interlock: true, wCode: true });
    expect(decodeMtoStatus('NotValid').display).toBe('suspended');
    expect(decodeMtoStatus('NotFound').display).toBe('not_found');
  });

  it('shows expired when a valid status sits on a past expiry date', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const s = buildLicenceStatus({ code: 'Valid', interlock: false, wCode: false }, { expiresOn: '2025-01-01', source: 'demo', now, recheckSeconds: 86400 });
    expect(s.display).toBe('expired');
    expect(new Date(s.nextCheckAt).getTime() - now.getTime()).toBe(86400_000);
  });

  it('only pushes adverse changes and respects the recheck floor', () => {
    const valid = buildLicenceStatus({ code: 'Valid', interlock: false, wCode: false }, { expiresOn: '2030-01-01', source: 'demo', now: new Date(), recheckSeconds: 1 });
    const suspended = buildLicenceStatus({ code: 'NotValid', interlock: false, wCode: false }, { expiresOn: '2030-01-01', source: 'demo', now: new Date(), recheckSeconds: 1 });
    expect(isAdverseChange(valid, suspended)).toBe(true);
    expect(isAdverseChange(suspended, valid)).toBe(false);
    expect(shouldRefresh(valid, new Date(Date.parse(valid.checkedAt) + 10_000), 300)).toBe(false);
    expect(shouldRefresh(valid, new Date(Date.parse(valid.checkedAt) + 400_000), 300)).toBe(true);
    expect(shouldRefresh(undefined, new Date(), 300)).toBe(true);
  });
});

describe('automatic refresh', () => {
  it('populates a live status on app open without any manual input', async () => {
    const headers = await login();
    const dl = licence((await get('/v1/wallet', headers)).json());
    expect(dl.licenceStatus).toMatchObject({ code: 'Valid', display: 'valid', source: 'demo' });
    expect(dl.licenceStatus.checkedAt).toBeTruthy();
    // /v1/me carries the same refreshed wallet state.
    expect((await get('/v1/me', headers)).statusCode).toBe(200);
  });

  it('reflects a new MTO status, flips the credential and alerts the holder', async () => {
    const headers = await login();
    await get('/v1/wallet', headers); // seed status
    const before = (await get('/v1/inbox', headers)).json().length;

    provider.setOverride(ALEX_LICENCE, 'NotValid');
    const dl = licence((await get('/v1/wallet', headers)).json());
    expect(dl.licenceStatus.display).toBe('suspended');
    expect(dl.status).toBe('suspended');

    const inbox = (await get('/v1/inbox', headers)).json();
    expect(inbox.length).toBe(before + 1);
    expect(inbox[0]).toMatchObject({ category: 'security' });
    expect(String(inbox[0].title).toLowerCase()).toContain('no longer valid');

    // A suspended licence can no longer be presented.
    expect((await post(`/v1/wallet/${dl.id}/presentations`, headers)).statusCode).toBe(409);
  });

  it('carries interlock conditions through', async () => {
    const headers = await login();
    provider.setOverride(ALEX_LICENCE, 'ValidWithIgnitionInterlockAndWCode');
    const dl = licence((await get('/v1/wallet', headers)).json());
    expect(dl.licenceStatus).toMatchObject({ display: 'valid', interlock: true, wCode: true });
    expect((await post(`/v1/wallet/${dl.id}/presentations`, headers)).statusCode).toBe(200);
  });

  it('force-refreshes on demand and notifies when a licence recovers', async () => {
    const headers = await login();
    provider.setOverride(ALEX_LICENCE, 'NotValid');
    const dl = licence((await get('/v1/wallet', headers)).json());
    expect(dl.licenceStatus.display).toBe('suspended');

    provider.setOverride(ALEX_LICENCE, 'Valid');
    const refreshed = (await post(`/v1/wallet/${dl.id}/status/refresh`, headers)).json();
    expect(refreshed.licenceStatus.display).toBe('valid');
    expect(refreshed.status).toBe('valid');
    expect(String((await get('/v1/inbox', headers)).json()[0].title).toLowerCase()).toContain('valid again');
  });

  it('rejects status refresh on a non-licence credential', async () => {
    const headers = await login();
    const permit = (await get('/v1/wallet', headers)).json().find((c: { type: string }) => c.type === 'vehicle_permit');
    expect((await post(`/v1/wallet/${permit.id}/status/refresh`, headers)).statusCode).toBe(400);
  });
});

describe('demo tool and sweep', () => {
  it('flips status through the demo endpoint', async () => {
    const headers = await login();
    const res = await post('/v1/demo/licence-status', headers, { code: 'NotValid' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status.display).toBe('suspended');
  });

  it('the nightly sweep re-checks every licence and reports changes', async () => {
    const headers = await login();
    await get('/v1/wallet', headers);
    provider.setOverride(ALEX_LICENCE, 'NotValid');
    const result = await app.sweepLicenceStatuses();
    expect(result.checked).toBeGreaterThanOrEqual(2); // Alex + Sam
    expect(result.changed).toBeGreaterThanOrEqual(1);
    expect(licence((await get('/v1/wallet', headers)).json()).licenceStatus.display).toBe('suspended');
  });
});
