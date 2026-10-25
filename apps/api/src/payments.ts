import { newId, referenceNumber } from './crypto.js';
import { config } from './config.js';
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
  label?: string;
  cardLast4?: string;
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

/**
 * Stripe adapter (production). Confirms a PaymentIntent for the amount using the
 * payment-method token minted by the client card/wallet sheet. Wired only when
 * PAYMENTS_PROVIDER=stripe and STRIPE_SECRET_KEY is set. A production deployment
 * would add webhook reconciliation and idempotency keys; this is the synchronous
 * charge boundary the route handlers call.
 */
export const stripePaymentProvider: PaymentProvider = {
  async charge(req) {
    const key = config.payments.stripeSecretKey;
    if (!key) throw new Error('STRIPE_SECRET_KEY must be set for the Stripe payment provider.');
    const form = new URLSearchParams({
      amount: String(Math.round(req.amount * 100)),
      currency: 'cad',
      confirm: 'true',
      payment_method: req.paymentToken,
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'never',
      description: req.label ?? req.purpose,
      'metadata[accountId]': req.accountId,
      'metadata[purpose]': req.purpose,
      'metadata[referenceId]': req.referenceId,
    });
    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const intent = (await res.json()) as { id?: string; status?: string; error?: { message?: string } };
    if (!res.ok || !intent.id) throw new Error(intent.error?.message ?? `stripe returned ${res.status}`);
    return { approved: intent.status === 'succeeded', processorRef: intent.id };
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
    ...(req.label ? { label: req.label } : {}),
    ...(req.cardLast4 ? { cardLast4: req.cardLast4 } : {}),
  };
  store.payments.set(payment.id, payment);
  return payment;
}
