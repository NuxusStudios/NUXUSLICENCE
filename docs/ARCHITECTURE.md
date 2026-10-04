# Architecture

```
┌──────────────────────────┐        HTTPS/JSON        ┌───────────────────────────────┐
│  CivicPass mobile app    │ ───────────────────────▶ │  CivicPass API (apps/api)     │
│  Expo / React Native     │ ◀─────────────────────── │  Fastify + TypeScript         │
│  iOS · Android · (web)   │   push (APNs/FCM via     │                               │
└──────────┬───────────────┘   Expo push service)     │  • accounts & sessions        │
           │                                          │  • wallet presentations (ES256)│
           │ QR (signed, 90s TTL)                     │  • fines / payments / disputes│
           ▼                                          │  • service requests, inbox    │
┌──────────────────────────┐   POST /v1/verify or     │  • transparency log           │
│ Verifier (police, retail)│ ─ offline with JWKS ───▶ └───┬─────────┬─────────┬──────┘
└──────────────────────────┘                              │         │         │
                                       registry adapter   │  payment│  camera │ x-api-key
                                                          ▼  adapter▼   events▼
                              ┌───────────────────────┐ ┌────────────┐ ┌───────────────────────┐
                              │ Driver & vehicle       │ │ Acquirer   │ │ Camera processing     │
                              │ licensing system of    │ │ (Moneris / │ │ centre / municipal    │
                              │ record (read)          │ │ Stripe…)   │ │ enforcement systems   │
                              └───────────────────────┘ └────────────┘ └───────────────────────┘
```

## Key flows

### Camera ticket → owner's phone

1. The camera processing centre posts an event to `POST /v1/integrations/camera-events` (one event, or `{ events: [...] }` up to 500), authenticated with `x-api-key`. Production should use mTLS.
2. **Idempotent** on `eventId`, so the upstream system can retry safely.
3. Plate + jurisdiction → vehicle → registered owner. Out-of-province plates and unknown plates go to a manual review queue (`GET /v1/integrations/camera-events/unmatched`).
4. A fine is created with `liability: 'owner'` and `demeritPoints: 0`, with the due date at `FINE_RESPONSE_DAYS` (15).
5. If the owner has an account: an inbox entry plus a push notification deep-linking to `/fine/:id`. If not: `deliveredVia: 'mail'`, and the legacy mail process continues.
6. The owner pays (Apple Pay / Google Pay / Interac / card), requests early resolution or trial, or the ticket goes **overdue**, which blocks plate renewal.

### Showing your licence

1. The holder picks what to disclose: full, licence status, 19+, 18+, or name + photo.
2. `POST /v1/wallet/:id/presentations` returns an ES256-signed JWT (`typ: civicpass-vp+jwt`, 90s TTL) containing **only** the chosen claims.
3. The app renders it as a QR and refreshes it every 60s.
4. The verifier scans it. `POST /v1/verify` checks the signature, expiry, wallet revocation and **live** credential status (a suspended licence fails even if the QR was issued earlier), then writes to the holder's access log.
5. Offline verifiers can check the signature against `/.well-known/jwks.json` but cannot see live status.

### Onboarding (replacing in-person activation)

Licence number + DOB are matched against the registry, with a single error for "not found" and "wrong DOB" to prevent record enumeration. Then a document scan + liveness selfie through an IDV vendor SDK, which returns an `idvSessionId` the API confirms server-to-server. Then the account is created. Tickets already on the person's record show up immediately.

## Security model

| Concern | Prototype | Production |
|---|---|---|
| Session | HS256 JWT, 30 min, Keychain/Keystore storage | OIDC with the provincial identity provider, refresh tokens, device binding (App Attest / Play Integrity) |
| App lock | Optional Face ID / fingerprint, relock after 60s in background | Same, plus required on high-risk actions (payment, signing) |
| Credential signing key | Ephemeral ES256 key (or PEM via env) | HSM / cloud KMS, key rotation with multiple `kid`s in JWKS |
| Integration auth | Shared API key, timing-safe compare | mTLS + allow-listed IPs |
| Lost phone | `POST /v1/me/revoke-wallet` invalidates all earlier QR codes | Plus remote session kill and device de-registration |
| Passwords | scrypt | Prefer passkeys |
| Rate limiting | — | `@fastify/rate-limit` on auth, verify, register |

## What is real vs. simulated

| Real (works end-to-end) | Simulated (needs a production integration) |
|---|---|
| All API endpoints, validation, authz, idempotency | Registry data (seeded in `apps/api/src/seed.ts`) |
| ES256 signing and verification of QR presentations and signatures | Identity verification SDK (document scan + liveness) |
| Camera event → owner matching → fine → inbox | Payment processor (`demoPaymentProvider` approves everything except `tok_decline`) |
| Overdue logic, renewal blocking, dispute workflow | Apple Pay / Google Pay sheets (buttons send a demo token) |
| Push token registration + deep links | Evidence images (placeholders) |
| EN/FR UI, biometric lock, secure storage | Persistence: in-memory `Store` (swap for Postgres) |

## Replacing the in-memory store

`apps/api/src/store.ts` exposes collection maps plus query helpers, and route handlers only use those. Implement the same helpers on Postgres (suggested tables: `accounts`, `fines`, `payments`, `inbox_messages`, `service_requests`, `signatures`, `access_log`, `camera_events`). Registry data should be **read through** an adapter, not copied.
