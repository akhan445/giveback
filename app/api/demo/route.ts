import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resetDemo, simulateMonth } from '@/lib/demo';
import { allow, clientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({ action: z.enum(['simulate_month', 'reset']) });

// Sandbox demo controls. Neither touches PayPal; the client only names the action.
export async function POST(req: Request) {
  if (!allow(`demo:${clientKey(req.headers)}`, Date.now(), 10, 10 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  try {
    if (parsed.data.action === 'reset') await resetDemo();
    else await simulateMonth();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[demo]', e);
    return NextResponse.json({ error: 'Could not complete that.' }, { status: 500 });
  }
}
