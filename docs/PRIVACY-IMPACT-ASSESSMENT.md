# Privacy Impact Assessment (PIA) — draft

> **Draft for legal/privacy review.** CivicPass is a prototype. A real deployment
> handling Ontario government data must complete a PIA with the institution's
> privacy office under **FIPPA** (and, for any health-card data, **PHIPA**), and
> likely a Threat Risk Assessment (TRA). This document frames that work; it is not
> a substitute for the institution's own assessment or legal advice.

## 1. Overview

CivicPass is a resident-held digital wallet for Ontario government documents
(driver's licence, vehicle permit, health card, photo card) and services
(renewals, address change, ticket payment, appointments). It shows a resident
their own records and lets them present verifiable claims to third parties.

## 2. Personal information handled

| Data | Source | Sensitivity | Purpose |
|---|---|---|---|
| Name, DOB, address, licence number | MTO / ServiceOntario registry (mirror) | High | Identity, document display |
| Document status (valid/suspended/expired) | MTO driver record | High | Live status |
| Health card number | OHIP (PHIPA-governed) | **Very high** | Document display |
| Vehicle/plate records | MTO | Medium | Permit display, camera matching |
| Ticket / POA case data | Municipal APS, POA Online Services | High | Fines, court status |
| Account (email, phone, password hash, PIN hash, push tokens) | Resident | High | Auth, notifications |
| Identity-proofing result | IDV vendor | High | IAL2 binding at registration |
| Access log (who verified what, when) | App | Medium | Transparency to resident |

## 3. Data-minimization & design choices already made

- **Resident-held, selective disclosure.** Presentations are short-lived signed
  claims (ES256, ~90s TTL), not bulk data dumps; the resident approves each share
  and can revoke (`consents`, `walletRevokedAt`, `revokedPresentationIds`).
- **Mirror, not master.** The authoritative record stays with the institution;
  the app syncs via an adapter and never becomes the system of record.
- **Retention limits.** Unmatched camera events auto-purge (`CAMERA_UNMATCHED_RETENTION_DAYS`);
  OTPs and resets are short-lived.
- **No raw secrets stored.** Passwords/PINs are scrypt-hashed; signing keys belong
  in an HSM/KMS in production.
- **Opaque auth errors** to prevent record/account enumeration.

## 4. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Device loss | Biometric lock, remote wallet revoke, presentation revocation list |
| Over-collection | Selective disclosure; each presentation carries only the claims asked for |
| Linkage/profiling across services | Per-presentation tokens with `jti`; no shared correlator handed to verifiers |
| Health data (PHIPA) | Segregate OHIP data; separate consent; stricter access logging |
| Vendor (IDV/payments) data handling | DPAs with vendors; store only the result/reference, not raw biometrics or PANs |
| Insider access | Least-privilege, audit logging, no PII in application logs |
| Camera-match false positives | Matched strictly on registered plate; unmatched events retained briefly then purged |

## 5. Resident rights (FIPPA)

- **Access**: the app *is* the access mechanism to one's own records.
- **Correction**: routes to the issuing institution's correction process.
- **Erasure of the account**: documented erasure job removes the CivicPass account
  and derived data; the authoritative registry record is governed by the institution.

## 6. Open items for the institution's privacy office

- Confirm lawful authority / data-sharing agreement for each feed (MTO, ServiceOntario, OHIP, POA, municipal).
- PHIPA assessment for health-card data; decide whether it ships in v1.
- Cross-border/data-residency: all data at rest in Canada.
- Retention schedule sign-off per collection.
- Breach-notification plan.
