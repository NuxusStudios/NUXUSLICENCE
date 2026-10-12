# Sanad (Jordan): what it does and how CivicPass maps to it

> **How this was gathered:** read directly from `sanad.gov.jo` in October 2026: the landing, About, FAQ, Services Directory (per-entity service lists), Stations, Contact and Privacy pages, plus the site's public English UI strings (`/i18n/en.json`, about 4,300 strings that describe every signed-in screen). Usage figures come from public reporting (sources at the bottom). Confirm figures against the live site before quoting them externally.

## What Sanad is

Sanad is Jordan's national digital-government app and portal, run by the Ministry of Digital Economy and Entrepreneurship. It does three jobs:

1. **Government wallet.** Holds digital versions of the national ID, **driver's licence** and **vehicle registration**. Jordan's amended Civil Status Law (2026) gives the Sanad digital ID the same legal standing as the physical card.
2. **Single sign-on.** One verified digital identity logs you in to every connected service.
3. **Services hub.** 500 to 550+ online services from 50+ public (and some private) bodies, about 80% of the government's services.

## Features reported

| Area | Sanad capability |
|---|---|
| Identity activation | Originally done in person at "Sanad stations". A 2026 upgrade added **in-app activation**, so no visit is needed. |
| Wallet | National ID, driver's licence, vehicle registration, shown as official digital documents |
| Traffic | Manage vehicle and licence transactions, **view and pay traffic violations** |
| Vehicles | Vehicle registration renewal |
| Passports | E-passport services |
| Payments | In-app payment from application to completion, with no redirect. Credit card, direct transfer, and now **Apple Pay and Google Pay** |
| Digital signature | Sign documents in-app, with the option to save a signature for reuse |
| Digital mailbox | Official notifications and government correspondence delivered in-app |
| Bills | Utility bills and fines |
| Records | Review personal records held by government |

**Scale (2026 reporting):** about 2.6M activated digital IDs, about 1.3M monthly users, close to 6M monthly transactions.

## What the site and app show (direct reading, Oct 2026)

**Landing page:** announcement strip ("Now: you can purchase distinguished plate numbers…"); hero "Your digital identity, your gateway to all government services"; three pillars, **Digital Documents**, **Electronic Payments** and **Digital Signature**; app download; four "why" points (Secure and Trusted, Easy to Use, Comprehensive, Multi-Channel Support); FAQ preview; footer (About, Help & Support, FAQ, Sanad Stations, Rating & Complaints, Privacy Policy).

**Services Directory:** 34 government entities, each with a service count (for example, Civil Status and Passports 18, Driver and Vehicle Licensing 13, Social Security 36). Services are tagged by category (Vehicles and Traffic, Civil Affairs and Records, Legal Services…), with search, grid and list views and pagination. Each service has a **service card**: about, available on (web, Android, iPhone, Huawei), fees, steps, conditions, required documents and technical support. Driver and Vehicle Licensing services include licence renewal, vehicle licence renewal, plate and licence replacement, vehicle enquiry, historical vehicle status and **distinguished plate numbers purchase**.

**Signed-in app (from the UI strings):**

| Area | What Sanad does |
|---|---|
| Dashboard | Widgets: **Actions** ("Renew your Driving License now — expires in N days", or "You're all set"), **Favourite cards** (up to 5, flip front/back), **Quick access** (My requests, My signature, Verify document QR, Signature verifier, My consents, Appointments, Payment history), **Favourite services** (customizable, with a maximum), **Violations** (traffic and environmental tabs, "Pay all (with discount)"), appointments, digital mailbox, property tax, income tax and social security, some hidden behind a "Show data" privacy toggle |
| Documents | Categories, search, flip card, copy all information, download as PDF, share, QR for verification, **request an update to information** (select fields, describe), **request an unlisted document** |
| My Requests | Requests across all entities with a per-entity summary; statuses In Progress, Awaiting Payment, Awaiting Additional Information / Returned for Missing Data, Completed, Rejected, Cancelled; pay now, cancel, resubmit, download file; "request submitted" dialog with application ID and payment number |
| Appointments | Book entity → branch → service → date (up to one week ahead) → morning/afternoon/evening slot → **review requirements and acknowledge** → confirm; current and past appointments; cancel; **activate 30 minutes before** and get a **queue ticket** ("awaiting call") |
| My Consents | Third-party data requests (requesting party, document, purpose, dates, validity); Approve, Reject, Revoke; filters by status and expiry |
| My Signature | Upload or choose a document, draw a signature (optionally saved), confirm with **digital ID PIN** or OTP; statuses Draft…Completed; signed files deleted after 7 days |
| Payments | Payment gateway with success, pending, failed and cancelled result screens; payment history with details (biller, payment number, reference, method, card and service fees); card management; payment policy |
| Account | Digital identity status, national ID, birth date; mobile and email change with OTP; change password with live rules (8–30 characters, upper, lower, number, symbol, no spaces); digital ID **PIN** change (reset at a Sanad station); favourite cards; notifications; logout confirmation |
| Auth | Sign in with national ID and password; forgot password: national ID → confirm phone ending in ••• → OTP → new password → success |
| Support | FAQ; Suggestions & Complaints (topic, details, optional file); Rate your experience (rating plus "what can be improved" chips); CX survey card with "Remind me later"; "Request a new service" suggestion |
| Stations | Sanad stations by governorate with "Near me" |
| Guests | Non-activated users can use the app as guests with limited features |

