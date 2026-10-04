import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import {
  SignJWT,
  jwtVerify,
  generateKeyPair,
  exportJWK,
  importPKCS8,
  importSPKI,
  createLocalJWKSet,
  type JWK,
  type JWTPayload,
  type CryptoKey,
} from 'jose';
import { config } from './config.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

export function referenceNumber(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Session tokens (HS256, server-only secret)
// ---------------------------------------------------------------------------

const sessionSecret = new TextEncoder().encode(config.sessionSecret);

export async function issueAccessToken(accountId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(accountId)
    .setIssuer(config.issuer)
    .setAudience('civicpass-app')
    .setIssuedAt()
    .setExpirationTime(config.accessTokenTtl)
    .sign(sessionSecret);
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, sessionSecret, {
    issuer: config.issuer,
    audience: 'civicpass-app',
  });
  if (!payload.sub) throw new Error('missing subject');
  return payload.sub;
}

// ---------------------------------------------------------------------------
// Credential signing key (ES256). The public half is published at
// /.well-known/jwks.json so any verifier (police, retailer, bank) can check a
// presentation offline. In production this key lives in an HSM / cloud KMS.
// ---------------------------------------------------------------------------

interface SigningKey {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: JWK;
}

let signingKey: Promise<SigningKey> | undefined;

export function getSigningKey(): Promise<SigningKey> {
  signingKey ??= (async () => {
    let privateKey: CryptoKey;
    let publicKey: CryptoKey;
    if (config.signingKeyPem && config.signingPublicKeyPem) {
      privateKey = await importPKCS8(config.signingKeyPem, 'ES256', { extractable: false });
      publicKey = await importSPKI(config.signingPublicKeyPem, 'ES256', { extractable: true });
    } else {
      ({ privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true }));
    }
    const publicJwk = await exportJWK(publicKey);
    const kid = sha256Hex(JSON.stringify(publicJwk)).slice(0, 16);
    return { kid, privateKey, publicJwk: { ...publicJwk, kid, alg: 'ES256', use: 'sig' } };
  })();
  return signingKey;
}

export async function jwks(): Promise<{ keys: JWK[] }> {
  const key = await getSigningKey();
  return { keys: [key.publicJwk] };
}

export async function signPresentation(claims: JWTPayload, ttlSeconds: number): Promise<string> {
  const key = await getSigningKey();
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ: 'civicpass-vp+jwt' })
    .setIssuer(config.issuer)
    .setIssuedAt()
    .setJti(newId('vp'))
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key.privateKey);
}

export async function verifyPresentation(token: string): Promise<JWTPayload> {
  const set = createLocalJWKSet(await jwks());
  const { payload } = await jwtVerify(token, set, {
    issuer: config.issuer,
    typ: 'civicpass-vp+jwt',
  });
  return payload;
}

export async function signDocumentHash(accountId: string, documentSha256: string): Promise<string> {
  const key = await getSigningKey();
  return new SignJWT({ doc: documentSha256 })
    .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ: 'civicpass-sig+jwt' })
    .setIssuer(config.issuer)
    .setSubject(accountId)
    .setIssuedAt()
    .sign(key.privateKey);
}
