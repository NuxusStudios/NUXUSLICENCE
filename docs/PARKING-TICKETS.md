# Parking tickets (municipal APS)

Parking tickets behave like camera tickets: they **just show up** on the
registered owner's account. A user never has to go looking — a ticket issued to
one of their plates appears in the app with its amount and deadlines, and they
pay or dispute it in a tap.

## Two paths in, mirroring how Ontario actually works

1. **Pushed by the municipality (primary).** Parking enforcement posts an
   issued ticket to `POST /v1/integrations/parking-events` (by plate). We match
   the plate to the registered owner and the ticket lands on their account with
   a push/inbox alert. Idempotent on the penalty-notice number. This is the
   "just show up" path and the partner-city integration in the MTO/city
   proposal. Out-of-province or unknown plates go to a review queue
   (`/v1/integrations/parking-events/unmatched`).

2. **Added by number (for a paper ticket).** A user who was handed a paper
   ticket can add it with its **Penalty Notice/Order #** via
   `POST /v1/parking/lookup`. This is what Ottawa's public portal does — look up
   one ticket by its number — and it's matched to one of the user's plates
   before it's attached.

## About the gtechna portal

The page you pointed at —
`portal.gtechna.com/userportal/ottawa/ticketSearch1.xhtml` — is Ottawa's public
**pay-or-dispute** portal (vendor: gtechna). We looked at it closely:

- it's a stateful **JavaServer Faces** app: every request carries a
  `jsessionid` and a `javax.faces.ViewState` token, replayed per click;
- it searches **one ticket at a time** by its Penalty Notice/Order #, and
  **cannot** list a person's tickets by plate;
- it is built for a human with one ticket in hand.

So it can't, by itself, make tickets "just show up," and it can't be safely or
permissibly automated (stateful, human-facing, session-bound). Production
integrates with the **municipality's parking system** — gtechna provides a
back-office/integration interface for municipalities and authorized integrators
— for both the push feed (by plate) and the lookup/pay/dispute by number. Our
`ParkingAuthorityProvider` is the seam:

- **`DemoParkingAuthorityProvider`** (dev/demo) — resolves a notice number to a
  deterministic ticket, no network.
- **`GtechnaParkingProvider`** (production) — looks a ticket up through the
  municipal integration. Config-gated (`PARKING_PROVIDER=gtechna`,
  `PARKING_ENDPOINT`, `PARKING_API_KEY`); refuses to start without an endpoint.

## Administrative Penalty System (APS) timeline

Toronto, Ottawa and other Ontario municipalities have moved parking off the
provincial-offences court onto an APS. A ticket is an administrative **penalty
notice**; the timeline the Ottawa portal publishes is modelled in
`packages/shared/parking.ts`:

| Day | What happens |
|---|---|
| 0 | Penalty notice issued — **early-payment amount** applies |
| 1–15 | Early-payment period (reduced amount) |
| 16 | Set fine + Notice of Overdue Parking Penalty |
| 45 | Last day to request a **screening review** |
| 46 | Notice of Impending Default |

The app computes the **stage** and **amount due now** from the issue date (no
polling needed), so:

- the fine screen shows the penalty-notice number, the stage badge (early /
  set fine / overdue / in default), the early-payment amount and deadline, and
  the screening-review deadline;
- **Pay** charges the correct amount for the stage — the discounted early
  amount inside the window, the set fine after, plus an overdue penalty once
  overdue (server-authoritative; the client never sets the price);
- **Dispute** offers the APS path — **screening review**, then **hearing** —
  instead of the provincial-offences court's early-resolution/trial, which
  remain for camera and officer-issued tickets. The option set comes from
  `disputeOptionsFor(source)`.

Overdue parking penalties still feed the existing plate-renewal denial rule.

## Privacy & scope

Tickets are owner-liability with no demerit points. A pushed ticket is matched
to the registered owner by plate; an added-by-number ticket is matched to one
of the user's plates before it's attached. Mailed notices remain the legal
service method; the app is a faster, clearer copy.
