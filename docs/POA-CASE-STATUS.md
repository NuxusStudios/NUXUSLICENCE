# Court case status (Provincial Offences Act)

Red-light-camera, speed-camera and officer-issued tickets are prosecuted in the
**provincial-offences court**, not the municipal APS that parking uses. Their
**court case status** — before the court, a meeting or trial scheduled,
convicted with a fine owing, paid, in default, or withdrawn — **just shows up**
on the ticket in the app, refreshed automatically, so a user never has to go
looking it up on a government portal.

## What the user sees

On any camera or officer-issued ticket, a **court status card** shows:

- where the case stands, with a tone-coded badge and a plain-language line on
  what it means / what to do;
- the **fine owing to the court** and its due date, once convicted;
- the **next court event** (meeting with a prosecutor, or trial) with its date;
- "checked automatically · _N_h ago", and a manual **re-check** button.

The status is refreshed on every app open (with a short floor so one open
doesn't fan out to the court feed), by a nightly sweep, and on demand. When a
case turns **convicted** or goes **into default**, the holder gets a push/inbox
alert and the fine's own status is synced (paid → paid, withdrawn → cancelled,
in default → overdue — which still feeds the plate-renewal denial rule).

## Two paths in

1. **Already on the account (primary).** Camera and officer-issued tickets are
   matched to the owner/driver and already carry a `poaRef` (the ICON location
   code + offence number). Their court status is kept current automatically —
   the "just show up" path.

2. **Added by number.** A user with a ticket in hand can add it with its
   **location code + offence number** via `POST /v1/poa/lookup` — the same
   identifiers the public search takes. It's looked up, attached as an
   officer-issued ticket, and kept up to date from then on. (Offence numbers
   that aren't in the system yet return 404 with a "can take 10+ days to appear"
   message.)

## About the POA Online Services page

The page you pointed at —
`justiceservices.jus.gov.on.ca/POA/screens/poa/POASC003.search.xhtml` — is
Ontario's public **case-status search**. We looked at it closely:

- it's a stateful **JavaServer Faces** app with a ~20-minute session timeout:
  every request carries a `jsessionid` and a `javax.faces.ViewState` token;
- you search **one ticket at a time** by its location code + offence number (or
  a case number on a summons); it **cannot** list a person's cases;
- it is built for a human with a ticket in hand.

So it can't, by itself, make status "just show up," and it can't be safely or
permissibly automated (stateful, human-facing, session-bound). Production reads
status from the **court case-management integration** behind that page. Our
`POACaseStatusProvider` is the seam:

- **`DemoPOACaseStatusProvider`** (dev/demo) — derives a deterministic status
  from the ticket's identifiers, no network, with an override map so the demo
  tool and tests can move a case to convicted / in default.
- **`POAOnlineProvider`** (production) — reads status through the integration.
  Config-gated (`POA_PROVIDER=poa_online`, `POA_ENDPOINT`, `POA_API_KEY`);
  refuses to start without an endpoint.

## Case lifecycle

Modelled in `packages/shared/poa.ts`:

| Status | Meaning |
|---|---|
| `before_court` | Ticket is before the court — pay, request a meeting, or request a trial |
| `early_resolution_scheduled` | Meeting with a prosecutor scheduled |
| `trial_scheduled` | Trial scheduled |
| `convicted` | Convicted — fine owing by a due date |
| `in_default` | Fine unpaid and in default (can block plate renewal, go to collections) |
| `paid` | Fine paid, case closed |
| `withdrawn` | Charge withdrawn, nothing owing |
| `not_found` | Not in the court system yet |

## Scope

POA Online Services — and so this feature — covers camera and officer-issued
tickets only. It does **not** cover parking (that's the municipal APS, see
[PARKING-TICKETS.md](PARKING-TICKETS.md)), criminal matters, appeals or young
people. Mailed notices and the court's own records remain authoritative; the
app is a faster, clearer copy.

## Where it lives

| Layer | File |
|---|---|
| Shared core (lifecycle, refresh policy, bilingual labels) | `packages/shared/poa.ts` |
| API providers + add-by-number | `apps/api/src/poa.ts` |
| API refresh/sweep/routes | `apps/api/src/app.ts`, `apps/api/src/server.ts` |
| Demo backend mirror | `apps/mobile/src/lib/demo/backend.ts` |
| Court status card | `apps/mobile/src/components/kit.tsx` (`POACaseStatusCard`) |
| Fine detail + add-by-number | `apps/mobile/src/app/fine/[id].tsx`, `apps/mobile/src/app/(tabs)/fines.tsx` |
| Tests | `apps/api/test/poa.test.ts` |

Routes: `POST /v1/fines/:id/case-status/refresh` (manual re-check),
`POST /v1/poa/lookup` (add by number), `POST /v1/demo/case-status/:id` (demo
flip). `/v1/me` and the fines routes refresh POA status on read.
