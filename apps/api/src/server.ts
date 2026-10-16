import { buildApp } from './app.js';
import { config } from './config.js';
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from './seed.js';
import { Store } from './store.js';

const store = new Store();
if (config.seedDemoData) await seed(store);

const app = await buildApp({ store, logger: true });
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
const timer = setInterval(() => void sweep(), DAY);
timer.unref?.();
