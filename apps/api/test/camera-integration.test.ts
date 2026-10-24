// Production-readiness of the automated-enforcement (camera) ingestion:
// per-partner HMAC request signing, replay window, municipality authorization,
// idempotency, and the data-minimization prune. The demo path (coarse x-api-key
// only) keeps working so dev/tests and the simulator are unaffected.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { pruneUnmatchedCameraEvents } from '../src/fines.js';
import { hmacSha256Hex } from '../src/crypto.js';
import { Store } from '../src/store.js';
import { seed, DEMO_PLATES } from '../src/seed.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let store: Store;

const PARTNER = { id: 'toronto-jpc', secret: 'test-partner-secret-0123456789', municipalities: ['Toronto'] };

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

function signedPost(bodyStr: string, opts: { partner?: typeof PARTNER; ts?: number; signature?: string } = {}) {
  const partner = opts.partner ?? PARTNER;
  const ts = opts.ts ?? Math.floor(Date.now() / 1000);
  const signature = opts.signature ?? hmacSha256Hex(partner.secret, `${ts}.${bodyStr}`);
  return app.inject({
    method: 'POST',
    url: '/v1/integrations/camera-events',
    headers: {
      'x-api-key': config.integrationApiKey,
      'content-type': 'application/json',
      'x-civicpass-partner': partner.id,
      'x-civicpass-timestamp': String(ts),
      'x-civicpass-signature': signature,
    },
    payload: bodyStr,
  });
}

const originalMode = config.camera.mode;
const originalPartners = config.camera.partners;

beforeEach(async () => {
  store = new Store();
  await seed(store);
  app = await buildApp({ store });
  config.camera.mode = 'live';
  config.camera.partners = [PARTNER];
});
afterEach(() => {
  config.camera.mode = originalMode;
  config.camera.partners = originalPartners;
});

describe('live mode: signed partner pushes', () => {
  it('accepts a correctly signed event and bills the owner', async () => {
    const body = JSON.stringify(camera({ noticeNumber: 'PO-2026-000987' }));
    const res = await signedPost(body);
    expect(res.statusCode).toBe(202);
    const result = res.json().results[0];
    expect(result).toMatchObject({ outcome: 'created', deliveredVia: 'app' });
    // The issued notice number becomes the fine's external id.
    expect(store.fines.get(result.fineId)?.externalId).toBe('PO-2026-000987');
  });

  it('rejects a tampered body (signature over different bytes)', async () => {
    const signed = JSON.stringify(camera());
    const tampered = JSON.stringify(camera({ setFine: 5 })); // different body, stale signature
    const ts = Math.floor(Date.now() / 1000);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations/camera-events',
      headers: {
        'x-api-key': config.integrationApiKey,
        'content-type': 'application/json',
        'x-civicpass-partner': PARTNER.id,
        'x-civicpass-timestamp': String(ts),
        'x-civicpass-signature': hmacSha256Hex(PARTNER.secret, `${ts}.${signed}`),
      },
      payload: tampered,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a bad signature', async () => {
    const res = await signedPost(JSON.stringify(camera()), { signature: 'deadbeef' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a stale timestamp (replay window)', async () => {
    const res = await signedPost(JSON.stringify(camera()), { ts: Math.floor(Date.now() / 1000) - 10_000 });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an unknown partner', async () => {
    const res = await signedPost(JSON.stringify(camera()), { partner: { id: 'rogue', secret: 'x', municipalities: ['*'] } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an event for a municipality the partner is not authorized for', async () => {
    const res = await signedPost(JSON.stringify(camera({ municipality: 'Ottawa' })));
    expect(res.statusCode).toBe(202);
    expect(res.json().results[0]).toMatchObject({ outcome: 'rejected', reason: 'unauthorized_municipality' });
  });

  it('is idempotent on eventId', async () => {
    const body = JSON.stringify(camera({ eventId: 'evt-fixed-1' }));
    const a = await signedPost(body);
    const b = await signedPost(body);
    expect(a.json().results[0].outcome).toBe('created');
    expect(b.json().results[0].outcome).toBe('duplicate');
  });

  it('refuses an unsigned push in live mode', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/integrations/camera-events', headers: { 'x-api-key': config.integrationApiKey }, payload: camera() });
    expect(res.statusCode).toBe(401);
  });
});

describe('demo mode: coarse key only', () => {
  it('still accepts an x-api-key push with no signature', async () => {
    config.camera.mode = 'demo';
    const res = await app.inject({ method: 'POST', url: '/v1/integrations/camera-events', headers: { 'x-api-key': config.integrationApiKey }, payload: camera() });
    expect(res.statusCode).toBe(202);
    expect(res.json().results[0].outcome).toBe('created');
  });
});

describe('data minimization: unmatched retention', () => {
  it('prunes queued unmatched events past the retention window', () => {
    store.unmatchedCameraEvents.push(
      { event: camera({ plate: 'ZZZZ999' }) as never, reason: 'plate_not_found', receivedAt: new Date(Date.now() - 200 * 86_400_000).toISOString() },
      { event: camera({ plate: 'YYYY888' }) as never, reason: 'plate_not_found', receivedAt: new Date().toISOString() },
    );
    const purged = pruneUnmatchedCameraEvents(store, 90);
    expect(purged).toBe(1);
    expect(store.unmatchedCameraEvents).toHaveLength(1);
  });
});