**Look and feel:** IBM Plex Sans Arabic; primary blue `#0A4FD8`; gold `#F5BD02` for highlights; very light grey ground `#F9FAFB`; white cards with `#E5E7EB` borders; Material components. CivicPass keeps its own palette (no Jordanian or Ontario branding) and borrows the structure: dashboard widgets, gold highlight for announcements and "needs attention", service cards and steppers.

## Sanad → CivicPass mapping (what this repo implements)

| Sanad | CivicPass equivalent | Where |
|---|---|---|
| Digital ID activation (in-app) | 3-step onboarding: registry match → document scan + liveness selfie → account | `apps/mobile/src/app/(auth)/register.tsx`, `POST /v1/auth/register` |
| Wallet: driver's licence, vehicle registration | Driver's licence, health card, vehicle permits, with signed QR presentation and selective disclosure (e.g. "19+ only") | `apps/mobile/src/app/credential/[id].tsx`, `POST /v1/wallet/:id/presentations` |
| Verifying a digital ID | Verifier mode (police, retail, landlords) plus a public JWKS for offline checks | `apps/mobile/src/app/verify.tsx`, `POST /v1/verify`, `/.well-known/jwks.json` |
| Traffic violations | Red-light and speed camera tickets **automatically linked to the plate's registered owner**, plus parking and officer-issued tickets | `POST /v1/integrations/camera-events`, `apps/api/src/fines.ts` |
| Pay fines in-app (Apple Pay / Google Pay) | Payment sheet: Apple Pay (iOS), Google Pay (Android), Interac, card | `apps/mobile/src/app/pay.tsx`, `apps/api/src/payments.ts` |
| Dispute / court | Early-resolution meeting or trial request from the ticket | `apps/mobile/src/app/dispute/[id].tsx` |
| Vehicle registration renewal | Plate renewal, blocked while tickets are overdue | `POST /v1/vehicles/:id/renew` |
| 500+ services | Data-driven service catalogue (renew licence, change address everywhere at once, driver record, road test, ownership transfer, accessible parking, health card) | `apps/api/src/catalog.ts` |
| Digital signature | Consent-based signing; the document hash is signed with the issuer key | `apps/mobile/src/app/sign.tsx`, `POST /v1/signatures` |
| Digital mailbox | Inbox plus push notifications with deep links | `apps/mobile/src/app/inbox.tsx`, `apps/api/src/notifications.ts` |
| Dashboard widgets (Actions, favourite cards, quick access, favourite services, violations with Pay all) | Home dashboard with all of these; tickets total behind a privacy toggle | `apps/mobile/src/app/(tabs)/index.tsx`, `dashboardActions()` in `packages/shared/platform.ts` |
| Services Directory by entity, service card | Directory by category or organization (ServiceOntario, MTO, DriveTest, Health, Registrar General, courts); card with channels, fee breakdown, steps, conditions, documents; 3-step application | `components/ServicesDirectory.tsx`, `app/services/[id].tsx` |
| My Requests and statuses | Lifecycle: in review, awaiting payment, action required (resubmit), completed with result, rejected, cancelled; timeline | `app/requests/*`, `/v1/service-requests/*` |
| Appointments and queue ticket | Book ServiceOntario/DriveTest visits up to 7 days ahead; requirements acknowledgment; check-in from 30 min before issues a ticket | `app/appointments/*`, `/v1/appointments/*` |
| My Consents | Data requests from insurers, rentals, landlords; approve with PIN, reject, revoke, expiry | `app/consents.tsx`, `/v1/consents/*` |
| Distinguished numbers | Personalized plates: availability check, reserved and taken rules, suggestions, order then pay | `app/plates.tsx`, `/v1/plates/*` |
| Digital ID PIN | 4-digit PIN set at sign-up, required to sign and to approve data sharing | `app/security/pin.tsx`, `/v1/me/pin` |
| My Signature | Choose document, draw or reuse saved signature, PIN, 7-day retention | `app/sign.tsx`, `/v1/me/signature` |
| Payment history, card management | History with filters and detail screen; saved cards (display details only); Pay all tickets | `app/payments.tsx`, `app/payment/[id].tsx`, `app/cards.tsx` |
| Document update request, unlisted document | Request a correction; request a missing document; copy all information; related services | `app/credential/[id].tsx` |
| Forgot password, password rules, OTP | Same 4-step flow; phone verified by code at sign-up | `app/(auth)/forgot.tsx`, `/v1/auth/password-reset/*`, `/v1/auth/otp` |
| Stations / Near me | ServiceOntario and DriveTest locations (sample data) with filters, directions, booking | `app/locations.tsx` |
| Help, complaints, rating, new service | Help centre FAQ, suggestions and complaints, rating, "suggest a new service" | `app/help/*`, `POST /v1/feedback` |
| Guest access | Browse services, locations, help and verify a QR without an account | `app/(auth)/welcome.tsx` |
| — (not in Sanad reporting) | **Transparency log**: who verified my ID, and when | `apps/mobile/src/app/access-log.tsx` |
| — | **Lost phone**: revoke every outstanding QR code | `POST /v1/me/revoke-wallet` |
| — | **Bilingual EN/FR** (required for Ontario) | `apps/mobile/src/lib/i18n.tsx` |

