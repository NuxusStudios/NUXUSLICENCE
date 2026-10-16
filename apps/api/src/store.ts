import type {
  Account,
  Appointment,
  Consent,
  Feedback,
  Otp,
  Preferences,
  SavedCard,
  AccessLogEntry,
  Credential,
  Fine,
  InboxMessage,
  Payment,
  RegistryPerson,
  ServiceRequest,
  SignatureRecord,
  UnmatchedCameraEvent,
  Vehicle,
} from './types.js';

/**
 * In-memory persistence. Every collection is a Map so the store can be swapped
 * for Postgres (see docs/ARCHITECTURE.md) without changing route handlers:
 * handlers only use the methods below.
 */
export class Store {
  // Mirror of the authoritative registry (read-only in production; synced via
  // the registry integration adapter).
  people = new Map<string, RegistryPerson>();
  credentials = new Map<string, Credential>();
  vehicles = new Map<string, Vehicle>();

  // Owned by this platform.
  accounts = new Map<string, Account>();
  fines = new Map<string, Fine>();
  inbox = new Map<string, InboxMessage>();
  payments = new Map<string, Payment>();
  serviceRequests = new Map<string, ServiceRequest>();
  signatures = new Map<string, SignatureRecord>();
  accessLog = new Map<string, AccessLogEntry>();
  appointments = new Map<string, Appointment>();
  consents = new Map<string, Consent>();
  cards = new Map<string, SavedCard>();
  preferences = new Map<string, Preferences>();
  feedback: Feedback[] = [];
  otps = new Map<string, Otp>();
  passwordResets = new Map<string, { id: string; accountId?: string; otpId?: string; verified: boolean; expiresAt: number }>();
  /** Personalized plate combinations ordered through the app. */
  reservedPlates = new Set<string>();
  unmatchedCameraEvents: UnmatchedCameraEvent[] = [];
  /** Idempotency: upstream camera event id -> fine id. */
  processedCameraEvents = new Map<string, string>();
  /** Idempotency: parking penalty-notice number -> fine id. */
  processedParkingEvents = new Map<string, string>();
  unmatchedParkingEvents: { event: import('./parking.js').ParkingEvent; reason: 'plate_not_found' | 'out_of_province'; receivedAt: string }[] = [];
  /** Revoked presentation token ids (e.g. device reported lost). */
  revokedPresentationIds = new Set<string>();
  /** Accounts whose wallet was remotely wiped; presentations issued before this time are rejected. */
  walletRevokedAt = new Map<string, number>();

  findPersonByLicence(licenceNumber: string): RegistryPerson | undefined {
    const normalized = normalizeLicence(licenceNumber);
    for (const p of this.people.values()) {
      if (normalizeLicence(p.licenceNumber) === normalized) return p;
    }
    return undefined;
  }

  findAccountByEmail(email: string): Account | undefined {
    const e = email.trim().toLowerCase();
    for (const a of this.accounts.values()) if (a.email === e) return a;
    return undefined;
  }

  findAccountByPerson(personId: string): Account | undefined {
    for (const a of this.accounts.values()) if (a.personId === personId) return a;
    return undefined;
  }

  findVehicleByPlate(plate: string, jurisdiction: string): Vehicle | undefined {
    const p = normalizePlate(plate);
    for (const v of this.vehicles.values()) {
      if (normalizePlate(v.plate) === p && v.jurisdiction === jurisdiction) return v;
    }
    return undefined;
  }

  credentialsFor(personId: string): Credential[] {
    return [...this.credentials.values()].filter((c) => c.personId === personId);
  }

  vehiclesFor(personId: string): Vehicle[] {
    return [...this.vehicles.values()].filter((v) => v.ownerPersonId === personId);
  }

  finesFor(personId: string): Fine[] {
    return [...this.fines.values()]
      .filter((f) => f.personId === personId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  inboxFor(accountId: string): InboxMessage[] {
    return [...this.inbox.values()]
      .filter((m) => m.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  paymentsFor(accountId: string): Payment[] {
    return [...this.payments.values()]
      .filter((p) => p.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  requestsFor(accountId: string) {
    return [...this.serviceRequests.values()].filter((r) => r.accountId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  appointmentsFor(accountId: string): Appointment[] {
    return [...this.appointments.values()].filter((a) => a.accountId === accountId).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  consentsFor(accountId: string): Consent[] {
    return [...this.consents.values()].filter((c) => c.accountId === accountId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  cardsFor(accountId: string): SavedCard[] {
    return [...this.cards.values()].filter((c) => c.accountId === accountId);
  }

  accessLogFor(accountId: string): AccessLogEntry[] {
    return [...this.accessLog.values()]
      .filter((e) => e.accountId === accountId)
      .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));
  }
}

export function normalizeLicence(n: string): string {
  return n.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

export function normalizePlate(p: string): string {
  return p.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}
