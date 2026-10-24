/* eslint-disable @typescript-eslint/no-explicit-any */
// POA court case status: refresh on open, add-by-number (location + offence #),
// conviction/default alerts, sweep.
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { Store } from '../src/store.js';
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from '../src/seed.js';
import { DemoPOACaseStatusProvider, setPOAProvider } from '../src/poa.js';
import { isPOASource, poaIsAdverseChange, buildPOACaseStatus } from '../src/shared/poa.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let store: Store;
let provider: DemoPOACaseStatusProvider;

async function login() {
  const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: DEMO_EMAIL, password: DEMO_PASSWORD } });
  return { authorization: `Bearer ${res.json().accessToken}` };
}
const get = (url: string, headers: Record<string, string>) => app.inject({ url, headers });
const post = (url: string, headers: Record<string, string>, payload: unknown = {}) => app.inject({ method: 'POST', url, headers, payload: payload as object });
const RLC_REF = { locationCode: '0311', offenceNumber: 'AJ472210' };

beforeEach(async () => {
  provider = new DemoPOACaseStatusProvider();
  setPOAProvider(provider);
  store = new Store();
  await seed(store);
  app = await buildApp({ store });
});

describe('POA core', () => {
  it('covers camera and officer tickets, not parking', () => {
    expect(isPOASource('red_light_camera')).toBe(true);
    expect(isPOASource('officer_issued')).toBe(true);
    expect(isPOASource('parking')).toBe(false);
  });
  it('flags conviction and default as adverse', () => {
    const now = new Date();
    const before = buildPOACaseStatus({ code: 'before_court', amountOwing: 0 }, { source: 'demo', now, recheckSeconds: 1 });
    const convicted = buildPOACaseStatus({ code: 'convicted', amountOwing: 390 }, { source: 'demo', now, recheckSeconds: 1 });
    expect(poaIsAdverseChange(before, convicted)).toBe(true);
    expect(poaIsAdverseChange(convicted, before)).toBe(false);
  });
});

describe('automatic case-status refresh', () => {
  it('attaches a live court status to POA tickets on open', async () => {
    const headers = await login();
    const fines = (await get('/v1/fines', headers)).json();
    const rlc = fines.find((f: any) => f.id === 'fine_rlc_1');
    expect(rlc.caseStatus).toMatchObject({ source: 'demo' });
    expect(rlc.caseStatus.checkedAt).toBeTruthy();
    // Parking tickets get no POA case status.
    const parking = fines.find((f: any) => f.source === 'parking');
    expect(parking.caseStatus).toBeUndefined();
  });

  it('reflects a conviction, syncs the fine and alerts the holder', async () => {
    const headers = await login();
    await get('/v1/fines', headers);
    const before = (await get('/v1/inbox', headers)).json().length;
    provider.setOverride(RLC_REF, 'convicted');
    const rlc = (await post('/v1/fines/fine_rlc_1/case-status/refresh', headers, {})).json();
    expect(rlc.caseStatus.code).toBe('convicted');
    expect(rlc.caseStatus.amountOwing).toBeGreaterThan(0);
    const inbox = (await get('/v1/inbox', headers)).json();
    expect(inbox.length).toBe(before + 1);
    expect(String(inbox[0].title).toLowerCase()).toContain('convicted');
  });

  it('marks the fine overdue when the case goes into default', async () => {
    const headers = await login();
    provider.setOverride(RLC_REF, 'in_default');
    const rlc = (await post('/v1/fines/fine_rlc_1/case-status/refresh', headers, {})).json();
    expect(rlc.caseStatus.code).toBe('in_default');
    expect(rlc.status).toBe('overdue');
    expect(String((await get('/v1/inbox', headers)).json()[0].title).toLowerCase()).toContain('default');
  });

  it('shows a scheduled court event', async () => {
    const headers = await login();
    provider.setOverride(RLC_REF, 'trial_scheduled');
    const rlc = (await post('/v1/fines/fine_rlc_1/case-status/refresh', headers, {})).json();
    expect(rlc.caseStatus.code).toBe('trial_scheduled');
    expect(rlc.caseStatus.nextEvent).toMatchObject({ kind: 'trial' });
  });

  it('rejects a case-status refresh on a parking ticket', async () => {
    const headers = await login();
    expect((await post('/v1/fines/fine_parking_1/case-status/refresh', headers, {})).statusCode).toBe(400);
  });
});

describe('add a ticket by number', () => {
  it('adds a POA ticket by location code + offence number', async () => {
    const headers = await login();
    const res = await post('/v1/poa/lookup', headers, { locationCode: '0247', offenceNumber: 'DK991234' });
    expect(res.statusCode).toBe(201);
    expect(res.json().fine).toMatchObject({ source: 'officer_issued', caseStatus: expect.any(Object) });
    expect(res.json().fine.poaRef).toMatchObject({ locationCode: '0247', offenceNumber: 'DK991234' });
    // Re-adding is a duplicate.
    expect((await post('/v1/poa/lookup', headers, { locationCode: '0247', offenceNumber: 'DK991234' })).statusCode).toBe(200);
  });

  it('reports a ticket not yet in the system', async () => {
    const headers = await login();
    // Offence numbers ending in 0 are "not found" in the demo provider.
    expect((await post('/v1/poa/lookup', headers, { locationCode: '0247', offenceNumber: 'DK991230' })).statusCode).toBe(404);
  });
});

describe('demo tool and sweep', () => {
  it('flips a case status through the demo endpoint', async () => {
    const headers = await login();
    const res = await post('/v1/demo/case-status/fine_rlc_1', headers, { code: 'withdrawn' });
    expect(res.statusCode).toBe(200);
    expect(res.json().caseStatus.code).toBe('withdrawn');
    expect(res.json().status).toBe('cancelled');
  });

  it('the sweep re-checks every POA ticket and reports changes', async () => {
    const headers = await login();
    await get('/v1/fines', headers);
    provider.setOverride(RLC_REF, 'convicted');
    const result = await app.sweepPOACaseStatuses();
    expect(result.checked).toBeGreaterThanOrEqual(1);
    expect(result.changed).toBeGreaterThanOrEqual(1);
  });
});
