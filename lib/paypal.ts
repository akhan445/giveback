// PayPal REST client: every call this demo makes to PayPal goes through here. It covers
// catalog products, billing plans, invoicing, Transaction Search and balances, with plain
// fetch and no SDK. Server-side only: it reads the client secret from the environment.

const BASE_URL = 'https://api-m.sandbox.paypal.com';
const MAX_ATTEMPTS = 4;

export class PayPalApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    body: string,
  ) {
    super(`PayPal ${status} on ${path}: ${body.slice(0, 300)}`);
    this.name = 'PayPalApiError';
  }
}

// Two PayPal accounts are in play. The MERCHANT account is the vendor (reports, balances, invoices). The PLATFORM
// account is giveback itself: with CHECKOUT_MODE=platform, checkout runs as the platform so supporters pay giveback,
// which keeps its fee and settles the vendor through Payouts (see lib/settlements.ts). 'direct' = supporters pay the
// vendor's account straight (the original flow, kept as an instant fallback).
export type Creds = { id: string; secret: string };
export const checkoutMode = (): 'platform' | 'direct' => (process.env.CHECKOUT_MODE === 'platform' ? 'platform' : 'direct');

export function merchantCreds(): Creds {
  const { PAYPAL_CLIENT_ID: id, PAYPAL_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_SECRET must be set (see .env.local)');
  return { id, secret };
}

export function checkoutCreds(): Creds {
  if (checkoutMode() === 'direct') return merchantCreds();
  const { PAYOUT_CLIENT_ID: id, PAYOUT_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYOUT_CLIENT_ID and PAYOUT_CLIENT_SECRET must be set for CHECKOUT_MODE=platform');
  return { id, secret };
}

const tokens = new Map<string, { value: string; expiresAt: number }>();

async function accessToken(creds: Creds = merchantCreds()): Promise<string> {
  const cached = tokens.get(creds.id);
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  const { id, secret } = creds;

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new PayPalApiError(res.status, '/v1/oauth2/token', await res.text());

  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so an in-flight request never carries an expired token.
  tokens.set(creds.id, { value: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 });
  return access_token;
}

async function get<T>(path: string, creds: Creds = merchantCreds()): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${await accessToken(creds)}` },
      cache: 'no-store',
    });
    if (res.ok) return (await res.json()) as T;

    // A revoked or expired token: drop it and mint a new one once.
    if (res.status === 401 && attempt === 1) {
      tokens.delete(creds.id);
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      continue;
    }
    throw new PayPalApiError(res.status, path, await res.text());
  }
}

// `path` must already carry whatever flag makes the endpoint report `total_pages`.
async function listAll<T>(path: string, key: string, pageSize: number): Promise<T[]> {
  const items: T[] = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; ; page++) {
    const res = await get<{ total_pages?: number } & Record<string, unknown>>(
      `${path}${sep}page_size=${pageSize}&page=${page}`,
    );
    items.push(...((res[key] as T[] | undefined) ?? []));
    if (page >= (res.total_pages ?? 1)) return items;
  }
}

export type Money = { value: string; currency_code: string };

// PayPal sends amounts as decimal strings; missing amounts count as 0.
export const amountOf = (m?: Money | null) => (m?.value === undefined ? 0 : Number(m.value));

// --- Catalog products & billing plans ------------------------------------------

export type Product = {
  id: string;
  name: string;
  description?: string;
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  category?: string;
  create_time: string;
};

export type IntervalUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export type BillingCycle = {
  frequency: { interval_unit: IntervalUnit; interval_count: number };
  tenure_type: 'REGULAR' | 'TRIAL';
  sequence: number;
  total_cycles: number;
  pricing_scheme?: { fixed_price?: Money };
};

export type Plan = {
  id: string;
  product_id: string;
  name: string;
  status: 'CREATED' | 'INACTIVE' | 'ACTIVE';
  create_time: string;
  billing_cycles: BillingCycle[];
  payment_preferences?: { setup_fee?: Money };
};

// The list endpoints return summaries (no product type/category, no billing cycles),
// so each record is fetched in full.
export async function listProducts(): Promise<Product[]> {
  const summaries = await listAll<{ id: string }>('/v1/catalogs/products?total_required=true', 'products', 20);
  return Promise.all(summaries.map((p) => get<Product>(`/v1/catalogs/products/${encodeURIComponent(p.id)}`)));
}

export async function listPlans(): Promise<Plan[]> {
  const summaries = await listAll<{ id: string }>('/v1/billing/plans?total_required=true', 'plans', 20);
  return Promise.all(summaries.map((p) => get<Plan>(`/v1/billing/plans/${encodeURIComponent(p.id)}`)));
}

// --- Invoicing -------------------------------------------------------------------

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'SCHEDULED'
  | 'UNPAID'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'MARKED_AS_PAID'
  | 'PARTIALLY_PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'MARKED_AS_REFUNDED'
  | 'CANCELLED';

export type Invoice = {
  id: string;
  status: InvoiceStatus;
  detail: {
    invoice_number: string;
    currency_code: string;
    invoice_date?: string;
    payment_term?: { term_type?: string; due_date?: string };
  };
  primary_recipients?: {
    billing_info?: {
      name?: { full_name?: string };
      business_name?: string;
      email_address?: string;
    };
  }[];
  items?: {
    id?: string;
    name: string;
    quantity: string;
    unit_amount: Money;
    unit_of_measure?: string;
    tax?: { percent?: string; amount?: Money };
    discount?: { percent?: string; amount?: Money };
  }[];
  amount?: Money & { breakdown?: { tax_total?: Money; shipping?: { amount?: Money } } };
  due_amount?: Money;
  payments?: {
    paid_amount?: Money;
    transactions?: { payment_id?: string; payment_date?: string; method?: string; amount: Money }[];
  };
  refunds?: {
    refund_amount?: Money;
    transactions?: { recipient_transaction_id?: string; refund_date?: string; method?: string; amount: Money }[];
  };
};

// The list omits line items, payments and refunds; the detail endpoint has them.
export async function listInvoices(): Promise<Invoice[]> {
  const summaries = await listAll<{ id: string }>('/v2/invoicing/invoices?total_required=true', 'items', 100);
  return Promise.all(summaries.map((i) => get<Invoice>(`/v2/invoicing/invoices/${encodeURIComponent(i.id)}`)));
}

// --- Transaction Search & balances -------------------------------------------------

export type Transaction = {
  transaction_info: {
    transaction_id: string;
    paypal_reference_id?: string;
    transaction_event_code?: string;
    transaction_initiation_date?: string;
    transaction_amount?: Money;
    fee_amount?: Money;
    transaction_status?: string;
    ending_balance?: Money;
    transaction_subject?: string;
    transaction_note?: string;
    custom_field?: string;
  };
  payer_info?: { email_address?: string };
};

// Transaction Search allows ranges of at most 31 days and rejects fractional seconds.
export const TRANSACTION_SEARCH_MAX_DAYS = 31;

export function searchTransactions(start: Date, end: Date): Promise<Transaction[]> {
  const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;
  return listAll<Transaction>(
    `/v1/reporting/transactions?start_date=${iso(start)}&end_date=${iso(end)}&fields=all`,
    'transaction_details',
    500,
  );
}

export type Balances = {
  as_of_time?: string;
  balances?: { currency: string; total_balance?: Money; available_balance?: Money; withheld_balance?: Money }[];
};

export function getBalances(): Promise<Balances> {
  return get<Balances>('/v1/reporting/balances');
}

// --- Orders (checkout) and webhook verification -----------------------------------

async function post<T>(path: string, body: unknown, requestId?: string, creds: Creds = merchantCreds()): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await accessToken(creds)}`,
        'Content-Type': 'application/json',
        // PayPal replays the original result for a repeated request id, so retries never double-charge.
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text(); // some endpoints (invoice send) answer 202 with a small or empty body
      return (text ? JSON.parse(text) : {}) as T;
    }
    if (res.status === 401 && attempt === 1) {
      tokens.delete(creds.id);
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      continue;
    }
    throw new PayPalApiError(res.status, path, await res.text());
  }
}

