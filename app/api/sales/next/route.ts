import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// The number printed at the top of the next receipt: how many payments exist, plus one.
export async function GET() {
  const { rows } = await db().query('SELECT COUNT(*)::int AS n FROM payments');
  return NextResponse.json({ number: (rows[0]?.n ?? 0) + 1 }, { headers: { 'Cache-Control': 'no-store' } });
}
