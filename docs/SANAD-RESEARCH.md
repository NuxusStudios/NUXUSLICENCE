# Sanad (Jordan): what it does and how CivicPass maps to it

> **How this was gathered:** `sanad.gov.jo` is blocked from the build environment's network, so the page could not be scraped directly. The summary below comes from public reporting and app-store listings found via web search (sources at the bottom). Before quoting any of these figures externally, confirm them against the live site.

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
| — (not in Sanad reporting) | **Transparency log**: who verified my ID, and when | `apps/mobile/src/app/access-log.tsx` |
| — | **Lost phone**: revoke every outstanding QR code | `POST /v1/me/revoke-wallet` |
| — | **Bilingual EN/FR** (required for Ontario) | `apps/mobile/src/lib/i18n.tsx` |

## Sources

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
