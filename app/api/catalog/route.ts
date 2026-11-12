import { NextResponse } from 'next/server';
import { z } from 'zod';
import { itemSchema } from '@/lib/catalog';
import { addItem, getCounterTitle, listCatalog, setCounterTitle } from '@/lib/catalog-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [items, title] = await Promise.all([listCatalog(), getCounterTitle()]);
  return NextResponse.json({ items, title });
}

export async function POST(req: Request) {
  const parsed = itemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid item' }, { status: 400 });
  if ((await listCatalog()).length >= 40) return NextResponse.json({ error: 'Too many items (40 max)' }, { status: 400 });
  return NextResponse.json(await addItem(parsed.data.name, parsed.data.priceCents));
}

export async function PUT(req: Request) {
  const parsed = z.object({ title: z.string().trim().min(1).max(60) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid title' }, { status: 400 });
  await setCounterTitle(parsed.data.title);
  return NextResponse.json({ title: parsed.data.title });
}
