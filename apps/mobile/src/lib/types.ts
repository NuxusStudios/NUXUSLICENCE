// Mirrors apps/api/src/types.ts response shapes.

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface Person {
  id: string;
  licenceNumber: string;
  givenNames: string;
  surname: string;
  dateOfBirth: string;
  sex: 'M' | 'F' | 'X';
  heightCm: number;
  address: Address;
}

export type CredentialType = 'driver_licence' | 'photo_card' | 'health_card' | 'vehicle_permit';

export interface Vehicle {
  id: string;
  plate: string;
  jurisdiction: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  colour: string;
  /** Body style as recorded on the permit, e.g. SEDAN, MOTORCYCLE. */
  bodyType?: string;
  plateValidationExpires: string;
  insurance: { provider: string; policyNumber: string; expiresOn: string };
}

export interface Credential {
  id: string;
  type: CredentialType;
  documentNumber: string;
  /** Field 5 "DD/REF": identifies this particular card issuance. */
  discriminator?: string;
  /** Card stock control number, printed on the back. */
  controlNumber?: string;
  issuedOn: string;
  expiresOn: string;
  status: 'valid' | 'suspended' | 'expired' | 'revoked';
  licenceClass?: string;
  conditions?: string[];
  vehicleId?: string;
  holder: Omit<Person, 'id' | 'licenceNumber'>;
  vehicle?: Vehicle;
}

export type FineStatus = 'outstanding' | 'paid' | 'disputed' | 'overdue' | 'cancelled';
export type FineSource = 'red_light_camera' | 'speed_camera' | 'parking' | 'officer_issued';

export interface Fine {
  id: string;
  externalId: string;
  source: FineSource;
  liability: 'owner' | 'driver';
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
  dispute?: { option: 'early_resolution' | 'trial'; reason: string; submittedAt: string; reference: string };
  vehicle?: Vehicle;
  payment?: Payment;
}

export interface Payment {
  id: string;
  purpose: 'fine' | 'plate_renewal' | 'service_fee';
  referenceId: string;
  amount: number;
  currency: 'CAD';
  method: PaymentMethod;
  status: 'succeeded' | 'failed';
  receiptNumber: string;
  createdAt: string;
}

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay' | 'interac';

export interface InboxMessage {
  id: string;
  category: 'fine' | 'renewal' | 'service' | 'security' | 'general';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface Localized {
  en: string;
  fr: string;
}

export interface ServiceDefinition {
  id: string;
  category: 'driver' | 'vehicle' | 'identity' | 'health' | 'records';
  name: Localized;
  description: Localized;
  fee: number;
  online: boolean;
  fields: { key: string; label: Localized; type: 'text' | 'date' | 'select'; options?: string[]; required: boolean }[];
}

export interface ServiceRequest {
  id: string;
  serviceId: string;
  status: 'submitted' | 'in_review' | 'completed' | 'rejected';
  reference: string;
  createdAt: string;
}

export interface Me {
  account: { id: string; email: string; phone?: string; language: 'en' | 'fr'; identityAssurance: string; createdAt: string };
  person: Person;
  summary: {
    openFines: number;
    openFinesTotal: number;
    overdueFines: number;
    unreadMessages: number;
    renewalsDue: { kind: string; id: string; label: string; expiresOn: string }[];
  };
}

export interface AccessLogEntry {
  id: string;
  credentialId: string;
  verifier: string;
  claims: string[];
  verifiedAt: string;
}

export type Disclosure = 'full' | 'age_over_19' | 'age_over_18' | 'name_photo' | 'licence_status';

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  credentialType?: CredentialType;
  disclosure?: Disclosure;
  claims?: Record<string, unknown>;
  expiresAt?: number;
}

export interface SignatureRecord {
  id: string;
  documentTitle: string;
  documentSha256: string;
  signedAt: string;
  signature: string;
}
