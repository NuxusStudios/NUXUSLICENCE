import { API_URL, DEMO_MODE } from './config';
import { demoRequest, DemoHttpError } from './demo/backend';
import type {
  AccessLogEntry,
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
  }) => request<{ accessToken: string }>('POST', '/v1/auth/register', body),

  me: () => request<Me>('GET', '/v1/me'),
  updateMe: (body: { language?: 'en' | 'fr'; phone?: string }) => request<{ ok: true }>('PATCH', '/v1/me', body),
  registerPushToken: (token: string) => request<{ ok: true }>('POST', '/v1/me/push-tokens', { token }),
  accessLog: () => request<AccessLogEntry[]>('GET', '/v1/me/access-log'),
  revokeWallet: () => request<{ ok: true }>('POST', '/v1/me/revoke-wallet', {}),

  wallet: () => request<Credential[]>('GET', '/v1/wallet'),
  credential: (id: string) => request<Credential>('GET', `/v1/wallet/${id}`),
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
  disputeFine: (id: string, body: { option: 'early_resolution' | 'trial'; reason: string }) =>
    request<Fine>('POST', `/v1/fines/${id}/dispute`, body),

  services: () => request<ServiceDefinition[]>('GET', '/v1/services'),
  submitService: (id: string, body: { data: Record<string, string> } & Partial<PaymentInput>) =>
    request<ServiceRequest>('POST', `/v1/services/${id}/requests`, body),
  serviceRequests: () => request<ServiceRequest[]>('GET', '/v1/service-requests'),

  inbox: () => request<InboxMessage[]>('GET', '/v1/inbox'),
  markRead: (id: string) => request<InboxMessage>('POST', `/v1/inbox/${id}/read`, {}),

  payments: () => request<Payment[]>('GET', '/v1/payments'),

  /** Demo mode only: pretend a red-light camera just recorded one of your plates. */
  simulateCameraTicket: () => request<{ fineId: string; plate: string }>('POST', '/v1/demo/camera-event', {}),

  sign: (body: { documentTitle: string; documentContent: string; consent: true }) =>
    request<SignatureRecord>('POST', '/v1/signatures', body),
  signatures: () => request<SignatureRecord[]>('GET', '/v1/signatures'),
};