## Sources

- [sanad.gov.jo landing](https://www.sanad.gov.jo/en/landing), [Services Directory](https://www.sanad.gov.jo/en/directory), [About](https://www.sanad.gov.jo/en/about), [Stations](https://www.sanad.gov.jo/en/stations), [Rating & Complaints](https://www.sanad.gov.jo/en/contact), [Privacy Policy](https://www.sanad.gov.jo/en/privacy-policy) (read Oct 2026)

- [Sanad FAQ](https://www.sanad.gov.jo/en/faq)
- [SanadJo on the App Store](https://apps.apple.com/us/app/sanadjo-%D8%B3%D9%86%D8%AF/id1487779718)
- [Biometric Update: Major upgrade to Jordan's Sanad digital ID app adds instant activation](https://www.biometricupdate.com/202601/major-upgrade-to-jordans-sanad-digital-id-app-adds-instant-activation)
- [Biometric Update: Jordan grants legal status to Sanad digital ID as users pass 2.6M](https://www.biometricupdate.com/202605/jordan-grants-legal-status-to-sanad-digital-id-as-users-pass-2-6m)
- [Mobile ID World: Sanad in-app activation, Apple Pay and Google Pay](https://mobileidworld.com/jordan-update-lets-sanad-users-activate-digital-id-in-app-adds-apple-pay-and-google-pay/)
- [Jordan Times: Gov't launches major Sanad app upgrade](https://jordantimes.com/news/local/govt-launches-major-sanad-app-upgrade-to-improve-service-efficiency)
- [Jordan Times: Sanad app users stand at 2.5m](https://jordantimes.com/news/local/sanad-app-users-stand-at-25m-as-new-services-roll-out)
- [Petra: Over 2.6 million citizens activated digital IDs](https://petra.gov.jo/gweb/index.php/en/news/over-26-million-citizens-activated-digital-ids-on-sanad-app)
- [World Bank GovTech case study: the SANAD portal](https://documents1.worldbank.org/curated/en/099020224094537272/pdf/P16948214420920a71a3431a36316364cb4.pdf)
- [Wikipedia: Sanad (government app)](https://en.wikipedia.org/wiki/Sanad_(government_app))
