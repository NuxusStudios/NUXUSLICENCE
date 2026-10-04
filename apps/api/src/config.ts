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
};
