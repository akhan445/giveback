import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PayPalApiError } from '@/lib/paypal';
import { allow, clientKey } from '@/lib/rate-limit';
import { PayoutBlockedError, getCashbackAccount, requestPayout } from '@/lib/payouts';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getCashbackAccount());
}

// The client only says WHICH payout to run; the amount, recipient and eligibility are decided on the server.
// 'year_end' is the sandbox "Simulate year-end" button (in production the Dec 31 cron runs it).
const schema = z.object({ trigger: z.enum(['manual', 'year_end']) });

export async function POST(req: Request) {
  if (!allow(`payout:${clientKey(req.headers)}`, Date.now(), 10, 10 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  try {
    return NextResponse.json({ payout: await requestPayout(parsed.data.trigger) });
  } catch (e) {
    if (e instanceof PayoutBlockedError) return NextResponse.json({ error: 'not allowed', reason: e.check.reason }, { status: 409 });
    if (e instanceof PayPalApiError) {
      console.error('payout failed', e.message);
      return NextResponse.json({ error: 'PayPal could not send the payout. Check that the giveback platform account has funds.' }, { status: 502 });
    }
    throw e;
  }
}
