import { buildApp } from './app.js';
import { config } from './config.js';
import { pruneUnmatchedCameraEvents } from './fines.js';
import { setIdentityProvider, vendorIdentityProvider } from './identity.js';
import { setPaymentProvider, stripePaymentProvider } from './payments.js';
import { attachPersistence } from './persistence.js';
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from './seed.js';
import { Store } from './store.js';

// Select real integrations from config; everything defaults to the demo
// adapters so dev and tests never reach an external service.
if (config.payments.provider === 'stripe') setPaymentProvider(stripePaymentProvider);
if (config.identity.provider === 'vendor') setIdentityProvider(vendorIdentityProvider);

const store = new Store();
if (config.seedDemoData) await seed(store);

const app = await buildApp({ store, logger: true });
// Durable snapshot persistence (restores over the seed when a snapshot exists).
if (config.dataDir) await attachPersistence(app, store, config.dataDir);
await app.listen({ port: config.port, host: config.host });

if (config.seedDemoData) {
  app.log.info(`Demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

// Nightly licence-status sweep (in addition to the on-open refresh). A real
// deployment would run this from a scheduler/worker rather than in-process.
const DAY = 86_400_000;
const sweep = () =>
  app
    .sweepLicenceStatuses()
    .then((r) => app.log.info(`licence-status sweep: checked ${r.checked}, changed ${r.changed}`))
    .catch((err) => app.log.error({ err }, 'licence-status sweep error'));
const sweepPoa = () =>
  app
    .sweepPOACaseStatuses()
    .then((r) => app.log.info(`POA case-status sweep: checked ${r.checked}, changed ${r.changed}`))
    .catch((err) => app.log.error({ err }, 'POA case-status sweep error'));
const prune = () => {
  const n = pruneUnmatchedCameraEvents(store, config.camera.unmatchedRetentionDays);
  if (n > 0) app.log.info(`pruned ${n} expired unmatched camera event(s)`);
};
const timer = setInterval(() => {
  void sweep();
  void sweepPoa();
  prune();
}, DAY);
timer.unref?.();
