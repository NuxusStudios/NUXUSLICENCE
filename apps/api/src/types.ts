// Domain model. In production each "registry" record comes from the system of
// record (e.g. the provincial driver & vehicle licensing database); this
// service only stores the citizen account, consents, payments and inbox.

export type CredentialType = 'driver_licence' | 'photo_card' | 'health_card' | 'vehicle_permit';

/** A person as held by the authoritative licensing registry. */
export interface RegistryPerson {
  id: string;
  licenceNumber: string; // e.g. A1234-56789-01234
  givenNames: string;
  surname: string;
  dateOfBirth: string; // YYYY-MM-DD
  sex: 'M' | 'F' | 'X';
  heightCm: number;
  address: Address;
  photoUrl?: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface Credential {
  id: string;
  personId: string;
  type: CredentialType;
  /** Number printed on the physical document. */
  documentNumber: string;
  issuedOn: string;
  expiresOn: string;
  status: 'valid' | 'suspended' | 'expired' | 'revoked';
  /** Licence class (G, G2, M...) for driver licences. */
  licenceClass?: string;
  conditions?: string[];
  /** Vehicle permits point at a vehicle. */
  vehicleId?: string;
}

export interface Vehicle {
  id: string;
  ownerPersonId: string;
  plate: string;
  jurisdiction: string; // ON, QC...
  vin: string;
  make: string;
  model: string;
  year: number;
  colour: string;
  plateValidationExpires: string;
  insurance: { provider: string; policyNumber: string; expiresOn: string };
}

export type FineSource =
  | 'red_light_camera'
  | 'speed_camera'
  | 'parking'
  | 'officer_issued';

export type FineStatus =
  | 'outstanding'
  | 'paid'
  | 'disputed'
  | 'overdue'
  | 'cancelled';

export interface Fine {
  id: string;
  /** Upstream id from the issuing system (camera processing centre, municipality, police). */
  externalId: string;
  source: FineSource;
  /**
   * Camera and parking tickets are issued to the vehicle's registered owner
   * (owner liability, no demerit points). Officer-issued tickets are issued to
   * the identified driver and can carry demerit points.
   */
  liability: 'owner' | 'driver';
  personId: string;
  vehicleId?: string;
  plate?: string;
  offence: string;
  statute: string;
  location: string;
  municipality: string;
  occurredAt: string;
  issuedAt: string;
  dueDate: string;
  setFine: number;
  victimFineSurcharge: number;
  courtCosts: number;
  total: number;
  demeritPoints: number;
  status: FineStatus;
  evidence?: { images: string[]; recordedSpeedKmh?: number; postedLimitKmh?: number; secondsIntoRed?: number };
  paymentId?: string;
  dispute?: Dispute;
}

export interface Dispute {
  option: 'early_resolution' | 'trial';
  reason: string;
  submittedAt: string;
  reference: string;
}

export interface Account {
  id: string;
  personId: string;
  email: string;
  phone?: string;
  passwordHash: string;
  language: 'en' | 'fr';
  createdAt: string;
  identityAssurance: 'IAL2';
  pushTokens: string[];
}

export interface InboxMessage {
  id: string;
  accountId: string;
  category: 'fine' | 'renewal' | 'service' | 'security' | 'general';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string; // deep link inside the app, e.g. /fine/f_123
}

export interface Payment {
  id: string;
  accountId: string;
  purpose: 'fine' | 'plate_renewal' | 'service_fee';
  referenceId: string;
  amount: number;
  currency: 'CAD';
  method: 'card' | 'apple_pay' | 'google_pay' | 'interac';
  status: 'succeeded' | 'failed';
  receiptNumber: string;
  createdAt: string;
}

export interface ServiceDefinition {
  id: string;
  category: 'driver' | 'vehicle' | 'identity' | 'health' | 'records';
  name: { en: string; fr: string };
  description: { en: string; fr: string };
  fee: number;
  online: boolean;
  fields: ServiceField[];
}

export interface ServiceField {
  key: string;
  label: { en: string; fr: string };
  type: 'text' | 'date' | 'select';
  options?: string[];
  required: boolean;
}

export interface ServiceRequest {
  id: string;
  accountId: string;
  serviceId: string;
  data: Record<string, string>;
  status: 'submitted' | 'in_review' | 'completed' | 'rejected';
  reference: string;
  createdAt: string;
  paymentId?: string;
}

export interface SignatureRecord {
  id: string;
  accountId: string;
  documentTitle: string;
  documentSha256: string;
  signedAt: string;
  /** Detached JWS over the document hash, signed by the platform on the citizen's behalf after step-up auth. */
  signature: string;
}

/** Transparency log: every time a credential is presented and verified. */
export interface AccessLogEntry {
  id: string;
  accountId: string;
  credentialId: string;
  verifier: string;
  claims: string[];
  verifiedAt: string;
}

export interface CameraEvent {
  eventId: string;
  type: 'red_light' | 'speed';
  plate: string;
  jurisdiction: string;
  capturedAt: string;
  location: string;
  municipality: string;
  images: string[];
  recordedSpeedKmh?: number;
  postedLimitKmh?: number;
  secondsIntoRed?: number;
  setFine: number;
}

export interface UnmatchedCameraEvent {
  event: CameraEvent;
  reason: 'plate_not_found' | 'out_of_province' | 'no_digital_account';
  receivedAt: string;
}
