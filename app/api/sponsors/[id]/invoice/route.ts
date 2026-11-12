import { NextResponse } from 'next/server';
import { allow, clientKey } from '@/lib/rate-limit';
import { InvoiceError, sendSponsorInvoice } from '@/lib/sponsors';

export const dynamic = 'force-dynamic';

// The director's Confirm click. The amount is the sponsor's stored pledge: nothing from the request body is trusted.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'invalid sponsor' }, { status: 400 });
  if (!allow(`invoice:${clientKey(req.headers)}`, Date.now(), 10)) return NextResponse.json({ error: 'Too many attempts. Wait a few minutes.' }, { status: 429 });
  try {
    const sponsor = await sendSponsorInvoice(id);
    return NextResponse.json({ sponsor });
  } catch (e) {
    if (e instanceof InvoiceError) return NextResponse.json({ error: e.message }, { status: e.code === 'not_found' ? 404 : e.code === 'already_invoiced' ? 409 : 502 });
    console.error('[sponsor invoice]', e);
    return NextResponse.json({ error: 'Could not send the invoice.' }, { status: 500 });
  }
}
