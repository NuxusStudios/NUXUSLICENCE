import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { z, ZodError } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import {
  hashPassword,
  issueAccessToken,
  jwks,
  newId,
  referenceNumber,
  sha256Hex,
  signDocumentHash,
  signPresentation,
  verifyAccessToken,
  verifyPassword,
  verifyPresentation,
} from './crypto.js';
import { effectiveStatus, ingestCameraEvent } from './fines.js';
import { notify } from './notifications.js';
import { charge } from './payments.js';
import { SERVICES } from './catalog.js';
import { Store } from './store.js';
import type { Account, Credential, Fine, RegistryPerson, Vehicle } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    account?: Account;
  }
}

class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

const paymentInput = z.object({
  method: z.enum(['card', 'apple_pay', 'google_pay', 'interac']),
  paymentToken: z.string().min(1),
});

const cameraEventSchema = z.object({
  eventId: z.string().min(1),
  type: z.enum(['red_light', 'speed']),
  plate: z.string().min(2).max(10),
  jurisdiction: z.string().length(2),
  capturedAt: z.iso.datetime(),
  location: z.string().min(1),
  municipality: z.string().min(1),
  images: z.array(z.string()).min(1),
  recordedSpeedKmh: z.number().positive().optional(),
  postedLimitKmh: z.number().positive().optional(),
  secondsIntoRed: z.number().nonnegative().optional(),
  setFine: z.number().positive(),
});

/** Who may see which fields when a credential is presented. */
const DISCLOSURES = ['full', 'age_over_19', 'age_over_18', 'name_photo', 'licence_status'] as const;
type Disclosure = (typeof DISCLOSURES)[number];

export interface AppOptions {
  store?: Store;
  logger?: boolean;
}

