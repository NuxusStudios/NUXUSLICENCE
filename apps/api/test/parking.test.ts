/* eslint-disable @typescript-eslint/no-explicit-any */
// Parking tickets under the municipal APS: push-by-plate ("just show up"),
// add-by-number (gtechna-style lookup), time-based amount and screening review.
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { Store } from '../src/store.js';
import { seed, DEMO_EMAIL, DEMO_PASSWORD, DEMO_PLATES } from '../src/seed.js';
import { DemoParkingAuthorityProvider, setParkingProvider } from '../src/parking.js';
import { APS, parkingAmountDue, parkingStage, parkingTimeline } from '../src/shared/parking.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let store: Store;

async function login() {
  const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: DEMO_EMAIL, password: DEMO_PASSWORD } });
  return { authorization: `Bearer ${res.json().accessToken}` };
}
const get = (url: string, headers: Record<string, string> = {}) => app.inject({ url, headers });
const post = (url: string, headers: Record<string, string>, payload: unknown = {}) => app.inject({ method: 'POST', url, headers, payload: payload as object });
const integrationHeaders = { 'x-api-key': config.integrationApiKey };

const parkingEvent = (o: Record<string, unknown> = {}) => ({
  penaltyNoticeNumber: `PK-${Math.floor(Math.random() * 1e8)}1`,
  plate: DEMO_PLATES.alexCar,
  jurisdiction: 'ON',
  offence: 'Stop in a no-stopping zone',
  bylaw: 'Parking by-law — no stopping',
  location: '55 Example Ave',
  municipality: 'Ottawa',
  issuedAt: new Date().toISOString(),
  earlyAmount: 55,
  setFine: 75,
  ...o,
});

beforeEach(async () => {
  setParkingProvider(new DemoParkingAuthorityProvider());
  store = new Store();
  await seed(store);
  app = await buildApp({ store });
});

describe('APS timeline', () => {
  it('computes stage and amount due across the timeline', () => {
    const issuedAt = '2026-06-01T00:00:00Z';
    const p = parkingTimeline({ penaltyNoticeNumber: 'X1', earlyAmount: 40, setFine: 55, issuedAt });
    expect(parkingStage(p, new Date('2026-06-05'))).toBe('early_payment');
    expect(parkingAmountDue(p, new Date('2026-06-05'))).toBe(40);
    expect(parkingStage(p, new Date(Date.parse(issuedAt) + APS.earlyPaymentDays * 86400_000 + 1000))).toBe('set_fine');
    expect(parkingAmountDue(p, new Date(Date.parse(issuedAt) + APS.overdueDay * 86400_000 + 1000))).toBe(55 + APS.overduePenalty);
    expect(parkingStage(p, new Date('2026-08-01'))).toBe('in_default');
  });
});

describe('parking ingestion ("just show up")', () => {
  it('pushes a ticket to the registered owner by plate, idempotently', async () => {
    const headers = await login();
    const event = parkingEvent();
    const res = await post('/v1/integrations/parking-events', integrationHeaders, event);
    expect(res.statusCode).toBe(202);
    expect(res.json().results[0]).toMatchObject({ outcome: 'created', deliveredVia: 'app' });
    // Retry is a no-op.
    expect((await post('/v1/integrations/parking-events', integrationHeaders, event)).json().results[0].outcome).toBe('duplicate');

    const fines = (await get('/v1/fines', headers)).json();
    const t = fines.find((f: any) => f.externalId === event.penaltyNoticeNumber);
    expect(t).toMatchObject({ source: 'parking', liability: 'owner', demeritPoints: 0, parkingStage: 'early_payment', amountDue: 55 });
    expect(t.parking.penaltyNoticeNumber).toBe(event.penaltyNoticeNumber);
    // The owner is notified.
    expect(String((await get('/v1/inbox', headers)).json()[0].title)).toContain('parking');
  });

  it('queues an unknown plate for review', async () => {
    const res = await post('/v1/integrations/parking-events', integrationHeaders, parkingEvent({ plate: 'NOSUCH9' }));
    expect(res.json().results[0]).toMatchObject({ outcome: 'unmatched', reason: 'plate_not_found' });
    expect((await get('/v1/integrations/parking-events/unmatched', integrationHeaders)).json().length).toBe(1);
  });

  it('rejects an unauthenticated integration call', async () => {
    expect((await post('/v1/integrations/parking-events', {}, parkingEvent())).statusCode).toBe(401);
  });
});

describe('add a ticket by number (gtechna-style lookup)', () => {
  it('adds a looked-up ticket to the account', async () => {
    const headers = await login();
    const res = await post('/v1/parking/lookup', headers, { penaltyNoticeNumber: 'OTT-55512347' });
    expect(res.statusCode).toBe(201);
    expect(res.json().fine).toMatchObject({ source: 'parking', municipality: 'Ottawa' });
    // Re-adding the same number is a no-op (duplicate).
    expect((await post('/v1/parking/lookup', headers, { penaltyNoticeNumber: 'OTT-55512347' })).statusCode).toBe(200);
  });

  it('reports an unknown number', async () => {
    const headers = await login();
    // Demo provider treats numbers ending in 0 as not found.
    expect((await post('/v1/parking/lookup', headers, { penaltyNoticeNumber: 'OTT-5551230' })).statusCode).toBe(404);
  });
});

describe('APS pay and dispute', () => {
  it('charges the early-payment amount inside the window', async () => {
    const headers = await login();
    const fine = (await get('/v1/fines', headers)).json().find((f: any) => f.id === 'fine_parking_1');
    expect(fine).toMatchObject({ amountDue: 40, parkingStage: 'early_payment' });
    const res = await post('/v1/fines/fine_parking_1/pay', headers, { method: 'card', paymentToken: 'tok_ok' });
    expect(res.statusCode).toBe(200);
    expect(res.json().payment.amount).toBe(40);
  });

  it('offers screening review / hearing for parking and rejects POA options', async () => {
    const headers = await login();
    expect((await post('/v1/fines/fine_parking_1/dispute', headers, { option: 'trial', reason: 'This is not my car at all.' })).statusCode).toBe(400);
    const res = await post('/v1/fines/fine_parking_1/dispute', headers, { option: 'screening_review', reason: 'The sign was obscured by a tree branch.' });
    expect(res.statusCode).toBe(200);
    expect(res.json().dispute.option).toBe('screening_review');
    expect(String((await get('/v1/inbox', headers)).json()[0].title).toLowerCase()).toContain('screening');
  });

  it('still allows a screening review after the early-payment period but before day 45', async () => {
    const headers = await login();
    // Issue a ticket 20 days ago: past early payment, still inside the screening window.
    const past = new Date(Date.now() - 20 * 86400_000).toISOString();
    await post('/v1/integrations/parking-events', integrationHeaders, parkingEvent({ penaltyNoticeNumber: 'PK-OLD-1', issuedAt: past }));
    const fine = (await get('/v1/fines', headers)).json().find((f: any) => f.externalId === 'PK-OLD-1');
    expect(fine.parkingStage).toBe('overdue');
    expect((await post(`/v1/fines/${fine.id}/dispute`, headers, { option: 'screening_review', reason: 'I have a valid permit for that zone.' })).statusCode).toBe(200);
  });
});
