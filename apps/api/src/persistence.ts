import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { Store } from './store.js';

/**
 * Snapshot persistence. The Store keeps everything in memory for fast reads;
 * this writes the whole store to a JSON file (atomically) shortly after any
 * mutating request, periodically, and on shutdown, and restores it on boot.
 *
 * This gives durability across restarts for a single instance — enough for a
 * pilot / demo deployment. Horizontal scaling or high write volume needs the
 * relational migration the Store interface already anticipates (one table per
 * collection, keyed by id); see docs/PRODUCTION-BACKEND.md. Route handlers do
 * not change either way.
 */

const MAP_FIELDS = [
  'people', 'credentials', 'vehicles', 'accounts', 'fines', 'inbox', 'payments',
  'serviceRequests', 'signatures', 'accessLog', 'appointments', 'consents', 'cards',
  'preferences', 'otps', 'passwordResets', 'processedCameraEvents', 'processedParkingEvents',
  'processedPoaTickets', 'walletRevokedAt',
] as const;
const SET_FIELDS = ['reservedPlates', 'revokedPresentationIds'] as const;
const ARRAY_FIELDS = ['feedback', 'unmatchedCameraEvents', 'unmatchedParkingEvents'] as const;

type Snapshot = Record<string, unknown>;

function serialize(store: Store): string {
  const snap: Snapshot = { __v: 1 };
  for (const f of MAP_FIELDS) snap[f] = [...(store[f] as Map<string, unknown>).entries()];
  for (const f of SET_FIELDS) snap[f] = [...(store[f] as Set<string>)];
  for (const f of ARRAY_FIELDS) snap[f] = store[f];
  return JSON.stringify(snap);
}

function restore(store: Store, snap: Snapshot): void {
  for (const f of MAP_FIELDS) {
    const entries = snap[f] as [string, unknown][] | undefined;
    if (!entries) continue;
    const map = store[f] as Map<string, unknown>;
    map.clear();
    for (const [k, v] of entries) map.set(k, v);
  }
  for (const f of SET_FIELDS) {
    const items = snap[f] as string[] | undefined;
    if (!items) continue;
    const set = store[f] as Set<string>;
    set.clear();
    for (const v of items) set.add(v);
  }
  for (const f of ARRAY_FIELDS) {
    const items = snap[f] as unknown[] | undefined;
    if (items) (store[f] as unknown[]).splice(0, (store[f] as unknown[]).length, ...items);
  }
}

/**
 * Wire snapshot persistence into the app. Restores an existing snapshot (so the
 * seed is only used the first time), then saves after mutating requests,
 * every `intervalMs`, and on shutdown.
 */
export async function attachPersistence(app: FastifyInstance, store: Store, dataDir: string, intervalMs = 60_000): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const file = join(dataDir, 'store.json');
  const tmp = join(dataDir, 'store.json.tmp');

  try {
    const existing = await readFile(file, 'utf8');
    restore(store, JSON.parse(existing) as Snapshot);
    app.log.info('persistence: restored store from snapshot');
  } catch {
    app.log.info('persistence: no snapshot found, seeding fresh');
  }

  let dirty = false;
  let saving = false;
  async function save() {
    if (saving) return;
    saving = true;
    dirty = false;
    try {
      await writeFile(tmp, serialize(store));
      await rename(tmp, file); // atomic replace
    } catch (err) {
      app.log.error({ err }, 'persistence: save failed');
      dirty = true;
    } finally {
      saving = false;
    }
  }

  // Save shortly after any write request settles (debounced via the dirty flag).
  app.addHook('onResponse', async (req) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') dirty = true;
  });
  const timer = setInterval(() => {
    if (dirty) void save();
  }, intervalMs);
  timer.unref?.();

  const flush = () => {
    void save();
  };
  app.addHook('onClose', async () => {
    clearInterval(timer);
    await save();
  });
  process.once('SIGINT', flush);
  process.once('SIGTERM', flush);
}
