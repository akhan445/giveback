import { NextResponse } from 'next/server';
import { PayoutBlockedError, requestPayout } from '@/lib/payouts';

export const dynamic = 'force-dynamic';

// Vercel Cron calls this on Dec 31 (see vercel.json) and sends `Authorization: Bearer $CRON_SECRET`.
// It sweeps whatever cashback is still unpaid for the year into one payout.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const payout = await requestPayout('year_end');
    return NextResponse.json({ result: 'paid', payoutId: payout.id });
  } catch (e) {
    if (e instanceof PayoutBlockedError) return NextResponse.json({ result: 'skipped', reason: e.check.reason });
    throw e;
  }
}
