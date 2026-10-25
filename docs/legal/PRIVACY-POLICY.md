# CivicPass — Privacy Policy (DRAFT)

> **Draft for privacy/legal review — not yet in force.** For a government
> deployment this must align with the institution's privacy policy, **FIPPA**
> (and **PHIPA** for health data), and the completed PIA (`docs/PRIVACY-IMPACT-ASSESSMENT.md`).
> The prototype uses demo data.

**Effective date:** `[date]` · **Contact / Privacy Officer:** `[contact]`

## 1. What we collect
- **You give us:** email, phone (optional), password, optional PIN, device push token.
- **From verification:** the pass/fail result of your identity check and the level
  of assurance — not your raw selfie or biometric templates (held by the IDV vendor).
- **From government sources (with authority/agreement):** your name, date of birth,
  address, licence/permit/health-card numbers and their status, vehicle records,
  tickets and court-case status.
- **Generated in use:** an access log of verifications you make, payments, requests,
  appointments, and in-app messages.

## 2. Why (purpose) & lawful authority
To show you your own records, let you present verifiable claims you choose to share,
and complete the services you request. Government data is accessed only under the
lawful authority / data-sharing agreement with each issuing institution.

## 3. How sharing works — you decide
CivicPass does not broadcast your data. When you present a credential, a short-lived
signed claim containing **only what the verifier needs** is created, with your
approval. You can review and revoke data-sharing consents and, if your device is
lost, revoke the whole wallet.

## 4. What we don't do
We don't sell your data, use it for advertising, or hand it to third parties except
to deliver the service you asked for (e.g. a payment processor for a fee you chose
to pay) or where required by law.

## 5. Storage, security, residency
Data is stored in **Canada**. Passwords/PINs are hashed; signing keys are held in a
hardware security module/KMS; transport is encrypted. See the security prep doc for
the control set.

## 6. Retention
We keep data only as long as needed for the purpose or as the issuing institution's
retention schedule requires. Short-lived items (one-time codes, unmatched camera
events) are purged automatically.

## 7. Your rights (FIPPA)
Access and correction of your records (routed to the issuing institution where they
own the record), and deletion of your CivicPass account and app-derived data.

## 8. Health information (PHIPA)
If health-card data is included, it is handled under PHIPA with separate consent and
stricter access controls, or excluded from the initial release.

## 9. Children
Not directed at children under `[age]`.

## 10. Changes & complaints
We will notify material changes in-app. You may complain to us at `[contact]` and to
the Information and Privacy Commissioner of Ontario.
