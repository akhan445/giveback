import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrgProfile, saveOrgProfile } from '@/lib/history';
import { ORG_TYPE_KEYS, TRADITION_KEYS } from '@/lib/org';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  orgType: z.enum(ORG_TYPE_KEYS),
  tradition: z.enum(TRADITION_KEYS).nullable().optional(),
});

export async function GET() {
  return NextResponse.json(await getOrgProfile());
}

export async function PUT(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid organization' }, { status: 400 });
  await saveOrgProfile({ ...parsed.data, tradition: parsed.data.tradition ?? null });
  return NextResponse.json(await getOrgProfile());
}
