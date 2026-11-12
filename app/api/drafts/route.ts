import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteDraft, saveDraft } from '@/lib/ai-store';
import { AssistantUnavailable, runAssistant } from '@/lib/assistant';
import { allow, clientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const saveSchema = z.object({
  cardId: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(4000) })).min(2).max(30),
});

// Saves the conversation about one opportunity as a short summary on its card (a working draft).
export async function POST(req: Request) {
  if (!allow(`draft:${clientKey(req.headers)}`, Date.now(), 15, 10 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  const { cardId, title, messages } = parsed.data;
  try {
    const turns = [...messages, { role: 'user' as const, text: 'Summarize this as my working draft.' }];
    const { reply } = await runAssistant(turns, { signal: req.signal, draftTitle: title });
    if (!reply) return NextResponse.json({ error: 'Could not write the summary. Try again.' }, { status: 502 });
    return NextResponse.json({ draft: await saveDraft(cardId, title, reply) });
  } catch (e) {
    if (e instanceof AssistantUnavailable) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error('[draft]', e);
    return NextResponse.json({ error: 'The assistant is unavailable right now. Try again in a moment.' }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const cardId = new URL(req.url).searchParams.get('cardId');
  if (!cardId || cardId.length > 100) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  await deleteDraft(cardId);
  return NextResponse.json({ ok: true });
}
