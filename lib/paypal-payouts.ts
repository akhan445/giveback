// PayPal Payouts: giveback (the PLATFORM sandbox account) pays cashback to the organization (the
// merchant account). It authenticates with its own REST app (PAYOUT_CLIENT_ID / PAYOUT_CLIENT_SECRET)
// because PayPal never lets an account pay itself, and the platform and the organization are
// different parties. Server-side only.
import { PayPalApiError } from './paypal';
import { centsToDecimal } from './money';

const BASE_URL = 'https://api-m.sandbox.paypal.com';
let token: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const { PAYOUT_CLIENT_ID: id, PAYOUT_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYOUT_CLIENT_ID and PAYOUT_CLIENT_SECRET must be set (see env.example)');
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new PayPalApiError(res.status, '/v1/oauth2/token (payouts)', await res.text());
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 401 && attempt === 1) { token = undefined; continue; }
    throw new PayPalApiError(res.status, path, await res.text());
  }
}

export type PayoutBatch = { batch_header: { payout_batch_id: string; batch_status: string } };

/**
 * Sends one payout. `senderBatchId` is the idempotency key: PayPal rejects a second batch with the same
 * id, so a retry can never pay twice. Amounts are integer cents here, decimal strings only on the wire.
 */
export function createPayout(p: { senderBatchId: string; amountCents: number; currency: string; receiverEmail: string; note: string; subject: string }) {
  return call<PayoutBatch>('POST', '/v1/payments/payouts', {
    sender_batch_header: { sender_batch_id: p.senderBatchId, email_subject: p.subject, email_message: p.note },
    items: [
      {
        recipient_type: 'EMAIL',
        receiver: p.receiverEmail,
        amount: { value: centsToDecimal(p.amountCents), currency: p.currency },
        note: p.note,
        sender_item_id: p.senderBatchId,
      },
    ],
  });
}

export function getPayoutBatch(batchId: string) {
  return call<PayoutBatch>('GET', `/v1/payments/payouts/${encodeURIComponent(batchId)}`);
}

/** Payout webhooks are delivered to the platform app, which has its own webhook id. */
export async function verifyPayoutWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYOUT_WEBHOOK_ID;
  if (!webhookId) return false;
  const res = await call<{ verification_status: string }>('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: headers.get('paypal-auth-algo'),
    cert_url: headers.get('paypal-cert-url'),
    transmission_id: headers.get('paypal-transmission-id'),
    transmission_sig: headers.get('paypal-transmission-sig'),
    transmission_time: headers.get('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: event,
  });
  return res.verification_status === 'SUCCESS';
}
