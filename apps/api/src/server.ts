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
