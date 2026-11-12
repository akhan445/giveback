import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clearChat, listChat, saveChatTurn } from '@/lib/ai-store';
import { AssistantUnavailable, runAssistant } from '@/lib/assistant';
import { allow, clientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(4000) })).min(1).max(30),
});

/** The saved conversation, so the director can leave and come back. */
export async function GET() {
  return NextResponse.json({ messages: await listChat().catch(() => []) });
}

export async function DELETE() {
  await clearChat();
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!allow(`chat:${clientKey(req.headers)}`, Date.now(), 30, 10 * 60_000)) return NextResponse.json({ error: 'Too many questions. Try again in a few minutes.' }, { status: 429 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== 'user') return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  try {
    const { reply, proposals } = await runAssistant(parsed.data.messages, { signal: req.signal });
    const text = reply || 'I could not put together an answer. Try rephrasing.';
    await saveChatTurn(parsed.data.messages.at(-1)!.text, text, proposals).catch((e) => console.error('[chat save]', e));
    return NextResponse.json({ reply: text, ...(proposals.length ? { proposals } : {}) });
  } catch (e) {
    if (e instanceof AssistantUnavailable) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error('[chat]', e);
    return NextResponse.json({ error: 'The assistant is unavailable right now. Try again in a moment.' }, { status: 502 });
  }
}