// --- Creating and sending an invoice (the vendor's merchant account invoices a sponsor) ---

/** Creates a draft invoice and returns its id (PayPal answers with a link ending in the id). */
export async function createInvoiceDraft(input: {
  invoiceNumber: string; currency: string; amountValue: string; itemName: string; note: string; dueDate: string; recipientEmail: string; recipientName: string; requestId: string;
}): Promise<string> {
  const res = await post<{ href?: string; id?: string }>(
    '/v2/invoicing/invoices',
    {
      detail: { invoice_number: input.invoiceNumber, currency_code: input.currency, note: input.note, payment_term: { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: input.dueDate } },
      primary_recipients: [{ billing_info: { business_name: input.recipientName, email_address: input.recipientEmail } }],
      items: [{ name: input.itemName, quantity: '1', unit_amount: { currency_code: input.currency, value: input.amountValue } }],
      configuration: { allow_tip: false },
    },
    input.requestId,
  );
  const id = res.id ?? res.href?.split('/').pop();
  if (!id) throw new Error('PayPal did not return an invoice id');
  return id;
}

/** Sends a draft invoice to the recipient by email. Returns the link PayPal gives for it, if any. */
export async function sendInvoice(id: string, subject: string): Promise<string | null> {
  const res = await post<{ href?: string }>(`/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, { subject, send_to_invoicer: false, send_to_recipient: true });
  return res.href ?? null;
}

export async function getInvoiceById(id: string): Promise<Invoice> {
  return get<Invoice>(`/v2/invoicing/invoices/${encodeURIComponent(id)}`);
}

export type CaptureResult = {
  id: string; // order id
  status: string;
  payer?: { email_address?: string; name?: { given_name?: string; surname?: string }; address?: { country_code?: string } };
  purchase_units?: {
    description?: string;
    custom_id?: string;
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount: Money;
        seller_receivable_breakdown?: { paypal_fee?: Money };
      }[];
    };
  }[];
};

export type OrderLink = { href: string; rel: string; method?: string };

/** Where PayPal sends a supporter after they approve (or cancel) on their own phone. */
export type PhoneCheckout = { returnUrl: string; cancelUrl: string; brandName?: string };

export function createOrder(
  totalDecimal: string,
  currency: string,
  description: string,
  customId: string,
  requestId: string,
  phone?: PhoneCheckout,
) {
  return post<{ id: string; status: string; links?: OrderLink[] }>(
    '/v2/checkout/orders',
    {
      intent: 'CAPTURE',
      purchase_units: [{ description, custom_id: customId, amount: { currency_code: currency, value: totalDecimal } }],
      // With a return URL PayPal gives us a link to open on the supporter's phone (shown as a QR code).
      ...(phone && {
        payment_source: {
          paypal: {
            experience_context: {
              return_url: phone.returnUrl,
              cancel_url: phone.cancelUrl,
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
              ...(phone.brandName && { brand_name: phone.brandName }),
            },
          },
        },
      }),
    },
    requestId,
    checkoutCreds(),
  );
}

/** The link a supporter opens to approve the payment (PayPal calls it payer-action or approve). */
export const approveLink = (links?: OrderLink[]) =>
  links?.find((l) => l.rel === 'payer-action')?.href ?? links?.find((l) => l.rel === 'approve')?.href;

/** The order's current state at PayPal: CREATED until the supporter approves, then APPROVED. */
export function getOrder(orderId: string) {
  return get<{ id: string; status: string }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, checkoutCreds());
}

export function captureOrder(orderId: string) {
  return post<CaptureResult>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, `capture-${orderId}`, checkoutCreds());
}

/** Asks PayPal whether this webhook delivery is genuine (signature check). */
export async function verifyWebhookSignature(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID must be set');
  const res = await post<{ verification_status: string }>('/v1/notifications/verify-webhook-signature', {
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
