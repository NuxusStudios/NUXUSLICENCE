# Automated-enforcement camera integration

Red-light-camera (and, where lawful, speed-camera) tickets **just show up** on the
registered owner's phone: the moment an enforcement authority issues a notice for
one of the owner's plates, it lands in the app with a push notification and can be
paid or disputed in a tap. This document is the integration spec — what CivicPass
accepts, how it is authenticated, and what a data-sharing agreement needs from both
sides. **The pipeline is built and production-ready; going live only needs the
agreement, then two config values.**

## The one principle: tickets, not scans

CivicPass ingests **issued notices only** — a Penalty Order *after* a reviewing
officer at the processing centre has adjudicated the images. It **never** receives
the raw plate-scan stream (every car that passed a camera). That distinction is the
whole privacy posture:

- "a camera photographed your plate" = surveillance CivicPass has no business holding;
- "you were issued a ticket" = an obligation you are entitled to be notified of.

Ingesting raw scans would make CivicPass a honeypot of "who drove past which camera
when" — the exact central-database risk that every real 2026 licence-data breach came
from. The ingestion contract (notice number, reviewed-at, a set fine) encodes
"this is a ticket" — consistent with the data-minimization and no-phone-home
principles in the security architecture.

## Ontario legal reality (read before pitching)

- **Red-light cameras continue** under the Highway Traffic Act. This is the live use case.
- **Automated speed enforcement was banned province-wide on 14 Nov 2025 (Bill 56).**
  The generic `speed` event path is kept (other provinces, future reversal) but **do
  not base an Ontario pitch on speed cameras** — municipalities have removed them.
- Camera penalties are **migrating from the provincial-offences court to the
  Administrative Penalty System / Administrative Penalties Tribunal** (e.g. York Region,
  Jan 2026). So a red-light fine increasingly behaves like the parking **APS** model
  rather than the POA court model — plan the fine lifecycle accordingly.
- Camera offences are **owner-liability**: the ticket follows the plate, carries **no
  demerit points**, and an unpaid one can block **plate renewal**.

## Why you can't "tap into the cameras" — and what you do instead

The cameras, their vendors, the centralized processing centre, and the
**plate → registered-owner lookup (MTO vehicle-registration data)** are controlled by
municipalities and MTO, and that owner data is personal information protected under
provincial privacy law. CivicPass cannot query or scrape it.

The legitimate design is an **authorized delivery channel**:

```
camera → processing centre (human review, plate→owner via MTO)
       → issues Penalty Order
       → PUSHES the issued notice to CivicPass, by plate, signed
       → CivicPass matches it to the ENROLLED owner → push + in-app
```

CivicPass **never holds its own plate→owner database.** It only matches a pushed
notice to a person who has already enrolled and proven they own that plate; everyone
else continues to get the mailed notice (`deliveredVia: 'mail'`).

## The API contract

### Endpoint
`POST /v1/integrations/camera-events` — one event, or `{ "events": [ ... ] }` up to 500.
Returns `202` with a per-event `results` array. Idempotent on `eventId` (safe retry).

### Event shape
```jsonc
{
  "eventId": "jpc-2026-7f3a91",        // upstream id; idempotency key
  "type": "red_light",                  // "red_light" | "speed"
  "plate": "CVPS123",
  "jurisdiction": "ON",                 // 2-letter; non-home goes to inter-jurisdictional queue
  "capturedAt": "2026-10-20T14:03:11Z",
  "location": "Example Ave & Sample St (NB)",
  "municipality": "Toronto",
  "images": ["evidence://…"],           // references, fetched on demand — not blobs
  "setFine": 325,
  "noticeNumber": "PO-2026-000987",     // optional; the issued Penalty Order number
  "reviewedAt": "2026-10-21T09:00:00Z", // optional; when it was adjudicated
  "recordedSpeedKmh": 72, "postedLimitKmh": 50, "secondsIntoRed": 1.4  // as applicable
}
```

### Authentication — two layers
1. **Coarse gate (always):** `x-api-key: <INTEGRATION_API_KEY>`, timing-safe compared.
2. **Per-partner request signing (live mode):** every push must carry
   - `x-civicpass-partner`: the partner id
   - `x-civicpass-timestamp`: unix seconds (must be within the replay window, default ±300s)
   - `x-civicpass-signature`: hex **HMAC-SHA256** over the string `"<timestamp>.<rawBody>"`
     using that partner's shared secret.

   The signature is verified against the **exact raw request bytes**, so any tampering
   (or a replayed stale request) is rejected with `401`. A partner may only submit
   tickets for the **municipalities it is authorized for**; others return
   `{ outcome: "rejected", reason: "unauthorized_municipality" }`.

### Responses (per event)
| outcome | meaning |
|---|---|
| `created` (`deliveredVia: "app"`) | matched an enrolled owner; push + in-app |
| `created` (`deliveredVia: "mail"`) | matched owner has no account; legacy mail continues |
| `duplicate` | this `eventId` was already processed |
| `unmatched` (`plate_not_found` / `out_of_province`) | queued for review, not dropped |
| `rejected` (`unauthorized_municipality`) | partner not authorized for that municipality |

Unmatched events are reviewable at `GET /v1/integrations/camera-events/unmatched` and
are **purged after `CAMERA_UNMATCHED_RETENTION_DAYS`** (default 90) so the queue never
becomes a lasting store of plate data.

## Going live (after the agreement)
Set two things and the pipeline is live — no code change:
```bash
CAMERA_INTEGRATION_MODE=live
CAMERA_PARTNERS='[{"id":"toronto-jpc","secret":"<shared-hmac-secret>","municipalities":["Toronto"]}]'
# optional:
CAMERA_MAX_CLOCK_SKEW_SECONDS=300
CAMERA_UNMATCHED_RETENTION_DAYS=90
```
In `demo` mode (the default outside production) the coarse `x-api-key` alone is
accepted, so local dev, tests and the in-app simulator keep working.

**Production hardening on top of signing:** terminate the partner connection with
**mTLS + IP allow-listing**, rotate the HMAC secret, and keep secrets in a managed
vault (never in the repo or an env dump).

## What the data-sharing agreement needs — both sides

**From the authority / processing centre (MTO / municipality):**
- Legal basis + agreement to push *issued notices* (not scans) for its plates.
- The partner id + a shared HMAC secret (rotatable), delivered out of band.
- Which municipalities the partner is authorized to submit.
- Field mapping to the event shape above; evidence-image access method (signed URLs).
- Confirmation that the mailed notice remains the legal service method.

**From CivicPass:**
- The signed-webhook spec above (this document).
- Owner matching only for enrolled, plate-verified users; mail fallback otherwise.
- No plate→owner database held; unmatched retention + purge; audit of its own actions.
- A delivery result per event the authority can reconcile.

## Where it lives
| Part | File |
|---|---|
| Endpoint, signing & municipality authorization | `apps/api/src/app.ts` (`/v1/integrations/camera-events`, `requireCameraPartner`) |
| Matching, fine creation, notify, retention prune | `apps/api/src/fines.ts` (`ingestCameraEvent`, `pruneUnmatchedCameraEvents`) |
| HMAC helpers | `apps/api/src/crypto.ts` (`hmacSha256Hex`, `timingSafeEqualHex`) |
| Config (mode, partners, windows) | `apps/api/src/config.ts` (`camera`) |
| Nightly retention sweep | `apps/api/src/server.ts` |
| Tests | `apps/api/test/camera-integration.test.ts` |

The app side (push notification + the ticket appearing on `/fine/:id`, pay, dispute)
is already built and covered by the mobile app and demo backend.
