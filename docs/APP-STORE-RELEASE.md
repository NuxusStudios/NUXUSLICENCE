# Shipping to the App Store and Google Play

The mobile app is a standard Expo project. Expo Application Services (EAS) builds signed iOS and Android binaries in the cloud, so you don't need a Mac.

## Before you can publish

1. **Publisher account.** Apple and Google expect apps that handle government ID, government services or other sensitive regulated data to be published by **the government entity itself** (or an explicitly authorised vendor). See [ONTARIO-CONSIDERATIONS.md §10](./ONTARIO-CONSIDERATIONS.md). Check the current wording of App Store Review Guideline 5.1.1 and Google Play's government-apps policy when you submit.
2. **Accounts:** an Apple Developer Program **organisation** membership and a Google Play Console **organisation** account.
3. **Identifiers:** replace `ca.example.civicpass` in `apps/mobile/app.json` (`ios.bundleIdentifier`, `android.package`) with the publisher's reverse-DNS id.
4. **Branding:** swap `assets/icon.png` and the adaptive icons, plus the colour tokens in `src/lib/theme.ts`, for the publisher's design system.
5. **Production API URL:** set `EXPO_PUBLIC_API_URL` in `eas.json` → `build.production.env`.
6. **Prototype watermark:** leave `EXPO_PUBLIC_PROTOTYPE=true` until the issuing authority signs off. It stamps "SPECIMEN · PROTOTYPE" on every document.

## Build

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init                 # creates the EAS project, writes extra.eas.projectId (needed for push)
npx eas-cli@latest build --profile preview --platform all     # internal test builds (TestFlight / internal track)
npx eas-cli@latest build --profile production --platform all  # store builds
```

## Submit

```bash
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android
```

Fill in `submit.production` in `eas.json` first: the App Store Connect app id, and the Google service-account JSON.

## Store listing checklist

- **Privacy:** App Store privacy nutrition label and Google Play Data safety form. The data collected includes name, DOB, address, government ID numbers, photos (selfie for IDV), payment info (handled by the processor), and device push tokens.
- **Permissions copy:** camera (document scan + QR verification) and Face ID are already in `app.json`.
- **Encryption export:** `ITSAppUsesNonExemptEncryption: false` is set because only standard HTTPS/OS crypto is used. Re-check if you add custom crypto.
- **Review demo account:** reviewers need a working login. Use a staging API seeded with demo data (`demo@civicpass.example / Demo1234!`).
- **Accessibility:** declare supported features (VoiceOver/TalkBack, Dynamic Type, dark mode).
- **Bilingual listing:** English and French store text and screenshots.

## Over-the-air updates

JS-only fixes can ship without store review:

```bash
npx eas-cli@latest update --branch production --message "Fix ticket list sorting"
```

Native changes, such as adding a module or changing permissions, need a new store build.
