# Production backend plan

Status: **plan** — the current API runs on an in-memory `Store` with optional
snapshot persistence (`DATA_DIR`). This is enough for a single-instance pilot or
a pitch demo. Going to real production (multiple instances, real data volumes,
SLAs) means the steps below. Route handlers never touch storage directly — they
only call `Store` methods — so the swap is contained to one layer.

## 1. Relational store

Replace `Store` (Maps) with a Postgres-backed implementation of the same method
surface. One table per collection, keyed by `id`, plus the lookup indexes the
`findBy*` / `*For` helpers imply:

| Collection | Key indexes |
|---|---|
| people | `licence_number` (normalized), `id` |
| accounts | `email` (unique), `person_id` (unique) |
| credentials | `person_id`, `type` |
| vehicles | `plate+jurisdiction` (normalized), `owner_person_id` |
| fines | `person_id`, `status`, `issued_at` |
| payments / requests / appointments / consents / inbox / cards / access_log | `account_id`, timestamp |
| otps / password_resets | `id`, `expires_at` (TTL sweep) |
| processed_* (idempotency) | unique upstream id |

Recommended: **Postgres 16** with a thin query layer (Kysely or Drizzle — typed,
no heavy ORM). Keep JSON columns for the document-shaped records (credentials,
fines) to avoid a wide migration up front; normalize later if query needs grow.

## 2. Secrets & keys

- `SESSION_SECRET`, `INTEGRATION_API_KEY`, provider keys → a managed secret store
  (AWS Secrets Manager / GCP Secret Manager / Vault), never env files in the image.
- Credential signing key (ES256) → **HSM / cloud KMS**. `crypto.ts` already isolates
  it behind `getSigningKey()`; point that at KMS signing instead of an in-process key.
- Rotate `kid` on key rotation; the JWKS endpoint already publishes multiple keys.

## 3. Horizontal scaling

- Stateless app instances behind a load balancer. Nothing in a handler keeps
  per-instance state once the store is Postgres.
- Move the in-process schedulers (`sweepLicenceStatuses`, `sweepPOACaseStatuses`,
  camera-event prune) to a dedicated worker / cron so sweeps don't run N times.
- Rate limiting + a WAF in front of `/v1/auth/*` and the camera ingest endpoint.

## 4. Observability & ops

- Structured logs (already pino via Fastify) shipped to a log store; never log
  secrets, tokens, PINs, or raw PII.
- Metrics (request latency, provider error rates, sweep outcomes) + alerting.
- Health/readiness probes (`/health` exists; add readiness that checks the DB).
- Backups: automated Postgres PITR; test restores.

## 5. Data lifecycle

- Enforce retention: unmatched camera events already purge on a timer; add the
  same for OTPs, password resets, and access-log entries past their window.
- Honour deletion/revocation: `walletRevokedAt` + `revokedPresentationIds` already
  gate presentations; wire account deletion to a documented erasure job (see the
  Privacy Impact Assessment).

## 6. CI/CD

- `npm test` (94 API tests) + typecheck + lint gate every PR.
- Migrations run as a pipeline step; app refuses to boot on a schema mismatch.
- EAS build/submit for the app (see `eas.json`, `APP-STORE-RELEASE.md`).

None of this changes the app or the public API; it is infrastructure behind the
same contract.
