# CivicPass: a Sanad-style digital government wallet (Ontario prototype)

A mobile app (iOS and Android) plus a backend API that puts your **driver's licence, vehicle permits and health card on your phone**, **links red-light and speed camera tickets to the vehicle owner's account automatically**, and lets people **pay, dispute, renew and sign** without visiting an office. It is modelled on Jordan's [Sanad](docs/SANAD-RESEARCH.md) platform.

> ⚠️ **Prototype.** Every document is watermarked "SPECIMEN · PROTOTYPE", all data is fictional, and payments and identity verification are simulated. It is not affiliated with or endorsed by the Government of Ontario or MTO. To go live, the province has to commission it and publish it. See [docs/ONTARIO-CONSIDERATIONS.md](docs/ONTARIO-CONSIDERATIONS.md).

## What's inside

```
apps/
  mobile/   Expo (React Native) app: iOS, Android, plus a web build for previews
  api/      Fastify + TypeScript API: accounts, wallet, camera-ticket ingestion, payments
e2e/        Playwright script that clicks through 21 user flows against the real API
docs/       Sanad research, architecture, Ontario legal/policy notes, store release guide
```

### Features

| | |
|---|---|
| **Digital wallet** | Driver's licence, health card, vehicle permits. A QR code (refreshed every 60s) lets you share **only what's needed**: full details, licence status for police, "19+ only" for a bar, or name and photo. |
| **Camera tickets → owner** | The camera processing centre posts events to the API. The plate is matched to the registered owner, the ticket appears in their app with evidence, and they get a push notification. Owner-liability rules apply: no demerit points. |
| **Pay & dispute** | Apple Pay, Google Pay, Interac, card. Request an early-resolution meeting or a trial from the ticket. |
| **Vehicles** | Plate renewal (blocked while tickets are overdue), insurance status, tickets per vehicle. |
| **Services** | Renew licence, change address (updates every document at once), driver record, road test, ownership transfer, accessible parking permit, health card renewal. |
| **Inbox** | Official notifications with deep links into the app. |
| **Digital signature** | Consent-based e-signing tied to the verified identity. |
| **Verifier mode** | Police and retailers scan and verify a QR code. Tampered, expired or revoked codes fail. |
| **Trust & privacy** | "Who verified my ID" log, revoke all QR codes for a lost phone, Face ID / fingerprint lock, Keychain/Keystore token storage. |
| **Bilingual** | English and French throughout. |

## Run it locally

Prerequisites: Node 20+ and the Expo Go app on your phone (or an iOS simulator / Android emulator).

```bash
# 1. API
cd apps/api
npm install
npm run dev          # http://localhost:4000, seeded with demo data

# 2. Mobile app (new terminal)
cd apps/mobile
npm install
# On a physical phone, point the app at your computer's LAN IP:
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000 npx expo start
# press i (iOS simulator), a (Android emulator), w (web), or scan the QR with Expo Go
```

**Demo login:** `demo@civicpass.example` / `Demo1234!`
**Try registering:** licence `L4321-09876-50302`, DOB `1985-03-02` (any email and password).

### Simulate a red-light camera ticket

```bash
curl -X POST http://localhost:4000/v1/integrations/camera-events \
  -H 'content-type: application/json' -H 'x-api-key: dev-camera-integration-key' \
  -d '{"eventId":"DEMO-1","type":"red_light","plate":"CVPS 123","jurisdiction":"ON",
       "capturedAt":"2026-10-01T14:00:00Z","location":"Example Ave & Sample St",
       "municipality":"Toronto","images":["evidence://1.jpg"],"secondsIntoRed":1.2,"setFine":325}'
```

The ticket appears in the demo user's **Tickets** tab and **Inbox** right away.

## Checks

```bash
cd apps/api && npm test            # 25 API tests (auth, camera matching, payments, signatures, revocation…)
cd apps/api && npm run typecheck
cd apps/mobile && npm run typecheck && npm run lint
# Full UI flows (API on :4000, web build served on :8081):
cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:4000 npx expo export --platform web
#   serve apps/mobile/dist on :8081 with SPA fallback, then:
cd e2e && npm install && npm test
```

## Next steps to production

1. **Province sponsorship and legal basis:** digital licence recognition, electronic service of notices. See [ONTARIO-CONSIDERATIONS.md](docs/ONTARIO-CONSIDERATIONS.md).
2. **Integrations:** driver and vehicle licensing system of record, camera processing centre, POA courts, payment acquirer, identity-verification vendor.
3. **Credential format:** move to ISO/IEC 18013-5 mDL for offline/NFC and Apple/Google Wallet.
4. **Persistence & security:** Postgres, HSM-backed signing keys, OIDC, rate limiting, PIA/TRA, pen test, accessibility audit.
5. **Publish** through the province's Apple and Google organisation accounts. See [APP-STORE-RELEASE.md](docs/APP-STORE-RELEASE.md).
