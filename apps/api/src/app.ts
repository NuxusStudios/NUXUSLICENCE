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
import { getLicenceStatusProvider, DemoLicenceStatusProvider } from './licence-status.js';
import { buildLicenceStatus, isAdverseChange, licenceStatusMessage, shouldRefresh, type LicenceStatus, type MtoLicenceStatus } from './shared/licence-status.js';
import { notify } from './notifications.js';
import { charge } from './payments.js';
import { ORGANIZATIONS, SERVICES, serviceById } from './catalog.js';
import {
  FAQ,
  LOCATIONS,
  PlatformError,
  SIGNED_RETENTION_DAYS,
  appointmentView,
  assertPassword,
  assertPin,
  availableSlots,
  bookAppointment,
  bookableDates,
  cancelAppointment,
  cancelRequest,
  checkIn,
  checkPlate,
  consentView,
  createRequest,
  dashboardActions,
  decideConsent,
  defaultPreferences,
  driverRecordResult,
  issueOtp,
  mergePreferences,
  payRequest,
  phoneHint,
  resubmitRequest,
  samePhone,
  sampleConsents,
  validateFeedback,
  validateServiceData,
  vehicleHistoryResult,
  verifyOtp,
  visitName,
  type Preferences,
  type ServiceRequest,
} from './shared/platform.js';
import { Store } from './store.js';
import type { Account, Credential, Fine, Payment, RegistryPerson, Vehicle } from './types.js';

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
  /** Pay with a saved card. */
  cardId: z.string().optional(),
  /** Save the card used. Only display details: the card number never reaches this API. */
  saveCard: z.object({ last4: z.string().regex(/^\d{4}$/), expiry: z.string().max(7), brand: z.enum(['visa', 'mastercard', 'amex', 'card']) }).optional(),
});
type PaymentBody = z.infer<typeof paymentInput>;

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
  await app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  app.decorate('store', store);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    if (err instanceof PlatformError) return reply.status(err.status).send({ error: err.code, message: err.message });
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

  function ownedRequest(req: FastifyRequest, id: string): ServiceRequest {
    const r = store.serviceRequests.get(id);
    if (!r || r.accountId !== me(req).id) throw new HttpError(404, 'not_found', 'Request not found');
    return r;
  }

  function ownedAppointment(req: FastifyRequest, id: string) {
    const a = store.appointments.get(id);
    if (!a || a.accountId !== me(req).id) throw new HttpError(404, 'not_found', 'Appointment not found');
    return a;
  }

  const preferencesOf = (accountId: string): Preferences => store.preferences.get(accountId) ?? defaultPreferences();

  /** Confirms the digital ID PIN for signing and data sharing. */
  async function requirePin(req: FastifyRequest, pin: string | undefined) {
    const account = me(req);
    if (!account.pinHash) throw new HttpError(409, 'pin_not_set', 'Set a digital ID PIN under Account first.');
    if (!pin || !(await verifyPassword(pin, account.pinHash))) throw new HttpError(422, 'wrong_pin', 'The digital ID PIN is incorrect.');
  }

  /**
   * Charges the user. Returns undefined after sending a 402 when `reply` is
   * given, otherwise throws on decline.
   */
  async function takePayment(
    req: FastifyRequest,
    what: { purpose: Payment['purpose']; referenceId: string; amount: number; label: string },
    body: PaymentBody,
    reply?: FastifyReply,
  ): Promise<Payment | undefined> {
    const account = me(req);
    let cardLast4 = body.saveCard?.last4;
    if (body.cardId) {
      const card = store.cards.get(body.cardId);
      if (!card || card.accountId !== account.id) throw new HttpError(404, 'not_found', 'Card not found');
      cardLast4 = card.last4;
    }
    const payment = await charge(store, { accountId: account.id, ...what, method: body.method, paymentToken: body.paymentToken, cardLast4 });
    if (payment.status !== 'succeeded') {
      if (reply) {
        reply.status(402).send({ error: 'payment_declined', message: 'Payment was declined', payment });
        return undefined;
      }
      throw new HttpError(402, 'payment_declined', 'Payment was declined');
    }
    if (body.saveCard && !store.cardsFor(account.id).some((c) => c.last4 === body.saveCard!.last4 && c.expiry === body.saveCard!.expiry)) {
      const id = newId('card');
      store.cards.set(id, { id, accountId: account.id, ...body.saveCard, addedAt: new Date().toISOString() });
    }
    return payment;
  }

  /** Side effects of a completed request on the registry and the result shown to the user. */
  function completeRequest(req: FastifyRequest, r: ServiceRequest) {
    const account = me(req);
    const person = personOf(account);
    if (r.serviceId === 'change-address') {
      person.address = { ...person.address, line1: r.data.line1!, line2: undefined, city: r.data.city!, postalCode: r.data.postalCode!.toUpperCase() };
    }
    if (r.serviceId === 'renew-licence') {
      const dl = store.credentialsFor(person.id).find((c) => c.type === 'driver_licence');
      if (dl) {
        const base = new Date(Math.max(Date.now(), new Date(dl.expiresOn).getTime()));
        base.setUTCFullYear(base.getUTCFullYear() + 5);
        dl.expiresOn = base.toISOString().slice(0, 10);
        dl.issuedOn = new Date().toISOString().slice(0, 10);
        r.result = { title: { en: 'Licence renewed', fr: 'Permis renouvelé' }, lines: [{ label: { en: 'New expiry date', fr: 'Nouvelle date d’expiration' }, value: dl.expiresOn }] };
      }
    }
    if (r.serviceId === 'driver-record') {
      const dl = store.credentialsFor(person.id).find((c) => c.type === 'driver_licence');
      const convictions = store
        .finesFor(person.id)
        .filter((f) => f.liability === 'driver' && f.status === 'paid')
        .map((f) => ({ date: f.occurredAt.slice(0, 10), offence: f.offence, points: f.demeritPoints }));
      r.result = driverRecordResult({ licenceNumber: person.licenceNumber, licenceClass: dl?.licenceClass, status: dl?.status ?? 'none', expiresOn: dl?.expiresOn ?? '—', convictions, period: r.data.years ?? '3 years' });
    }
    if (r.serviceId === 'vehicle-history') r.result = vehicleHistoryResult(r.data.vin ?? '');
  }

  function notifyRequest(account: Account, r: ServiceRequest) {
    const name = serviceById(r.serviceId)?.name.en ?? r.serviceId;
    const status = { in_review: 'in review', action_required: 'action required', awaiting_payment: 'awaiting payment', completed: 'completed', rejected: 'rejected', cancelled: 'cancelled' }[r.status];
    notify(store, account, { category: 'service', title: `${name}: ${status}`, body: `Request ${r.reference}.`, link: `/requests/${r.id}` });
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

  // --- automatic licence-status checking ----------------------------------
  // The holder proved the licence is theirs at sign-up; from then on the
  // backend keeps its status fresh from the MTO driver record on its own.

  /** English message for the inbox when a status turns adverse. */
  function adverseStatusNotice(status: LicenceStatus): { title: string; body: string } {
    if (status.display === 'suspended') {
      return { title: 'Your driver’s licence is no longer valid', body: 'A status check shows your licence is not currently valid to drive. Contact ServiceOntario. You can still open the app.' };
    }
    return { title: 'We couldn’t confirm your driver’s licence', body: 'The registry has no matching record for your licence right now. Please contact support.' };
  }

  /**
   * Refresh the status of the account's driver's licences from the provider.
   * Best-effort: a provider outage leaves the last-known status in place rather
   * than failing the screen that triggered the refresh. Returns the credentials
   * whose stored status changed.
   */
  async function refreshLicenceStatuses(account: Account, opts: { force?: boolean } = {}): Promise<Credential[]> {
    const cfg = config.licenceStatus;
    const licences = store.credentialsFor(account.personId).filter((c) => c.type === 'driver_licence');
    const now = new Date();
    const due = licences.filter((c) => opts.force || shouldRefresh(c.licenceStatus, now, cfg.minRecheckSeconds));
    if (!due.length) return [];
    let results;
    try {
      results = await getLicenceStatusProvider().check(due.map((c) => c.documentNumber));
    } catch {
      return []; // keep last-known status; next open retries
    }
    const changed: Credential[] = [];
    for (const c of due) {
      const result = results.get(c.documentNumber);
      if (!result) continue;
      const previous = c.licenceStatus;
      const next = buildLicenceStatus(result, { expiresOn: c.expiresOn, source: getLicenceStatusProvider().source === 'mto_batch' ? 'mto_batch' : 'demo', now, recheckSeconds: cfg.recheckSeconds });
      c.licenceStatus = next;
      // Keep the credential's own status in step so the wallet, QR and verifier agree.
      c.status = next.display === 'suspended' ? 'suspended' : next.display === 'not_found' ? 'revoked' : c.status === 'revoked' ? 'revoked' : 'valid';
      if (!previous || previous.code !== next.code || previous.display !== next.display) {
        changed.push(c);
        if (isAdverseChange(previous, next)) {
          const note = adverseStatusNotice(next);
          notify(store, account, { category: 'security', title: note.title, body: note.body, link: `/credential/${c.id}` });
        } else if (previous && (previous.display === 'suspended' || previous.display === 'not_found') && next.display === 'valid') {
          notify(store, account, { category: 'general', title: 'Your driver’s licence is valid again', body: 'A status check shows your licence is back in good standing.', link: `/credential/${c.id}` });
        }
      }
    }
    return changed;
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
      actions: dashboardActions({
        now: new Date(),
        credentials: store.credentialsFor(account.personId).filter((c) => c.type !== 'vehicle_permit'),
        vehicles: store.vehiclesFor(account.personId),
        overdueTickets: open.filter((f) => f.status === 'overdue').length,
        requests: store.requestsFor(account.id),
        consents: store.consentsFor(account.id),
        appointments: store.appointmentsFor(account.id),
      }),
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
        /** Digital ID PIN, used to confirm signing and data sharing. */
        pin: z.string().optional(),
        /** One-time code sent to `phone` by POST /v1/auth/otp. */
        otpId: z.string().optional(),
        otpCode: z.string().optional(),
      })
      .parse(req.body);
    assertPassword(body.password);
    if (body.pin) assertPin(body.pin);
    if (body.otpId) {
      const otp = store.otps.get(body.otpId);
      verifyOtp(otp, body.otpCode ?? '', new Date());
      if (!body.phone || !samePhone(body.phone, otp!.target)) throw new HttpError(422, 'otp_invalid', 'The code was sent to a different number.');
    }

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
      ...(body.pin ? { pinHash: await hashPassword(body.pin) } : {}),
    };
    store.accounts.set(account.id, account);
    for (const c of sampleConsents(account.id, new Date(), newId).filter((c) => c.status === 'pending')) store.consents.set(c.id, c);

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
    // Sign in with an email or a licence number (Sanad signs in with the national ID).
    const body = z.object({ email: z.string(), password: z.string() }).parse(req.body);
    const account = findAccount(body.email);
    if (!account || !(await verifyPassword(body.password, account.passwordHash))) {
      throw new HttpError(401, 'invalid_credentials', 'Email, licence number or password is incorrect.');
    }
    return { accessToken: await issueAccessToken(account.id) };
  });

  function findAccount(identifier: string): Account | undefined {
    if (identifier.includes('@')) return store.findAccountByEmail(identifier);
    const person = store.findPersonByLicence(identifier);
    return person ? store.findAccountByPerson(person.id) : undefined;
  }

  const otpCode = () => String(100000 + Math.floor(Math.random() * 900000));
  /** Sends a code by SMS. No gateway is wired: outside production the code is returned so it can be typed in. */
  function sendOtp(target: string) {
    const otp = issueOtp(newId('otp'), target, otpCode(), new Date());
    store.otps.set(otp.id, otp);
    return { otpId: otp.id, ...(config.exposeDevCodes ? { devCode: otp.code } : {}) };
  }

  app.post('/v1/auth/otp', async (req) => {
    const { phone } = z.object({ phone: z.string().regex(/^[+\d][\d\s().-]{6,20}$/) }).parse(req.body);
    return sendOtp(phone);
  });

  // --- forgot password: identifier -> confirm phone -> code -> new password ---
  app.post('/v1/auth/password-reset/start', async (req) => {
    const { identifier } = z.object({ identifier: z.string().min(3) }).parse(req.body);
    const account = findAccount(identifier);
    // Unknown identifiers get a reset id too, so the response doesn't reveal who has an account.
    const reset = { id: newId('rst'), accountId: account?.id, verified: false, expiresAt: Date.now() + 15 * 60_000 };
    store.passwordResets.set(reset.id, reset);
    return { resetId: reset.id, phoneHint: phoneHint(account?.phone) };
  });
  function activeReset(id: string) {
    const r = store.passwordResets.get(id);
    if (!r || r.expiresAt < Date.now()) throw new HttpError(410, 'reset_expired', 'Start again.');
    return r;
  }
  app.post<{ Params: { id: string } }>('/v1/auth/password-reset/:id/phone', async (req) => {
    const { phone } = z.object({ phone: z.string().min(7) }).parse(req.body);
    const r = activeReset(req.params.id);
    const account = r.accountId ? store.accounts.get(r.accountId) : undefined;
    if (!account || !samePhone(phone, account.phone)) throw new HttpError(422, 'phone_mismatch', 'That number doesn’t match the one on the account.');
    const sent = sendOtp(account.phone!);
    r.otpId = sent.otpId;
    return { sent: true, ...('devCode' in sent ? { devCode: sent.devCode } : {}) };
  });
  app.post<{ Params: { id: string } }>('/v1/auth/password-reset/:id/verify', async (req) => {
    const { code } = z.object({ code: z.string() }).parse(req.body);
    const r = activeReset(req.params.id);
    verifyOtp(r.otpId ? store.otps.get(r.otpId) : undefined, code, new Date());
    r.verified = true;
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/v1/auth/password-reset/:id/complete', async (req) => {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    const r = activeReset(req.params.id);
    if (!r.verified || !r.accountId) throw new HttpError(409, 'not_verified', 'Verify the code first.');
    assertPassword(password);
    const account = store.accounts.get(r.accountId)!;
    account.passwordHash = await hashPassword(password);
    store.passwordResets.delete(r.id);
    notify(store, account, { category: 'security', title: 'Password reset', body: 'Your password was reset with a code sent to your phone.' });
    return { ok: true };
  });

  app.get('/v1/services', async () => SERVICES);
  app.get('/v1/directory', async () => ({ organizations: ORGANIZATIONS, services: SERVICES.filter((s) => !s.hidden) }));
  app.get('/v1/locations', async () => LOCATIONS);
  app.get<{ Params: { id: string }; Querystring: { date?: string } }>('/v1/locations/:id/slots', async (req) => {
    const now = new Date();
    const dates = bookableDates(now);
    const date = req.query.date && dates.includes(req.query.date) ? req.query.date : dates[0]!;
    const booked = new Set([...store.appointments.values()].filter((a) => a.status !== 'cancelled').map((a) => `${a.locationId}|${a.startsAt}`));
    return { dates, date, slots: availableSlots(req.params.id, date, booked, now) };
  });
  app.get('/v1/faq', async () => FAQ);
  app.post('/v1/plates/check', async (req) => {
    const { plate } = z.object({ plate: z.string().max(16) }).parse(req.body);
    return checkPlate(plate, store.reservedPlates);
  });

  /** Suggestions, complaints, ratings and new-service ideas. Works signed in or as a guest. */
  app.post('/v1/feedback', async (req, reply) => {
    const body = z
      .object({
        kind: z.enum(['suggestion', 'complaint', 'rating', 'new_service']),
        topic: z.string().max(40).optional(),
        message: z.string().max(1000).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        improvements: z.array(z.string().max(40)).max(10).optional(),
      })
      .parse(req.body);
    validateFeedback(body);
    let accountId: string | undefined;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) accountId = await verifyAccessToken(header.slice(7)).catch(() => undefined);
    const item = { ...body, id: newId('fb'), accountId, reference: referenceNumber('FB'), createdAt: new Date().toISOString() };
    store.feedback.push(item);
    return reply.status(201).send({ reference: item.reference });
  });

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
      // Refresh licence status on app open (the app loads /v1/me first).
      await refreshLicenceStatuses(account);
      const person = personOf(account);
      return {
        account: { id: account.id, email: account.email, phone: account.phone, language: account.language, identityAssurance: account.identityAssurance, createdAt: account.createdAt, pinSet: !!account.pinHash },
        person,
        summary: summary(account),
        preferences: preferencesOf(account.id),
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

    /**
     * Demo only: pretend MTO reported a new status for the user's licence, to
     * show the automatic-refresh and alert path. No-op unless the demo
     * provider is active.
     */
    secure.post('/v1/demo/licence-status', async (req) => {
      const provider = getLicenceStatusProvider();
      if (!(provider instanceof DemoLicenceStatusProvider)) throw new HttpError(409, 'not_demo', 'Available in demo mode only.');
      const { code } = z.object({ code: z.enum(['Valid', 'NotValid', 'ValidWithIgnitionInterlock', 'ValidWithIgnitionInterlockAndWCode', 'NotFound'] as const satisfies readonly MtoLicenceStatus[]) }).parse(req.body);
      const licence = store.credentialsFor(me(req).personId).find((c) => c.type === 'driver_licence');
      if (!licence) throw new HttpError(404, 'not_found', 'No driver’s licence on file.');
      provider.setOverride(licence.documentNumber, code);
      const changed = await refreshLicenceStatuses(me(req), { force: true });
      return { credentialId: licence.id, status: licence.licenceStatus, changed: changed.length > 0 };
    });

    /** Lost or stolen phone: invalidate every presentation issued so far. */
    secure.post('/v1/me/revoke-wallet', async (req) => {
      const account = me(req);
      store.walletRevokedAt.set(account.id, Date.now());
      notify(store, account, { category: 'security', title: 'Wallet revoked', body: 'All QR codes issued before now are no longer valid.' });
      return { ok: true };
    });

    // --- wallet ------------------------------------------------------------
    secure.get('/v1/wallet', async (req) => {
      await refreshLicenceStatuses(me(req));
      return store.credentialsFor(me(req).personId).map(credentialView);
    });

    secure.get<{ Params: { id: string } }>('/v1/wallet/:id', async (req) => {
      const c = store.credentials.get(req.params.id);
      if (!c || c.personId !== me(req).personId) throw new HttpError(404, 'not_found', 'Credential not found');
      if (c.type === 'driver_licence') await refreshLicenceStatuses(me(req));
      return credentialView(c);
    });

    /** Force an immediate re-check (pull-to-refresh on the licence screen). */
    secure.post<{ Params: { id: string } }>('/v1/wallet/:id/status/refresh', async (req) => {
      const c = store.credentials.get(req.params.id);
      if (!c || c.personId !== me(req).personId) throw new HttpError(404, 'not_found', 'Credential not found');
      if (c.type !== 'driver_licence') throw new HttpError(400, 'not_a_licence', 'Only driver’s licences have a live status.');
      await refreshLicenceStatuses(me(req), { force: true });
      return credentialView(store.credentials.get(req.params.id)!);
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
        const payment = await takePayment(req, { purpose: 'plate_renewal', referenceId: v.id, amount: fee, label: `Plate renewal ${v.plate}` }, { ...body, method: body.method, paymentToken: body.paymentToken });
        paymentId = payment!.id;
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
      const payment = await takePayment(req, { purpose: 'fine', referenceId: f.id, amount: f.total, label: `Ticket ${f.externalId}` }, body, reply);
      if (!payment) return reply;
      f.status = 'paid';
      f.paymentId = payment.id;
      notify(store, me(req), { category: 'fine', title: 'Payment received', body: `Receipt ${payment.receiptNumber}: $${payment.amount.toFixed(2)} for ticket ${f.externalId}.`, link: `/fine/${f.id}` });
      return { fine: serializeFine(f), payment };
    });

    /** Sanad's "Pay all": every open ticket in one payment. */
    secure.post('/v1/fines/pay-all', async (req, reply) => {
      const body = paymentInput.parse(req.body);
      const open = store.finesFor(me(req).personId).filter((f) => ['outstanding', 'overdue'].includes(effectiveStatus(f)));
      if (!open.length) throw new HttpError(409, 'nothing_to_pay', 'No open tickets.');
      const amount = open.reduce((s, f) => s + f.total, 0);
      const payment = await takePayment(req, { purpose: 'fine', referenceId: open.map((f) => f.id).join(','), amount, label: `${open.length} tickets` }, body, reply);
      if (!payment) return reply;
      for (const f of open) {
        f.status = 'paid';
        f.paymentId = payment.id;
      }
      notify(store, me(req), { category: 'fine', title: 'Payment received', body: `Receipt ${payment.receiptNumber}: $${payment.amount.toFixed(2)} for ${open.length} tickets.`, link: '/fines' });
      return { fines: open.map(serializeFine), payment };
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

    // --- services and requests ("My requests") -----------------------------
    secure.post<{ Params: { id: string } }>('/v1/services/:id/requests', async (req, reply) => {
      const service = serviceById(req.params.id);
      if (!service || service.link) throw new HttpError(404, 'not_found', 'Service not found');
      const body = z.object({ data: z.record(z.string(), z.string()) }).and(paymentInput.partial()).parse(req.body);
      validateServiceData(service, body.data);

      // Paying up front is optional: without payment details a fee-bearing
      // request waits in "awaiting payment" (Sanad's flow).
      let paymentId: string | undefined;
      if (service.fee > 0 && body.method && body.paymentToken) {
        const payment = await takePayment(req, { purpose: 'service_fee', referenceId: service.id, amount: service.fee, label: service.name.en }, body as PaymentBody);
        paymentId = payment!.id;
      }
      const request = createRequest({ id: newId('req'), reference: referenceNumber('SR'), accountId: me(req).id, service, data: body.data, paymentId, now: new Date() });
      store.serviceRequests.set(request.id, request);
      if (request.status === 'completed') completeRequest(req, request);
      notifyRequest(me(req), request);
      return reply.status(201).send(request);
    });

    secure.get('/v1/service-requests', async (req) => store.requestsFor(me(req).id));
    secure.get<{ Params: { id: string } }>('/v1/service-requests/:id', async (req) => {
      const r = ownedRequest(req, req.params.id);
      return { ...r, payment: r.paymentId ? store.payments.get(r.paymentId) : undefined };
    });
    secure.post<{ Params: { id: string } }>('/v1/service-requests/:id/pay', async (req, reply) => {
      const r = ownedRequest(req, req.params.id);
      if (r.status !== 'awaiting_payment') throw new HttpError(409, 'not_payable', `Request is ${r.status}`);
      const body = paymentInput.parse(req.body);
      const service = serviceById(r.serviceId)!;
      const payment = await takePayment(req, { purpose: 'service_fee', referenceId: r.id, amount: r.amount, label: service.name.en }, body, reply);
      if (!payment) return reply;
      const paid = payRequest(r, payment.id, new Date());
      if (paid.status === 'completed') completeRequest(req, paid);
      notifyRequest(me(req), paid);
      return { request: paid, payment };
    });
    secure.post<{ Params: { id: string } }>('/v1/service-requests/:id/cancel', async (req) => {
      const r = cancelRequest(ownedRequest(req, req.params.id), new Date());
      if (r.serviceId === 'personalized-plates' && r.data.plate) store.reservedPlates.delete(r.data.plate.replace(/ /g, ''));
      return r;
    });
    secure.post<{ Params: { id: string } }>('/v1/service-requests/:id/resubmit', async (req) => {
      const body = z.object({ data: z.record(z.string(), z.string()) }).parse(req.body);
      const r = resubmitRequest(ownedRequest(req, req.params.id), body.data, new Date());
      notifyRequest(me(req), r);
      return r;
    });

    // --- personalized plates -----------------------------------------------
    secure.post('/v1/plates/orders', async (req, reply) => {
      const body = z.object({ plate: z.string().min(2).max(12), vehicleId: z.string() }).parse(req.body);
      const vehicle = ownedVehicle(req, body.vehicleId);
      const check = checkPlate(body.plate, store.reservedPlates);
      if (!check.available) throw new HttpError(409, 'plate_unavailable', check.reason!.en);
      store.reservedPlates.add(check.plate.replace(/ /g, ''));
      const service = serviceById('personalized-plates')!;
      const request = createRequest({ id: newId('req'), reference: referenceNumber('SR'), accountId: me(req).id, service, data: { plate: check.plate, vehicle: vehicle.plate }, amount: check.fee, now: new Date() });
      store.serviceRequests.set(request.id, request);
      notifyRequest(me(req), request);
      return reply.status(201).send(request);
    });

    // --- appointments ------------------------------------------------------
    secure.get('/v1/appointments', async (req) => store.appointmentsFor(me(req).id).map((a) => appointmentView(a, new Date())));
    secure.post('/v1/appointments', async (req, reply) => {
      const body = z.object({ locationId: z.string(), serviceId: z.string(), startsAt: z.iso.datetime(), acknowledged: z.boolean() }).parse(req.body);
      const appointment = bookAppointment({ ...body, id: newId('apt'), reference: referenceNumber('APT'), accountId: me(req).id, existing: [...store.appointments.values()], now: new Date() });
      store.appointments.set(appointment.id, appointment);
      const loc = LOCATIONS.find((l) => l.id === appointment.locationId)!;
      notify(store, me(req), { category: 'service', title: 'Appointment booked', body: `${visitName(appointment.serviceId).en} at ${loc.name.en}, ${appointment.date} ${appointment.time}. Reference ${appointment.reference}.`, link: `/appointments/${appointment.id}` });
      return reply.status(201).send(appointment);
    });
    secure.get<{ Params: { id: string } }>('/v1/appointments/:id', async (req) => appointmentView(ownedAppointment(req, req.params.id), new Date()));
    secure.post<{ Params: { id: string } }>('/v1/appointments/:id/cancel', async (req) => cancelAppointment(ownedAppointment(req, req.params.id)));
    secure.post<{ Params: { id: string } }>('/v1/appointments/:id/check-in', async (req) => checkIn(ownedAppointment(req, req.params.id), new Date()));

    // --- consents (third-party data requests) ------------------------------
    secure.get('/v1/consents', async (req) => store.consentsFor(me(req).id).map((c) => consentView(c, new Date())));
    secure.post<{ Params: { id: string } }>('/v1/consents/:id/decision', async (req) => {
      const body = z.object({ action: z.enum(['approve', 'reject', 'revoke']), pin: z.string().optional() }).parse(req.body);
      const c = store.consents.get(req.params.id);
      if (!c || c.accountId !== me(req).id) throw new HttpError(404, 'not_found', 'Consent not found');
      // Sharing data is confirmed with the digital ID PIN; saying no never is.
      if (body.action === 'approve') await requirePin(req, body.pin);
      decideConsent(c, body.action, new Date());
      return consentView(c, new Date());
    });

    // --- inbox -------------------------------------------------------------
    secure.get('/v1/inbox', async (req) => store.inboxFor(me(req).id));
    secure.post('/v1/inbox/read-all', async (req) => {
      for (const m of store.inboxFor(me(req).id)) m.read = true;
      return { ok: true };
    });
    secure.post<{ Params: { id: string } }>('/v1/inbox/:id/read', async (req) => {
      const m = store.inbox.get(req.params.id);
      if (!m || m.accountId !== me(req).id) throw new HttpError(404, 'not_found', 'Message not found');
      m.read = true;
      return m;
    });

    // --- payments and saved cards ------------------------------------------
    secure.get('/v1/payments', async (req) => store.paymentsFor(me(req).id));
    secure.get('/v1/me/cards', async (req) => store.cardsFor(me(req).id));
    secure.delete<{ Params: { id: string } }>('/v1/me/cards/:id', async (req) => {
      const card = store.cards.get(req.params.id);
      if (!card || card.accountId !== me(req).id) throw new HttpError(404, 'not_found', 'Card not found');
      store.cards.delete(card.id);
      return { ok: true };
    });

    // --- digital signature -------------------------------------------------
    secure.post('/v1/signatures', async (req, reply) => {
      const body = z.object({ documentTitle: z.string().min(1), documentContent: z.string().min(1), consent: z.literal(true), pin: z.string().optional() }).parse(req.body);
      await requirePin(req, body.pin);
      const account = me(req);
      const documentSha256 = sha256Hex(body.documentContent);
      const signedAt = new Date();
      const record = {
        id: newId('sig'),
        accountId: account.id,
        documentTitle: body.documentTitle,
        documentSha256,
        signedAt: signedAt.toISOString(),
        retainedUntil: new Date(signedAt.getTime() + SIGNED_RETENTION_DAYS * 86400_000).toISOString(),
        signature: await signDocumentHash(account.id, documentSha256),
      };
      store.signatures.set(record.id, record);
      return reply.status(201).send(record);
    });
    secure.get('/v1/signatures', async (req) => [...store.signatures.values()].filter((s) => s.accountId === me(req).id).sort((a, b) => b.signedAt.localeCompare(a.signedAt)));
    secure.get('/v1/me/signature', async (req) => ({ path: me(req).savedSignature ?? null }));
    secure.put('/v1/me/signature', async (req) => {
      const { path } = z.object({ path: z.string().max(20_000).regex(/^[MLQCZ0-9 .,-]*$/i).nullable() }).parse(req.body);
      me(req).savedSignature = path ?? undefined;
      return { path };
    });

    // --- account security and preferences ----------------------------------
    secure.post('/v1/me/password', async (req) => {
      const body = z.object({ currentPassword: z.string(), newPassword: z.string() }).parse(req.body);
      const account = me(req);
      if (!(await verifyPassword(body.currentPassword, account.passwordHash))) throw new HttpError(422, 'wrong_password', 'The current password is incorrect.');
      assertPassword(body.newPassword);
      account.passwordHash = await hashPassword(body.newPassword);
      notify(store, account, { category: 'security', title: 'Password changed', body: 'Your password was changed. If this wasn’t you, reset it now.' });
      return { ok: true };
    });
    secure.post('/v1/me/pin', async (req) => {
      const body = z.object({ currentPin: z.string().optional(), newPin: z.string() }).parse(req.body);
      const account = me(req);
      if (account.pinHash) await requirePin(req, body.currentPin);
      assertPin(body.newPin);
      account.pinHash = await hashPassword(body.newPin);
      notify(store, account, { category: 'security', title: 'Digital ID PIN changed', body: 'Your digital ID PIN was changed.' });
      return { ok: true };
    });
    secure.get('/v1/me/preferences', async (req) => preferencesOf(me(req).id));
    secure.put('/v1/me/preferences', async (req) => {
      const patch = z
        .object({
          favouriteCards: z.array(z.string()).optional(),
          favouriteServices: z.array(z.string()).optional(),
          notifications: z.object({ renewals: z.boolean(), tickets: z.boolean(), requests: z.boolean() }).partial().optional(),
        })
        .parse(req.body);
      const owned = new Set(store.credentialsFor(me(req).personId).map((c) => c.id));
      if (patch.favouriteCards?.some((id) => !owned.has(id))) throw new HttpError(400, 'unknown_card', 'Unknown document.');
      const next = mergePreferences(preferencesOf(me(req).id), patch as Partial<Preferences>);
      store.preferences.set(me(req).id, next);
      return next;
    });
  });

  /**
   * Scheduled sweep: re-check every account's licences in one batched pass
   * (how the MTO feed is meant to be used). Called nightly by server.ts.
   * Returns how many statuses changed.
   */
  async function sweepLicenceStatuses(): Promise<{ checked: number; changed: number }> {
    const licences = [...store.credentials.values()].filter((c) => c.type === 'driver_licence');
    if (!licences.length) return { checked: 0, changed: 0 };
    let results;
    try {
      results = await getLicenceStatusProvider().check(licences.map((c) => c.documentNumber));
    } catch (e) {
      app.log.error({ err: e }, 'licence-status sweep failed');
      return { checked: 0, changed: 0 };
    }
    const now = new Date();
    let changed = 0;
    for (const c of licences) {
      const result = results.get(c.documentNumber);
      if (!result) continue;
      const previous = c.licenceStatus;
      const next = buildLicenceStatus(result, { expiresOn: c.expiresOn, source: getLicenceStatusProvider().source === 'mto_batch' ? 'mto_batch' : 'demo', now, recheckSeconds: config.licenceStatus.recheckSeconds });
      c.licenceStatus = next;
      c.status = next.display === 'suspended' ? 'suspended' : next.display === 'not_found' ? 'revoked' : c.status === 'revoked' ? 'revoked' : 'valid';
      if (!previous || previous.code !== next.code) {
        changed++;
        const account = store.findAccountByPerson(c.personId);
        if (account && isAdverseChange(previous, next)) {
          const note = adverseStatusNotice(next);
          notify(store, account, { category: 'security', title: note.title, body: note.body, link: `/credential/${c.id}` });
        }
      }
    }
    return { checked: licences.length, changed };
  }
  app.decorate('sweepLicenceStatuses', sweepLicenceStatuses);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    store: Store;
    sweepLicenceStatuses: () => Promise<{ checked: number; changed: number }>;
  }
}
