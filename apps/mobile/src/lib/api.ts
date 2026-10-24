import { API_URL, DEMO_MODE } from './config';
import { demoRequest, DemoHttpError } from './demo/backend';
import type {
  AccessLogEntry,
  Appointment,
  ConsentView,
  Faq,
  Location,
  Organization,
  PlateCheck,
  Preferences,
  RequestDetail,
  SavedCard,
  Slot,
  Credential,
  Disclosure,
  Fine,
  InboxMessage,
  Me,
  Payment,
  PaymentMethod,
  ServiceDefinition,
  ServiceRequest,
  SignatureRecord,
  Vehicle,
  VerifyResult,
} from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (DEMO_MODE) {
    try {
      return (await demoRequest(method, path, body as Record<string, unknown> | undefined, accessToken)) as T;
    } catch (e) {
      if (e instanceof DemoHttpError) {
        if (e.status === 401 && accessToken) onUnauthorized?.();
        throw new ApiError(e.status, e.code, e.message);
      }
      throw e;
    }
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', `Can't reach the server at ${API_URL}.`);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401 && accessToken) onUnauthorized?.();
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export interface PaymentInput {
  method: PaymentMethod;
  paymentToken: string;
  /** Pay with a saved card. */
  cardId?: string;
  /** Keep the card for next time (display details only). */
  saveCard?: { last4: string; expiry: string; brand: SavedCard['brand'] };
}

export const api = {
  login: (email: string, password: string) => request<{ accessToken: string }>('POST', '/v1/auth/login', { email, password }),
  register: (body: {
    email: string;
    password: string;
    phone?: string;
    licenceNumber: string;
    dateOfBirth: string;
    idvSessionId: string;
    language: 'en' | 'fr';
    pin?: string;
    otpId?: string;
    otpCode?: string;
  }) => request<{ accessToken: string }>('POST', '/v1/auth/register', body),
  sendOtp: (phone: string) => request<{ otpId: string; devCode?: string }>('POST', '/v1/auth/otp', { phone }),
  resetStart: (identifier: string) => request<{ resetId: string; phoneHint: string }>('POST', '/v1/auth/password-reset/start', { identifier }),
  resetPhone: (id: string, phone: string) => request<{ sent: true; devCode?: string }>('POST', `/v1/auth/password-reset/${id}/phone`, { phone }),
  resetVerify: (id: string, code: string) => request<{ ok: true }>('POST', `/v1/auth/password-reset/${id}/verify`, { code }),
  resetComplete: (id: string, password: string) => request<{ ok: true }>('POST', `/v1/auth/password-reset/${id}/complete`, { password }),

  directory: () => request<{ organizations: Organization[]; services: ServiceDefinition[] }>('GET', '/v1/directory'),
  locations: () => request<Location[]>('GET', '/v1/locations'),
  slots: (locationId: string, date?: string) =>
    request<{ dates: string[]; date: string; slots: Slot[] }>('GET', `/v1/locations/${locationId}/slots${date ? `?date=${date}` : ''}`),
  faq: () => request<Faq[]>('GET', '/v1/faq'),
  feedback: (body: { kind: 'suggestion' | 'complaint' | 'rating' | 'new_service'; topic?: string; message?: string; rating?: number; improvements?: string[] }) =>
    request<{ reference: string }>('POST', '/v1/feedback', body),
  checkPlate: (plate: string) => request<PlateCheck>('POST', '/v1/plates/check', { plate }),

  me: () => request<Me>('GET', '/v1/me'),
  updateMe: (body: { language?: 'en' | 'fr'; phone?: string }) => request<{ ok: true }>('PATCH', '/v1/me', body),
  registerPushToken: (token: string) => request<{ ok: true }>('POST', '/v1/me/push-tokens', { token }),
  accessLog: () => request<AccessLogEntry[]>('GET', '/v1/me/access-log'),
  revokeWallet: () => request<{ ok: true }>('POST', '/v1/me/revoke-wallet', {}),
  changePassword: (currentPassword: string, newPassword: string) => request<{ ok: true }>('POST', '/v1/me/password', { currentPassword, newPassword }),
  changePin: (newPin: string, currentPin?: string) => request<{ ok: true }>('POST', '/v1/me/pin', { currentPin, newPin }),
  preferences: () => request<Preferences>('GET', '/v1/me/preferences'),
  savePreferences: (patch: Partial<Preferences>) => request<Preferences>('PUT', '/v1/me/preferences', patch),
  cards: () => request<SavedCard[]>('GET', '/v1/me/cards'),
  deleteCard: (id: string) => request<{ ok: true }>('DELETE', `/v1/me/cards/${id}`),
  savedSignature: () => request<{ path: string | null }>('GET', '/v1/me/signature'),
  saveSignature: (path: string | null) => request<{ path: string | null }>('PUT', '/v1/me/signature', { path }),

  wallet: () => request<Credential[]>('GET', '/v1/wallet'),
  credential: (id: string) => request<Credential>('GET', `/v1/wallet/${id}`),
  refreshLicenceStatus: (id: string) => request<Credential>('POST', `/v1/wallet/${id}/status/refresh`, {}),
  present: (id: string, disclosure: Disclosure) =>
    request<{ token: string; expiresInSeconds: number }>('POST', `/v1/wallet/${id}/presentations`, { disclosure }),
  verify: (token: string, verifier: string) => request<VerifyResult>('POST', '/v1/verify', { token, verifier }),

  vehicles: () => request<Vehicle[]>('GET', '/v1/vehicles'),
  vehicle: (id: string) => request<Vehicle & { fines: Fine[] }>('GET', `/v1/vehicles/${id}`),
  renewPlate: (id: string, body: { years: 1 | 2 } & Partial<PaymentInput>) =>
    request<{ vehicle: Vehicle; fee: number; paymentId?: string }>('POST', `/v1/vehicles/${id}/renew`, body),

  fines: () => request<Fine[]>('GET', '/v1/fines'),
  fine: (id: string) => request<Fine>('GET', `/v1/fines/${id}`),
  payFine: (id: string, body: PaymentInput) => request<{ fine: Fine; payment: Payment }>('POST', `/v1/fines/${id}/pay`, body),
  payAllFines: (body: PaymentInput) => request<{ fines: Fine[]; payment: Payment }>('POST', '/v1/fines/pay-all', body),
  disputeFine: (id: string, body: { option: import('./types').DisputeOption; reason: string }) =>
    request<Fine>('POST', `/v1/fines/${id}/dispute`, body),
  /** Re-check a POA ticket's court case status now (camera/officer tickets). */
  refreshCaseStatus: (id: string) => request<Fine>('POST', `/v1/fines/${id}/case-status/refresh`, {}),
  /** Add a POA ticket by its location code + offence number (the public search). */
  addPoaTicket: (locationCode: string, offenceNumber: string) =>
    request<{ outcome: string; fine: Fine }>('POST', '/v1/poa/lookup', { locationCode, offenceNumber }),

  services: () => request<ServiceDefinition[]>('GET', '/v1/services'),
  submitService: (id: string, body: { data: Record<string, string> } & Partial<PaymentInput>) =>
    request<ServiceRequest>('POST', `/v1/services/${id}/requests`, body),
  serviceRequests: () => request<ServiceRequest[]>('GET', '/v1/service-requests'),
  serviceRequest: (id: string) => request<RequestDetail>('GET', `/v1/service-requests/${id}`),
  payRequest: (id: string, body: PaymentInput) => request<{ request: ServiceRequest; payment: Payment }>('POST', `/v1/service-requests/${id}/pay`, body),
  cancelRequest: (id: string) => request<ServiceRequest>('POST', `/v1/service-requests/${id}/cancel`, {}),
  resubmitRequest: (id: string, data: Record<string, string>) => request<ServiceRequest>('POST', `/v1/service-requests/${id}/resubmit`, { data }),
  orderPlate: (plate: string, vehicleId: string) => request<ServiceRequest>('POST', '/v1/plates/orders', { plate, vehicleId }),

  appointments: () => request<Appointment[]>('GET', '/v1/appointments'),
  appointment: (id: string) => request<Appointment>('GET', `/v1/appointments/${id}`),
  book: (body: { locationId: string; serviceId: string; startsAt: string; acknowledged: boolean }) => request<Appointment>('POST', '/v1/appointments', body),
  cancelAppointment: (id: string) => request<Appointment>('POST', `/v1/appointments/${id}/cancel`, {}),
  checkIn: (id: string) => request<Appointment>('POST', `/v1/appointments/${id}/check-in`, {}),

  consents: () => request<ConsentView[]>('GET', '/v1/consents'),
  decideConsent: (id: string, action: 'approve' | 'reject' | 'revoke', pin?: string) => request<ConsentView>('POST', `/v1/consents/${id}/decision`, { action, pin }),

  inbox: () => request<InboxMessage[]>('GET', '/v1/inbox'),
  markRead: (id: string) => request<InboxMessage>('POST', `/v1/inbox/${id}/read`, {}),
  markAllRead: () => request<{ ok: true }>('POST', '/v1/inbox/read-all', {}),

  payments: () => request<Payment[]>('GET', '/v1/payments'),

  /** Demo mode only: pretend a red-light camera just recorded one of your plates. */
  simulateCameraTicket: () => request<{ fineId: string; plate: string }>('POST', '/v1/demo/camera-event', {}),
  simulateParkingTicket: () => request<{ fineId: string; plate: string }>('POST', '/v1/demo/parking-event', {}),
  addParkingTicket: (penaltyNoticeNumber: string) => request<{ outcome: string; fine: Fine }>('POST', '/v1/parking/lookup', { penaltyNoticeNumber }),

  /** Demo mode only: pretend MTO reported a new status for your licence. */
  setDemoLicenceStatus: (code: import('./types').MtoLicenceStatus) =>
    request<{ credentialId: string; status: import('./types').LicenceStatus; changed: boolean }>('POST', '/v1/demo/licence-status', { code }),
  /** Demo mode only: move a POA ticket's court case to a given status. */
  setDemoCaseStatus: (fineId: string, code: import('./types').POACaseCode) =>
    request<Fine>('POST', `/v1/demo/case-status/${fineId}`, { code }),

  sign: (body: { documentTitle: string; documentContent: string; consent: true; pin: string }) =>
    request<SignatureRecord>('POST', '/v1/signatures', body),
  signatures: () => request<SignatureRecord[]>('GET', '/v1/signatures'),
};
