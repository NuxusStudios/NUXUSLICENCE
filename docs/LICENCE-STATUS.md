# Automatic driver's-licence status

CivicPass keeps each user's driver's-licence status fresh on its own. The user
proves the licence is theirs **once** at sign-up (document scan + liveness,
matched to the registry); after that they never type their licence number
again. Opening the app is enough to see **Valid / Not valid / Expired** with any
conditions (e.g. ignition interlock), and a change to a bad status raises an
alert.

## Where the status comes from

The authoritative source is **Ontario's MTO driver record** — the same system
of record behind ServiceOntario's public
[Driver's Licence Check](https://www.dlc.rus.mto.gov.on.ca/dlc/enter-details).

That public page is **not** our integration point, and we do not drive it:

- it is a **human-only** tool — every order is gated by an invisible Google
  reCAPTCHA, which exists to block software;
- it is **one order at a time** (up to 100 numbers), with a session that times
  out, and a Terms of Use and privacy notice written for a person checking a
  licence they're entitled to check;
- it returns a **status string** per number, not a feed.

Automating that page would defeat its CAPTCHA and breach its terms against a
government system. Instead, production connects to **MTO's account-based
batch/API feed** for driver-record status under a data-sharing agreement — the
same feed the public page is a thin front-end for. (The public service's
"company" fields and 100-per-order batch are the tell that an account-based
service exists for exactly this.) This is one of the integrations already in
the MTO proposal.

## Status vocabulary

Mirrored from the live service so a real adapter maps 1:1
(`packages/shared/licence-status.ts`):

| MTO code | Shown as | Notes |
|---|---|---|
| `Valid` | **Valid** (green) | In good standing |
| `ValidWithIgnitionInterlock` | **Valid** + "Ignition interlock required" | |
| `ValidWithIgnitionInterlockAndWCode` | **Valid** + interlock + "Condition W" | |
| `NotValid` | **Not valid** (red) | Suspended / cancelled; QR presentation is blocked |
| `NotFound` | **No record found** (red) | No matching record; prompts support |
| *(local)* | **Expired** (amber) | `Valid` + a past card expiry date |

## How it refreshes

- **On app open** — `GET /v1/me` and `GET /v1/wallet` refresh the status
  (`refreshLicenceStatuses`). Per your setting, this runs on every open; a
  configurable floor (`LICENCE_RECHECK_MIN_SECONDS`, default 0 in dev, 300s in
  prod) reuses a very recent result so one screen-open doesn't fan out into many
  calls to the metered feed.
- **On demand** — `POST /v1/wallet/:id/status/refresh` (the refresh button on
  the licence screen).
- **Nightly sweep** — `server.ts` calls `app.sweepLicenceStatuses()` once a day
  to re-check everyone in one batched pass (how the MTO feed is meant to be
  used) and alert on changes. In production this moves to a scheduled worker.

A change to **suspended** or **no record** writes a security alert to the inbox
(and push, when enabled); recovery to **valid** writes a friendly note. A
suspended licence can no longer be presented as a QR code.

## Swapping in the real feed

Everything goes through `LicenceStatusProvider` (`apps/api/src/licence-status.ts`):

- **`DemoLicenceStatusProvider`** (default in dev/demo) — deterministic status
  per licence number, with an override map the demo tool and tests use to show a
  suspension arriving. No network.
- **`MtoBatchLicenceStatusProvider`** (production) — posts an ordered list of
  licence numbers and reads a status per number. The request/response shape is
  the seam; it's finalized against MTO's account API spec when the agreement is
  in place. Set `LICENCE_STATUS_PROVIDER=mto_batch`, `MTO_DLC_ENDPOINT` and
  `MTO_DLC_API_KEY`. Without an endpoint it refuses at startup rather than
  guessing.

No route, model or app change is needed to switch — only the provider.

## Privacy

Only the holder's own licence is checked, and only after they verified it is
theirs. The stored result is a status code plus a timestamp, not a copy of the
driver record. The check runs on the person's behalf to power their own wallet —
distinct from a third-party data request, which still goes through consent
(`/v1/consents`).
