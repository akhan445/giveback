import { NextResponse } from 'next/server';
import { saveSummary } from '@/lib/ai-store';
import { AssistantUnavailable, runAssistant } from '@/lib/assistant';
import { allow, clientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Writes a fresh summary from the organization's own data and saves it for the dashboard.
export async function POST(req: Request) {
  if (!allow(`summary:${clientKey(req.headers)}`, Date.now(), 10, 10 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  try {
    const { reply } = await runAssistant([{ role: 'user', text: 'Write the dashboard summary.' }], { signal: req.signal, summaryMode: true });
    if (!reply) return NextResponse.json({ error: 'Could not write a summary. Try again.' }, { status: 502 });
    return NextResponse.json({ summary: await saveSummary(reply) });
  } catch (e) {
    if (e instanceof AssistantUnavailable) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error('[summary]', e);
    return NextResponse.json({ error: 'The assistant is unavailable right now. Try again in a moment.' }, { status: 502 });
  }
}
