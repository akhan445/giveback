import { NextResponse } from 'next/server';
import { captureAndRecord } from '@/lib/capture';

// Captures the approved order and records the payment (see lib/capture.ts).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const c = await captureAndRecord(id);
    return NextResponse.json({ status: c.status, captureId: c.captureId, payerFirstName: c.payerFirstName });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
