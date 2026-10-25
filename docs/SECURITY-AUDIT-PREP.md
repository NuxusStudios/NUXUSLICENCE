# Security audit & penetration-test prep — draft

> Checklist to get CivicPass ready for an independent security review before any
> real-data pilot. Pairs with `SECURITY-ARCHITECTURE` (in the patent folder) and
> the PIA. Not a certification; a readiness guide.

## Scope to hand the auditor

- Mobile app (Expo / React Native), the Fastify API, the credential signing/JWKS,
  and the integration adapters (licence status, POA, parking, camera, identity, payments).
- Threat model: device theft, token/presentation replay, account takeover, record
  enumeration, webhook spoofing (camera partners), provider compromise, insider access.

## Controls already in place (verify under test)

- [x] Passwords & PINs scrypt-hashed with per-value salt; constant-time compare.
- [x] Session tokens: short-lived HS256 (30m), issuer/audience bound.
- [x] Presentations: ES256, `jti`, ~90s TTL, revocation list, wallet-revoke timestamp.
- [x] Camera ingest (live mode): per-partner HMAC-SHA256 signature + timestamp/replay window + municipality authorization.
- [x] Opaque auth errors (no account/record enumeration).
- [x] Identity proofing required at registration (IAL2) before binding a person.
- [x] Retention purge for unmatched camera events; short-lived OTPs/resets.
- [x] Reduce-Transparency / accessibility fallbacks don't weaken auth.

## Gaps to close before the test

- [ ] Signing key in HSM/KMS (currently in-process outside prod config).
- [ ] Rate limiting + lockout on `/v1/auth/login`, `/v1/auth/otp`, PIN attempts.
- [ ] WAF + bot protection in front of auth and camera ingest.
- [ ] Secrets from a managed store, not env; rotation runbook.
- [ ] CSP / security headers on any web surface; certificate pinning in the app.
- [ ] Dependency scanning (npm audit shows advisories to triage) + SBOM.
- [ ] Centralized audit logging with tamper-evidence; verify no PII/secrets in logs.
- [ ] DPAs with IDV and payment vendors; PCI scope confirmed (tokenization keeps PANs out of the server).

## Test plan (what to ask the pen-test firm to attempt)

1. **Auth**: credential stuffing, brute force, OTP guessing, reset-flow abuse, JWT tampering/`alg` confusion, session fixation.
2. **Presentations**: replay a captured presentation after TTL, after revoke, after wallet wipe; forge with a stolen `kid`.
3. **Camera webhook**: submit without/with a bad HMAC, replay a signed body, submit for an unauthorized municipality, clock-skew abuse.
4. **Authz**: access another account's fines/documents/consents by id enumeration.
5. **Input**: injection/oversized payloads against every zod-validated route; idempotency bypass on ticket ingestion.
6. **Mobile**: data-at-rest on a rooted/jailbroken device, biometric bypass, deep-link/session reset abuse, screenshot/overlay leakage of documents.
7. **Infra**: TLS config, headers, rate limits, error verbosity.

## Evidence to prepare

- Architecture + data-flow diagrams, this checklist, the PIA, dependency inventory,
  threat model, and a test account on a staging environment with synthetic data only.
