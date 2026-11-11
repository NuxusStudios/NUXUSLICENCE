# Polis Pass — iOS release runbook (TestFlight first)

This is the step-by-step to build and ship the iOS app. The build and upload run on
**EAS Build (Expo's cloud)** and on **App Store Connect** — both need *your* credentials,
so they can't be run from a Claude cloud session. Run them from your own machine.

## What's already done (in the repo)

- App renamed to **Polis Pass** (display name, slug `polis-pass`, scheme `polispass`).
- Bundle identifier set to **`com.polispass.app`** (iOS and Android). ⚠️ This is permanent
  once the app is first submitted — don't change it later.
- `eas.json` build profiles configured. `production` and `preview` both run with
  `EXPO_PUBLIC_PROTOTYPE=true` (the SPECIMEN watermark stays on) and
  `EXPO_PUBLIC_DEMO_MODE=true` (the app runs on its built-in demo backend, so a tester /
  reviewer can use it with no live server — sign in with `demo@polispass.com` / `Demo1234!`).
- App icon is 1024×1024, no alpha (Apple-compliant). `expo-doctor` 21/21, typecheck + lint clean.

## Prerequisites (one-time)

1. **Apple Developer Program** membership (paid, US$99/yr) on your Apple ID.
2. An **Expo account** (free) — https://expo.dev.
3. `eas-cli` on your machine: `npm i -g eas-cli` (or prefix every command with `npx eas-cli@latest`).

## Steps

Run everything from `apps/mobile/`.

```bash
# 1. Log in to Expo
eas login

# 2. Link this project to your EAS account (writes extra.eas.projectId into app.json — commit it)
eas init

# 3. Build a store-distribution iOS app. On first run EAS offers to log into your Apple
#    account and auto-create the bundle id (com.polispass.app), distribution certificate
#    and provisioning profile. Say yes.
eas build --platform ios --profile production
```

> **Which profile for TestFlight?** Use `production`. TestFlight needs an *App Store
> distribution* build. The `preview` profile is `distribution: internal` (ad-hoc / simulator)
> for testing *outside* TestFlight — not what you upload to App Store Connect.

```bash
# 4. In App Store Connect (https://appstoreconnect.apple.com), create the app record:
#      Platform: iOS   Name: Polis Pass   Bundle ID: com.polispass.app
#    Open the app → App Information → copy the "Apple ID" number (the ascAppId).
#    Paste it into eas.json → submit.production.ios.ascAppId (replacing the REPLACE_... placeholder), commit.

# 5. Upload the build to App Store Connect / TestFlight
eas submit --platform ios --profile production

# 6. In App Store Connect → TestFlight: the build appears after processing (~5–15 min).
#    Add internal testers (your team) — they get it immediately. External testers need a
#    short Beta App Review first.
```

## Before a *public* App Store release (not needed for TestFlight)

TestFlight internal testing has no App Review gate, so the steps above are enough to get
the app onto testers' phones now. A **public** release is different and has a real blocker:

- **Authorization.** Polis Pass presents government documents (driver's licence, health card,
  vehicle permit). Apple's App Review guidelines (4.1 impersonation, 5.0 legal / government
  services) mean a public digital-ID wallet that is **not published by, or authorized by, the
  issuing authority** is routinely rejected. A public launch needs the issuing authority's
  sign-off — the same "data agreement" the business model treats as the keystone. Until then,
  keep `EXPO_PUBLIC_PROTOTYPE=true` and distribute via TestFlight only.
- Bump `version` in `app.json` to `1.0.0`, add App Store screenshots, privacy policy URL,
  and complete the App Privacy questionnaire.

## Notes

- `version` (`0.1.0`) is the user-facing version string; the iOS build number is
  auto-incremented remotely by EAS (`appVersionSource: remote`, `autoIncrement: true`).
- `npm audit` reports transitive-dependency advisories typical of a React Native tree. Don't
  run `npm audit fix --force` — it pulls in breaking major versions. Address real ones case by case.
- Android (Google Play) uses the same `com.polispass.app` package and
  `eas build/submit --platform android` once you add a Play service-account key.
