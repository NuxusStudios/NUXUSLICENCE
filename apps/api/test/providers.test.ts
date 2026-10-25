import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { Store } from '../src/store.js';
import { seed, DEMO_PEOPLE } from '../src/seed.js';
import { demoIdentityProvider } from '../src/identity.js';

describe('identity proofing', () => {
  it('demo provider approves a normal session and rejects failed ones', async () => {
    expect((await demoIdentityProvider.verify('idv_ok123')).verified).toBe(true);
    expect((await demoIdentityProvider.verify('idv_decline_1')).verified).toBe(false);
    expect((await demoIdentityProvider.verify('idv_fail_x')).verified).toBe(false);
  });

  it('registration is refused when identity verification fails', async () => {
    const store = new Store();
    await seed(store);
    const app = await buildApp({ store });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'newperson@example.com',
        password: 'Longenough1!',
        licenceNumber: DEMO_PEOPLE.sam.licenceNumber,
        dateOfBirth: DEMO_PEOPLE.sam.dateOfBirth,
        idvSessionId: 'idv_decline_me',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('identity_verification_failed');
  });
});

describe('snapshot persistence', () => {
  it('round-trips the store through disk', async () => {
    const { attachPersistence } = await import('../src/persistence.js');
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'civicpass-'));

    const store = new Store();
    await seed(store);
    const app = await buildApp({ store });
    await attachPersistence(app, store, dir, 10);
    const accountCount = store.accounts.size;
    expect(accountCount).toBeGreaterThan(0);
    await app.close(); // onClose flushes a snapshot

    // Fresh store + app restores the snapshot instead of staying empty.
    const store2 = new Store();
    const app2 = await buildApp({ store: store2 });
    await attachPersistence(app2, store2, dir, 10);
    expect(store2.accounts.size).toBe(accountCount);
    expect([...store2.people.values()][0]?.licenceNumber).toBeDefined();
    await app2.close();
  });
});