export async function buildApp(opts: AppOptions = {}) {
  const store = opts.store ?? new Store();
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'] });
  app.decorate('store', store);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    if (err instanceof ZodError) return reply.status(400).send({ error: 'validation_error', issues: err.issues });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.status(status).send({ error: 'error', message: status >= 500 ? 'Internal error' : (err as Error).message });
  });

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------
  async function requireAccount(req: FastifyRequest) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'unauthenticated', 'Missing bearer token');
    let accountId: string;
    try {
      accountId = await verifyAccessToken(header.slice(7));
    } catch {
      throw new HttpError(401, 'unauthenticated', 'Invalid or expired token');
    }
    const account = store.accounts.get(accountId);
    if (!account) throw new HttpError(401, 'unauthenticated', 'Account no longer exists');
    req.account = account;
  }

  function requireIntegrationKey(req: FastifyRequest) {
    const key = String(req.headers['x-api-key'] ?? '');
    const expected = Buffer.from(config.integrationApiKey);
    const actual = Buffer.from(key);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new HttpError(401, 'unauthenticated', 'Invalid integration key');
    }
  }

  const me = (req: FastifyRequest) => req.account!;
  const personOf = (account: Account) => store.people.get(account.personId)!;

  function ownedFine(req: FastifyRequest, id: string): Fine {
    const fine = store.fines.get(id);
    if (!fine || fine.personId !== me(req).personId) throw new HttpError(404, 'not_found', 'Fine not found');
    return fine;
  }

  function ownedVehicle(req: FastifyRequest, id: string): Vehicle {
    const v = store.vehicles.get(id);
    if (!v || v.ownerPersonId !== me(req).personId) throw new HttpError(404, 'not_found', 'Vehicle not found');
    return v;
  }

  function serializeFine(f: Fine) {
    return { ...f, status: effectiveStatus(f) };
  }

  function credentialView(c: Credential) {
    const person = store.people.get(c.personId)!;
    const vehicle = c.vehicleId ? store.vehicles.get(c.vehicleId) : undefined;
    const expired = new Date(c.expiresOn) < new Date();
    return {
      ...c,
      status: c.status === 'valid' && expired ? 'expired' : c.status,
      holder: {
        givenNames: person.givenNames,
        surname: person.surname,
        dateOfBirth: person.dateOfBirth,
        sex: person.sex,
        heightCm: person.heightCm,
        address: person.address,
      },
      vehicle,
    };
  }

  function ageOn(dob: string, at = new Date()): number {
    const d = new Date(dob);
    let age = at.getUTCFullYear() - d.getUTCFullYear();
    const m = at.getUTCMonth() - d.getUTCMonth();
    if (m < 0 || (m === 0 && at.getUTCDate() < d.getUTCDate())) age--;
    return age;
  }

  function disclosedClaims(c: Credential, person: RegistryPerson, disclosure: Disclosure): Record<string, unknown> {
    const name = { givenNames: person.givenNames, surname: person.surname };
    switch (disclosure) {
      case 'age_over_19':
        return { ageOver19: ageOn(person.dateOfBirth) >= 19, photo: true };
      case 'age_over_18':
        return { ageOver18: ageOn(person.dateOfBirth) >= 18, photo: true };
      case 'name_photo':
        return { ...name, photo: true };
      case 'licence_status':
        return { ...name, licenceClass: c.licenceClass, conditions: c.conditions ?? [], status: c.status, expiresOn: c.expiresOn };
      case 'full': {
        const vehicle = c.vehicleId ? store.vehicles.get(c.vehicleId) : undefined;
        return {
          ...name,
          dateOfBirth: person.dateOfBirth,
          sex: person.sex,
          heightCm: person.heightCm,
          address: person.address,
          documentNumber: c.documentNumber,
          licenceClass: c.licenceClass,
          conditions: c.conditions ?? [],
          issuedOn: c.issuedOn,
          expiresOn: c.expiresOn,
          ...(vehicle ? { vehicle: { plate: vehicle.plate, vin: vehicle.vin, make: vehicle.make, model: vehicle.model, year: vehicle.year } } : {}),
        };
      }
    }
  }

  function summary(account: Account) {
    const fines = store.finesFor(account.personId).map(serializeFine);
    const open = fines.filter((f) => f.status === 'outstanding' || f.status === 'overdue');
    const soon = Date.now() + 60 * 86400_000;
    const renewals = [
      ...store.vehiclesFor(account.personId)
        .filter((v) => new Date(v.plateValidationExpires).getTime() < soon)
        .map((v) => ({ kind: 'plate' as const, id: v.id, label: v.plate, expiresOn: v.plateValidationExpires })),
      ...store.credentialsFor(account.personId)
        .filter((c) => c.type !== 'vehicle_permit' && new Date(c.expiresOn).getTime() < soon)
        .map((c) => ({ kind: c.type, id: c.id, label: c.documentNumber, expiresOn: c.expiresOn })),
    ];
    return {
      openFines: open.length,
      openFinesTotal: Math.round(open.reduce((s, f) => s + f.total, 0) * 100) / 100,
      overdueFines: open.filter((f) => f.status === 'overdue').length,
      unreadMessages: store.inboxFor(account.id).filter((m) => !m.read).length,
      renewalsDue: renewals,
    };
  }

  // -------------------------------------------------------------------------
  // public
  // -------------------------------------------------------------------------
  app.get('/health', async () => ({ ok: true }));
  app.get('/.well-known/jwks.json', async () => jwks());

  app.post('/v1/auth/register', async (req, reply) => {
    const body = z
      .object({
        email: z.email(),
        password: z.string().min(8),
        phone: z.string().optional(),
        licenceNumber: z.string().min(5),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        /** Session id from the identity-verification SDK (document scan + liveness selfie). */
        idvSessionId: z.string().startsWith('idv_'),
        language: z.enum(['en', 'fr']).default('en'),
      })
      .parse(req.body);

    const person = store.findPersonByLicence(body.licenceNumber);
    // Same error for "no such licence" and "DOB mismatch" to avoid record enumeration.
    if (!person || person.dateOfBirth !== body.dateOfBirth) {
      throw new HttpError(422, 'identity_not_matched', 'We could not match these details to a licensing record.');
    }
    if (store.findAccountByPerson(person.id)) throw new HttpError(409, 'already_registered', 'An account already exists for this person.');
    if (store.findAccountByEmail(body.email)) throw new HttpError(409, 'email_taken', 'This email is already in use.');

    const account: Account = {
      id: newId('acc'),
      personId: person.id,
      email: body.email.trim().toLowerCase(),
      phone: body.phone,
      passwordHash: await hashPassword(body.password),
      language: body.language,
      createdAt: new Date().toISOString(),
      identityAssurance: 'IAL2',
      pushTokens: [],
    };
    store.accounts.set(account.id, account);

    // Tickets issued before sign-up are already on the person's record.
    const pending = store.finesFor(person.id).filter((f) => f.status === 'outstanding');
    notify(store, account, {
      category: 'general',
      title: 'Welcome to your digital wallet',
      body: pending.length
        ? `Your documents are ready. You have ${pending.length} outstanding ticket(s) linked to your record.`
        : 'Your documents are ready to use.',
    });
    return reply.status(201).send({ accessToken: await issueAccessToken(account.id) });
  });

  app.post('/v1/auth/login', async (req) => {
    const body = z.object({ email: z.string(), password: z.string() }).parse(req.body);
    const account = store.findAccountByEmail(body.email);
    if (!account || !(await verifyPassword(body.password, account.passwordHash))) {
      throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
    }
    return { accessToken: await issueAccessToken(account.id) };
  });

  app.get('/v1/services', async () => SERVICES);

  /**
   * Verifier endpoint (police, retailer, bank, landlord). Checks the issuer
   * signature, expiry, revocation and live credential status, and records the
   * check in the holder's transparency log.
   */
  app.post('/v1/verify', async (req) => {
    const body = z.object({ token: z.string(), verifier: z.string().max(80).default('Unidentified verifier') }).parse(req.body);
    let payload;
    try {
      payload = await verifyPresentation(body.token);
    } catch (e) {
      const expired = (e as { code?: string }).code === 'ERR_JWT_EXPIRED';
      return { valid: false, reason: expired ? 'expired' : 'bad_signature' };
    }
    const cid = String(payload.cid ?? '');
    const credential = store.credentials.get(cid);
    if (!credential) return { valid: false, reason: 'unknown_credential' };
    if (payload.jti && store.revokedPresentationIds.has(payload.jti)) return { valid: false, reason: 'revoked' };
    const account = store.findAccountByPerson(credential.personId);
    const wipedAt = account ? store.walletRevokedAt.get(account.id) : undefined;
    if (wipedAt && (payload.iat ?? 0) * 1000 <= wipedAt) return { valid: false, reason: 'revoked' };
    const view = credentialView(credential);
    if (view.status !== 'valid') return { valid: false, reason: `credential_${view.status}` };

    if (account) {
      const id = newId('log');
      store.accessLog.set(id, {
        id,
        accountId: account.id,
        credentialId: cid,
        verifier: body.verifier,
        claims: Object.keys((payload.claims as object) ?? {}),
        verifiedAt: new Date().toISOString(),
      });
    }
    return {
      valid: true,
      credentialType: credential.type,
      disclosure: payload.disclosure,
      claims: payload.claims,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  });

  // -------------------------------------------------------------------------
  // machine-to-machine: enforcement integrations
  // -------------------------------------------------------------------------
  app.post('/v1/integrations/camera-events', async (req, reply) => {
    requireIntegrationKey(req);
    const body = z.union([cameraEventSchema, z.object({ events: z.array(cameraEventSchema).min(1).max(500) })]).parse(req.body);
    const events = 'events' in body ? body.events : [body];
    const results = events.map((e) => ({ eventId: e.eventId, ...ingestCameraEvent(store, e) }));
    return reply.status(202).send({ results });
  });

  app.get('/v1/integrations/camera-events/unmatched', async (req) => {
    requireIntegrationKey(req);
    return store.unmatchedCameraEvents;
  });

  // -------------------------------------------------------------------------
  // authenticated citizen API
  // -------------------------------------------------------------------------
  await app.register(async (secure) => {
    secure.addHook('preHandler', requireAccount);

    secure.get('/v1/me', async (req) => {
      const account = me(req);
      const person = personOf(account);
      return {
        account: { id: account.id, email: account.email, phone: account.phone, language: account.language, identityAssurance: account.identityAssurance, createdAt: account.createdAt },
        person,
        summary: summary(account),
      };
    });

    secure.patch('/v1/me', async (req) => {
      const body = z.object({ language: z.enum(['en', 'fr']).optional(), phone: z.string().optional() }).parse(req.body);
      Object.assign(me(req), body);
      return { ok: true };
    });

    secure.post('/v1/me/push-tokens', async (req) => {
      const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
      const account = me(req);
      if (!account.pushTokens.includes(token)) account.pushTokens.push(token);
      return { ok: true };
    });

    secure.get('/v1/me/access-log', async (req) => store.accessLogFor(me(req).id));

    /** Lost or stolen phone: invalidate every presentation issued so far. */
    secure.post('/v1/me/revoke-wallet', async (req) => {
      const account = me(req);
      store.walletRevokedAt.set(account.id, Date.now());
      notify(store, account, { category: 'security', title: 'Wallet revoked', body: 'All QR codes issued before now are no longer valid.' });
      return { ok: true };
    });

    // --- wallet ------------------------------------------------------------
    secure.get('/v1/wallet', async (req) => store.credentialsFor(me(req).personId).map(credentialView));

    secure.get<{ Params: { id: string } }>('/v1/wallet/:id', async (req) => {
      const c = store.credentials.get(req.params.id);
      if (!c || c.personId !== me(req).personId) throw new HttpError(404, 'not_found', 'Credential not found');
      return credentialView(c);
    });

    secure.post<{ Params: { id: string } }>('/v1/wallet/:id/presentations', async (req) => {
      const { disclosure } = z.object({ disclosure: z.enum(DISCLOSURES).default('full') }).parse(req.body ?? {});
      const c = store.credentials.get(req.params.id);
      if (!c || c.personId !== me(req).personId) throw new HttpError(404, 'not_found', 'Credential not found');
      const view = credentialView(c);
      if (view.status !== 'valid') throw new HttpError(409, 'credential_not_valid', `Credential is ${view.status}`);
      if (disclosure.startsWith('age_') && c.type === 'vehicle_permit') {
        throw new HttpError(400, 'unsupported_disclosure', 'Vehicle permits cannot prove age');
      }
      const ttl = config.presentationTtlSeconds;
      const token = await signPresentation(
        { cid: c.id, ctype: c.type, disclosure, claims: disclosedClaims(c, personOf(me(req)), disclosure) },
        ttl,
      );
      return { token, expiresInSeconds: ttl };
    });

    // --- vehicles ----------------------------------------------------------
    secure.get('/v1/vehicles', async (req) => store.vehiclesFor(me(req).personId));

    secure.get<{ Params: { id: string } }>('/v1/vehicles/:id', async (req) => {
      const v = ownedVehicle(req, req.params.id);
      const fines = store.finesFor(me(req).personId).filter((f) => f.vehicleId === v.id).map(serializeFine);
      return { ...v, fines };
    });

    secure.post<{ Params: { id: string } }>('/v1/vehicles/:id/renew', async (req) => {
      const v = ownedVehicle(req, req.params.id);
      const body = z.object({ years: z.union([z.literal(1), z.literal(2)]).default(1) }).and(paymentInput.partial()).parse(req.body ?? {});
      const blocking = store.finesFor(me(req).personId).map(serializeFine).filter((f) => f.status === 'overdue');
      if (blocking.length) {
        throw new HttpError(409, 'unpaid_fines', `Pay ${blocking.length} overdue fine(s) before renewing.`);
      }
      if (new Date(v.insurance.expiresOn) < new Date()) throw new HttpError(409, 'no_insurance', 'Valid insurance is required to renew.');

      const fee = Number(process.env.PLATE_RENEWAL_FEE ?? '0') * body.years;
      let paymentId: string | undefined;
      if (fee > 0) {
        if (!body.method || !body.paymentToken) throw new HttpError(400, 'payment_required', 'Payment details required');
        const payment = await charge(store, { accountId: me(req).id, purpose: 'plate_renewal', referenceId: v.id, amount: fee, method: body.method, paymentToken: body.paymentToken });
        if (payment.status !== 'succeeded') throw new HttpError(402, 'payment_declined', 'Payment was declined');
        paymentId = payment.id;
      }
      const base = new Date(Math.max(Date.now(), new Date(v.plateValidationExpires).getTime()));
      base.setUTCFullYear(base.getUTCFullYear() + body.years);
      v.plateValidationExpires = base.toISOString().slice(0, 10);
      for (const c of store.credentialsFor(me(req).personId)) if (c.vehicleId === v.id) c.expiresOn = v.plateValidationExpires;
      notify(store, me(req), { category: 'renewal', title: 'Plate renewed', body: `${v.plate} is now valid until ${v.plateValidationExpires}.`, link: `/vehicle/${v.id}` });
      return { vehicle: v, paymentId, fee };
    });

    // --- fines -------------------------------------------------------------
    secure.get('/v1/fines', async (req) => store.finesFor(me(req).personId).map(serializeFine));

    secure.get<{ Params: { id: string } }>('/v1/fines/:id', async (req) => {
      const f = ownedFine(req, req.params.id);
      return { ...serializeFine(f), vehicle: f.vehicleId ? store.vehicles.get(f.vehicleId) : undefined, payment: f.paymentId ? store.payments.get(f.paymentId) : undefined };
    });

    secure.post<{ Params: { id: string } }>('/v1/fines/:id/pay', async (req, reply: FastifyReply) => {
      const f = ownedFine(req, req.params.id);
      const body = paymentInput.parse(req.body);
      const status = effectiveStatus(f);
      if (status !== 'outstanding' && status !== 'overdue') throw new HttpError(409, 'not_payable', `Fine is ${status}`);
      const payment = await charge(store, { accountId: me(req).id, purpose: 'fine', referenceId: f.id, amount: f.total, method: body.method, paymentToken: body.paymentToken });
      if (payment.status !== 'succeeded') return reply.status(402).send({ error: 'payment_declined', payment });
      f.status = 'paid';
      f.paymentId = payment.id;
      notify(store, me(req), { category: 'fine', title: 'Payment received', body: `Receipt ${payment.receiptNumber}: $${payment.amount.toFixed(2)} for ticket ${f.externalId}.`, link: `/fine/${f.id}` });
      return { fine: serializeFine(f), payment };
    });

    secure.post<{ Params: { id: string } }>('/v1/fines/:id/dispute', async (req) => {
      const f = ownedFine(req, req.params.id);
      const body = z.object({ option: z.enum(['early_resolution', 'trial']), reason: z.string().min(10).max(2000) }).parse(req.body);
      const status = effectiveStatus(f);
      if (status !== 'outstanding') throw new HttpError(409, 'not_disputable', status === 'overdue' ? 'The response period has ended' : `Fine is ${status}`);
      f.status = 'disputed';
      f.dispute = { ...body, submittedAt: new Date().toISOString(), reference: referenceNumber('DSP') };
      notify(store, me(req), {
        category: 'fine',
        title: body.option === 'trial' ? 'Trial requested' : 'Early resolution meeting requested',
        body: `Reference ${f.dispute.reference}. The court office will notify you here with your date.`,
        link: `/fine/${f.id}`,
      });
      return serializeFine(f);
    });

    // --- services ----------------------------------------------------------
    secure.post<{ Params: { id: string } }>('/v1/services/:id/requests', async (req, reply) => {
      const service = SERVICES.find((s) => s.id === req.params.id);
      if (!service) throw new HttpError(404, 'not_found', 'Service not found');
      const body = z.object({ data: z.record(z.string(), z.string()) }).and(paymentInput.partial()).parse(req.body);
      const missing = service.fields.filter((f) => f.required && !body.data[f.key]?.trim()).map((f) => f.key);
      if (missing.length) throw new HttpError(400, 'missing_fields', `Missing: ${missing.join(', ')}`);

      let paymentId: string | undefined;
      if (service.fee > 0) {
        if (!body.method || !body.paymentToken) throw new HttpError(400, 'payment_required', 'Payment details required');
        const payment = await charge(store, { accountId: me(req).id, purpose: 'service_fee', referenceId: service.id, amount: service.fee, method: body.method, paymentToken: body.paymentToken });
        if (payment.status !== 'succeeded') throw new HttpError(402, 'payment_declined', 'Payment was declined');
        paymentId = payment.id;
      }

      // Address change propagates to every linked document in one step.
      if (service.id === 'change-address') {
        const person = personOf(me(req));
        person.address = { ...person.address, line1: body.data.line1!, line2: undefined, city: body.data.city!, postalCode: body.data.postalCode!.toUpperCase() };
      }

      const request = {
        id: newId('req'),
        accountId: me(req).id,
        serviceId: service.id,
        data: body.data,
        status: service.id === 'change-address' ? ('completed' as const) : ('submitted' as const),
        reference: referenceNumber('SR'),
        createdAt: new Date().toISOString(),
        paymentId,
      };
      store.serviceRequests.set(request.id, request);
      notify(store, me(req), { category: 'service', title: `${service.name.en}: ${request.status}`, body: `Reference ${request.reference}.` });
      return reply.status(201).send(request);
    });

    secure.get('/v1/service-requests', async (req) =>
      [...store.serviceRequests.values()].filter((r) => r.accountId === me(req).id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );

    // --- inbox -------------------------------------------------------------
    secure.get('/v1/inbox', async (req) => store.inboxFor(me(req).id));
    secure.post<{ Params: { id: string } }>('/v1/inbox/:id/read', async (req) => {
      const m = store.inbox.get(req.params.id);
      if (!m || m.accountId !== me(req).id) throw new HttpError(404, 'not_found', 'Message not found');
      m.read = true;
      return m;
    });

    // --- payments ----------------------------------------------------------
    secure.get('/v1/payments', async (req) => store.paymentsFor(me(req).id));

    // --- digital signature -------------------------------------------------
    secure.post('/v1/signatures', async (req, reply) => {
      const body = z.object({ documentTitle: z.string().min(1), documentContent: z.string().min(1), consent: z.literal(true) }).parse(req.body);
      const account = me(req);
      const documentSha256 = sha256Hex(body.documentContent);
      const record = {
        id: newId('sig'),
        accountId: account.id,
        documentTitle: body.documentTitle,
        documentSha256,
        signedAt: new Date().toISOString(),
        signature: await signDocumentHash(account.id, documentSha256),
      };
      store.signatures.set(record.id, record);
      return reply.status(201).send(record);
    });
    secure.get('/v1/signatures', async (req) => [...store.signatures.values()].filter((s) => s.accountId === me(req).id));
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    store: Store;
  }
}
