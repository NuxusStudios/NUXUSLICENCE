import { config } from './config.js';

/**
 * Identity-proofing boundary (IAL2). The mobile app runs a document scan +
 * liveness selfie through a vendor SDK (Onfido, Stripe Identity, Jumio, iProov,
 * or the province's own gateway) and gets back a session id. At registration
 * the server asks the vendor whether that session passed, and gets back the
 * fields the vendor extracted from the scanned document. Those fields are then
 * matched against the authoritative licensing record before an account is
 * bound to a person — the vendor proves "this live human holds this document",
 * the registry match proves "that document is this licence record".
 *
 * Swap the provider by implementing this interface; nothing in the route
 * handlers changes.
 */
export interface IdentityVerification {
  /** Did the document scan + liveness check pass? */
  verified: boolean;
  /** Assurance level the vendor attests to. */
  assurance: 'IAL1' | 'IAL2';
  /** Fields read off the scanned document (when the vendor returns them). */
  claims?: {
    givenNames?: string;
    surname?: string;
    dateOfBirth?: string; // YYYY-MM-DD
    documentNumber?: string;
  };
  /** Machine-readable reason when `verified` is false (never shown verbatim to the user). */
  reason?: string;
}

export interface IdentityProvider {
  /** Resolve the SDK session id to a verification result. */
  verify(sessionId: string): Promise<IdentityVerification>;
}

/**
 * Demo provider: approves any `idv_…` session except ones that encode a failure
 * (`idv_decline…`, `idv_fail…`), so the flow — and its unhappy path — can be
 * exercised without a vendor. It returns no extracted claims, so the registry
 * match (licence number + date of birth) remains the binding step, exactly as
 * before this provider existed.
 */
export const demoIdentityProvider: IdentityProvider = {
  async verify(sessionId) {
    const failed = /^idv_(decline|fail)/i.test(sessionId);
    return failed
      ? { verified: false, assurance: 'IAL1', reason: 'liveness_or_document_check_failed' }
      : { verified: true, assurance: 'IAL2' };
  },
};

/**
 * Vendor provider stub (production). Calls the identity vendor's REST API to
 * read a completed verification session. Wired only when IDENTITY_PROVIDER=vendor
 * and the endpoint + key are set; the exact request/response shape is the
 * vendor's and is filled in against their API docs once an account exists.
 */
export const vendorIdentityProvider: IdentityProvider = {
  async verify(sessionId) {
    const { endpoint, apiKey } = config.identity;
    if (!endpoint || !apiKey) throw new Error('IDENTITY_ENDPOINT and IDENTITY_API_KEY must be set for the vendor identity provider.');
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`identity vendor returned ${res.status}`);
    const data = (await res.json()) as {
      status?: string;
      // Shape below is illustrative; map to the chosen vendor's payload.
      verified_outputs?: { first_name?: string; last_name?: string; dob?: string; id_number?: string };
    };
    const verified = data.status === 'verified';
    return {
      verified,
      assurance: verified ? 'IAL2' : 'IAL1',
      ...(verified && data.verified_outputs
        ? {
            claims: {
              givenNames: data.verified_outputs.first_name,
              surname: data.verified_outputs.last_name,
              dateOfBirth: data.verified_outputs.dob,
              documentNumber: data.verified_outputs.id_number,
            },
          }
        : {}),
      ...(verified ? {} : { reason: data.status ?? 'not_verified' }),
    };
  },
};

let provider: IdentityProvider = demoIdentityProvider;
export function setIdentityProvider(p: IdentityProvider) {
  provider = p;
}

export function verifyIdentitySession(sessionId: string): Promise<IdentityVerification> {
  return provider.verify(sessionId);
}
