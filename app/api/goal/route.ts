import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGoal, saveGoal } from '@/lib/history';
import { CELL_KEYS, HERO_KEYS } from '@/lib/impact';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  goalCents: z.number().int().min(100).max(10_000_000_000),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  // null = use the defaults for the organization type
  impact: z
    .object({
      hero: z.enum(HERO_KEYS),
      cell: z.enum(CELL_KEYS),
      unit: z.string().trim().min(1).max(30),
      done: z.string().trim().min(1).max(40),
      unitCents: z.number().int().min(1).max(100_000_000),
    })
    .nullable(),
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
