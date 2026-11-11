import { NextResponse } from 'next/server';
import { captureAndRecord } from '@/lib/capture';
import { getOrder } from '@/lib/paypal';
import { findPaidOrder, type PaidOrder } from '@/lib/payments';

export const dynamic = 'force-dynamic';

// The counter polls this while a supporter pays on their phone. Unpaid until the payment is recorded.
// If the supporter has approved the order but nothing has captured it yet (their phone did not make it
// back to /pay/return, or the webhook is slow), the counter's poll captures it, so the sale never gets lost.
// Capturing twice is safe: PayPal replays the result for the same request id and the payment is stored once.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let paid: PaidOrder | null = await findPaidOrder(id);
  if (!paid) {
    try {
      if ((await getOrder(id)).status === 'APPROVED') {
        const c = await captureAndRecord(id);
        if (c.status === 'COMPLETED') paid = { amountCents: c.amountCents, currency: c.currency, payerFirstName: c.payerFirstName, anonymous: c.anonymous };
      }
    } catch {
      // Not approved yet, or PayPal is briefly unavailable: report unpaid and let the next poll try again.
    }
  }
  return NextResponse.json(paid ? { paid: true, ...paid } : { paid: false }, { headers: { 'cache-control': 'no-store' } });
}
