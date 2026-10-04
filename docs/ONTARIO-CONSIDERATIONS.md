# Ontario-specific design decisions and open questions

These shaped the code. Check each one with MTO, Ministry of the Attorney General (POA courts), and municipal legal counsel before building further.

## 1. Camera tickets follow the plate, not the licence

Ontario's red-light camera (RLC) and automated speed enforcement (ASE) offences are **owner-liability** offences. The notice goes to the **registered owner** of the vehicle, whoever was driving. **No demerit points** apply, and the owner's driving record is not affected.

So in this app, camera tickets attach to the **vehicle → registered owner's account**, not to the driver's licence:

- `ingestCameraEvent()` in `apps/api/src/fines.ts` looks up the plate, finds the owner, creates a `liability: 'owner'` fine with `demeritPoints: 0`, and notifies the owner.
- **Officer-issued** tickets are `liability: 'driver'`, attach to the licence holder, and can carry demerit points.
- The ticket screen explains the difference to the user.

If the team's goal is to bill *the driver* for camera tickets, that would need a legislative change. It is not a technical feature.

## 2. Speed cameras were banned in Ontario on 14 November 2025

Per reporting found during research, the province banned municipal speed cameras effective 14 November 2025. ASE tickets issued **before** the ban stay valid and payable. The integration still supports `type: 'speed'` because:

- legacy ASE tickets still need to be paid and disputed;
- the platform may serve other provinces or municipalities.

Red-light cameras are not affected by that ban.

## 3. Legal service of notices

Today, camera notices are served by **mail**. An in-app notification is not automatically legal service. The API therefore:

- always creates the fine on the owner's record;
- returns `deliveredVia: 'mail'` when the owner has no app account, so the processing centre keeps mailing;
- returns `deliveredVia: 'app'` when it notified in-app. Whether that can **replace** mail needs a regulatory change and the user's explicit consent to electronic service. Until then, treat in-app delivery as a courtesy copy.

## 4. A digital licence replacing the physical card

The Highway Traffic Act requires drivers to carry and surrender their licence. Letting a phone **replace** the plastic card (Sanad's model) needs:

- a legislative or regulatory amendment recognising the digital licence, as Jordan did in its 2026 Civil Status Law;
- police tooling to verify it (the verifier mode plus the `/v1/verify` endpoint);
- a standard format. **Recommendation:** issue the production credential as an **ISO/IEC 18013-5 mobile driving licence (mDL)**, which works offline with NFC/BLE and in Apple Wallet and Google Wallet. The signed-JWT QR in this prototype shows the same trust model (issuer signature, selective disclosure, short expiry, revocation) and can sit behind the same UI.

## 5. Plate renewal rules

- Ontario removed the plate-sticker **fee** for passenger vehicles, light trucks, motorcycles and mopeds, but renewal is still required. The API takes `PLATE_RENEWAL_FEE` (default `0`), and the app routes through payment only when a fee applies.
- **Unpaid defaulted fines block plate renewal.** The API enforces this (`409 unpaid_fines`).
- Valid **insurance** is required.

## 6. Fine amounts

`apps/api/src/fines.ts` has a **placeholder** victim fine surcharge table and a $5 court cost. It is tuned so a $325 RLC set fine totals $390, but it is **not** the official schedule. Load the official surcharge schedule before launch.

## 7. French language services

Provincial services must be available in French under the French Language Services Act. Every UI string goes through `t()` with full EN/FR dictionaries. Service catalogue entries carry `{ en, fr }` pairs.

**Known gap:** server-generated inbox and push notification text is English-only today. Localise it using `account.language`.

## 8. Accessibility (AODA / WCAG 2.0 AA)

Already in place: accessibility roles and labels on all controls, 48px+ touch targets, live-region countdown on the QR code, radio and checkbox semantics, dark mode, and system font scaling. Still needed: a formal audit with VoiceOver and TalkBack users.

## 9. Privacy (FIPPA, PIPEDA for any private verifiers)

- The app stores **only** the session token on the device (Keychain/Keystore via `expo-secure-store`). Document data is fetched live from the system of record.
- Selective disclosure: a bar or LCBO/OCS checkout gets "19+ ✓" and a photo match, not your address or DOB.
- Every verification is recorded in the holder's **"Who verified my ID"** log.
- A Privacy Impact Assessment (PIA) and a Threat/Risk Assessment (TRA) are mandatory before production.

## 10. Who publishes the app

App Store and Google Play rules require apps that handle government ID and services, or other sensitive regulated data, to be published by the **government entity itself** (or a formally authorised vendor) under its own developer account. A private team cannot publish an app that presents itself as an Ontario/MTO app. **Practical path:** build this as a pilot or proposal, then deliver it to the province to publish under its accounts. The prototype watermark (`EXPO_PUBLIC_PROTOTYPE`) stays on until that happens.

## Sources

- [Square One: Speed camera tickets in Ontario](https://www.squareone.ca/resource-centres/vehicle-owner/speed-cameras-ontario)
- [City of Toronto: Red Light Cameras](https://www.toronto.ca/services-payments/streets-parking-transportation/traffic-management/pavement-markings/red-light-cameras/)
- [Legal 500: Ontario's automatic enforcement system offence regime](https://www.legal500.com/intelligence/canada/transport/lights-camera-infractions-a-review-of-ontarios-automatic-enforcement-system-offence-regime-the-risks-to-commercial-vehicle-carriers-and-how-operators-can-protect-themselves)
- [Street Legal: Speed camera tickets in Ontario](https://street-legal.ca/speeding-camera-tickets-ontario/)
