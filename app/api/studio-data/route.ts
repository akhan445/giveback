import { NextResponse } from 'next/server';
import { getStudioData } from '@/lib/studio-data';

export const dynamic = 'force-dynamic';

// Fresh report data, polled by the dashboard so the live display and widgets update on their own.
export async function GET() {
  return NextResponse.json(await getStudioData(), { headers: { 'cache-control': 'no-store' } });
}
