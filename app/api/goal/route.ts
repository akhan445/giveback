import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGoal, saveGoal } from '@/lib/history';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  goalCents: z.number().int().min(100).max(10_000_000_000),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function GET() {
  return NextResponse.json(await getGoal());
}

export async function PUT(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid goal' }, { status: 400 });
  await saveGoal(parsed.data);
  return NextResponse.json(await getGoal());
}
