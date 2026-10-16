function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

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

  /** Parking tickets (municipal APS; vendor gtechna). */
  parking: {
    /** 'demo' resolves notice numbers locally; 'gtechna' calls the municipal integration. */
    provider: env('PARKING_PROVIDER', isProduction ? 'gtechna' : 'demo') as 'demo' | 'gtechna',
    endpoint: process.env.PARKING_ENDPOINT,
    apiKey: process.env.PARKING_API_KEY,
  },
};
