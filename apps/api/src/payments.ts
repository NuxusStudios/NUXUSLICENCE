import { newId, referenceNumber } from './crypto.js';
import type { Store } from './store.js';
import type { Payment } from './types.js';

export interface ChargeRequest {
  accountId: string;
  purpose: Payment['purpose'];
  referenceId: string;
  amount: number;
  method: Payment['method'];
  /** Token from the client-side wallet / card sheet (Stripe, Moneris, Apple Pay, Google Pay...). */
  paymentToken: string;
}

/**
 * Payment processor boundary. The demo provider approves every token except
 * "tok_decline". Swap for the province's acquirer (Moneris / Global Payments /
 * Stripe) by implementing this interface.
 */
export interface PaymentProvider {
  charge(req: ChargeRequest): Promise<{ approved: boolean; processorRef: string }>;
}

export const demoPaymentProvider: PaymentProvider = {
  async charge(req) {
    return { approved: req.paymentToken !== 'tok_decline', processorRef: newId('ch') };
  },
};

let provider: PaymentProvider = demoPaymentProvider;
export function setPaymentProvider(p: PaymentProvider) {
  provider = p;
}

export async function charge(store: Store, req: ChargeRequest): Promise<Payment> {
  const result = await provider.charge(req);
  const payment: Payment = {
    id: newId('pay'),
    accountId: req.accountId,
    purpose: req.purpose,
    referenceId: req.referenceId,
    amount: Math.round(req.amount * 100) / 100,
    currency: 'CAD',
    method: req.method,
    status: result.approved ? 'succeeded' : 'failed',
    receiptNumber: referenceNumber('RCPT'),
    createdAt: new Date().toISOString(),
  };
  store.payments.set(payment.id, payment);
  return payment;
}
