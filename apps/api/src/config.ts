function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

/** An authorized automated-enforcement partner (processing centre / municipal vendor). */
export interface CameraPartner {
  /** Stable partner id, sent in the `x-civicpass-partner` header. */
  id: string;
  /** Shared HMAC-SHA256 secret used to sign pushed events. Never logged. */
  secret: string;
  /** Municipalities this partner is authorized to submit tickets for ('*' = any). */
  municipalities: string[];
}

function parseCameraPartners(raw?: string): CameraPartner[] {
  if (!raw) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error('CAMERA_PARTNERS must be valid JSON (an array of { id, secret, municipalities }).');
  }
  if (!Array.isArray(arr)) throw new Error('CAMERA_PARTNERS must be a JSON array.');
  return arr.map((p) => {
    const partner = p as Partial<CameraPartner>;
    if (!partner.id || !partner.secret) throw new Error('Each CAMERA_PARTNERS entry needs an id and a secret.');
    return {
      id: String(partner.id),
      secret: String(partner.secret),
      municipalities: (partner.municipalities ?? ['*']).map(String),
    };
  });
}

function secret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) throw new Error(`${name} must be set in production`);
  return devFallback;
}

export const config = {
  port: Number(env('PORT', '4000')),
  host: env('HOST', '0.0.0.0'),
  issuer: env('ISSUER', 'https://api.civicpass.example'),
  sessionSecret: secret('SESSION_SECRET', 'dev-only-session-secret-change-me-0123456789'),
  accessTokenTtl: env('ACCESS_TOKEN_TTL', '30m'),
  /** Shared key presented by upstream enforcement systems (camera processing centre). */
  integrationApiKey: secret('INTEGRATION_API_KEY', 'dev-camera-integration-key'),
  /** PEM-encoded ES256 keys; when absent an ephemeral key pair is generated (dev only). */
  signingKeyPem: process.env.SIGNING_PRIVATE_KEY_PEM,
  signingPublicKeyPem: process.env.SIGNING_PUBLIC_KEY_PEM,
  presentationTtlSeconds: Number(env('PRESENTATION_TTL_SECONDS', '90')),
  /** Days a ticket holder has to respond before the notice goes overdue. */
  fineResponseDays: Number(env('FINE_RESPONSE_DAYS', '15')),
  seedDemoData: env('SEED_DEMO_DATA', isProduction ? 'false' : 'true') === 'true',
  homeJurisdiction: env('HOME_JURISDICTION', 'ON'),
  /** One-time codes are returned in API responses outside production (no SMS gateway in dev). */
  exposeDevCodes: !isProduction,

  /** Automatic licence-status checking (MTO driver record). */
  licenceStatus: {
    /**
     * Which adapter answers status checks. 'demo' returns deterministic
     * statuses from seed data; 'mto_batch' calls the real MTO account-based
     * feed (needs the endpoint + key below and a data-sharing agreement).
     */
    provider: env('LICENCE_STATUS_PROVIDER', isProduction ? 'mto_batch' : 'demo') as 'demo' | 'mto_batch',
    /** MTO batch/API feed base URL and account key (production). */
    mtoEndpoint: process.env.MTO_DLC_ENDPOINT,
    mtoApiKey: process.env.MTO_DLC_API_KEY,
    /**
     * Refresh happens on app open, but a status re-checked within this many
     * seconds is reused, so one screen-open doesn't fan out into many calls to
     * a metered feed. 0 = always re-check (fine for the demo provider).
     */
    minRecheckSeconds: Number(env('LICENCE_RECHECK_MIN_SECONDS', isProduction ? '300' : '0')),
    /** Scheduled full sweep: how far ahead the next automatic check is set. */
    recheckSeconds: Number(env('LICENCE_RECHECK_SECONDS', '86400')),
    /** Max licence numbers per MTO batch order (the live service caps at 100). */
    batchSize: Number(env('LICENCE_BATCH_SIZE', '100')),
  },

  /** POA court case status (justice services POA Online Services integration). */
  poa: {
    provider: env('POA_PROVIDER', isProduction ? 'poa_online' : 'demo') as 'demo' | 'poa_online',
    endpoint: process.env.POA_ENDPOINT,
    apiKey: process.env.POA_API_KEY,
    /** Reuse-a-recent-check floor so one app open doesn't fan out to the court feed. */
    minRecheckSeconds: Number(env('POA_RECHECK_MIN_SECONDS', isProduction ? '300' : '0')),
    recheckSeconds: Number(env('POA_RECHECK_SECONDS', '86400')),
  },

  /** Parking tickets (municipal APS; vendor gtechna). */
  parking: {
    /** 'demo' resolves notice numbers locally; 'gtechna' calls the municipal integration. */
    provider: env('PARKING_PROVIDER', isProduction ? 'gtechna' : 'demo') as 'demo' | 'gtechna',
    endpoint: process.env.PARKING_ENDPOINT,
    apiKey: process.env.PARKING_API_KEY,
  },

  /**
   * Automated-enforcement camera ingestion (red-light cameras; speed cameras
   * where lawful). The pipeline is production-ready; going live only needs the
   * data-sharing agreement, then CAMERA_INTEGRATION_MODE=live plus the signed
   * partner registry below. In 'demo' mode the coarse x-api-key alone is
   * accepted (dev/tests); in 'live' mode every push must carry a valid
   * per-partner HMAC signature and a fresh timestamp.
   */
  camera: {
    mode: env('CAMERA_INTEGRATION_MODE', isProduction ? 'live' : 'demo') as 'demo' | 'live',
    /** Authorized enforcement partners, from CAMERA_PARTNERS (JSON). Empty until an agreement lands. */
    partners: parseCameraPartners(process.env.CAMERA_PARTNERS),
    /** Max seconds a signed request's timestamp may deviate from server time (replay window). */
    maxClockSkewSeconds: Number(env('CAMERA_MAX_CLOCK_SKEW_SECONDS', '300')),
    /** How long unmatched/queued events are retained before they are purged (data minimization). */
    unmatchedRetentionDays: Number(env('CAMERA_UNMATCHED_RETENTION_DAYS', '90')),
  },

  /** Identity proofing (IAL2 document scan + liveness) used at registration. */
  identity: {
    /** 'demo' approves any idv_ session (except idv_decline/idv_fail); 'vendor' calls the IDV vendor's API. */
    provider: env('IDENTITY_PROVIDER', isProduction ? 'vendor' : 'demo') as 'demo' | 'vendor',
    endpoint: process.env.IDENTITY_ENDPOINT,
    apiKey: process.env.IDENTITY_API_KEY,
  },

  /** Payment processing. 'demo' approves every token except tok_decline. */
  payments: {
    provider: env('PAYMENTS_PROVIDER', isProduction ? 'stripe' : 'demo') as 'demo' | 'stripe',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  },

  /** Durable persistence. When DATA_DIR is set the store snapshots to disk and restores on boot. */
  dataDir: process.env.DATA_DIR,
};
