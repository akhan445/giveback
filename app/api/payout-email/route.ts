import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getRecipientEmail } from '@/lib/payouts';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ email: await getRecipientEmail() });
}

export async function PUT(req: Request) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(120).nullable() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  await db().query('UPDATE org_settings SET payout_email = $1, updated_at = now() WHERE id = 1', [parsed.data.email]);
  return NextResponse.json({ email: await getRecipientEmail() });
}
