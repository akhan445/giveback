import { NextResponse } from 'next/server';
import { deleteItem, updateItem } from '@/lib/catalog-store';
import { itemSchema } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = itemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid item' }, { status: 400 });
  if (!(await updateItem(id, parsed.data.name, parsed.data.priceCents))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ id, ...parsed.data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await deleteItem((await ctx.params).id);
  return NextResponse.json({ ok: true });
}
