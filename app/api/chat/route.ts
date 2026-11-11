import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiModels, openAiKey } from '@/lib/ai';
import { runTool, TOOL_DEFINITIONS } from '@/lib/chat-tools';
import { getOverview } from '@/lib/overview';
import { ORG_TYPES } from '@/lib/org';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(2000) })).min(1).max(30),
});
const MAX_STEPS = 5;
type OutputItem = { type: string; name?: string; arguments?: string; call_id?: string; content?: { type: string; text?: string }[] };

export async function POST(req: Request) {
  const key = openAiKey();
  if (!key) return NextResponse.json({ error: 'The assistant is not configured: set AG_STUDIO_OPENAI_API_KEY.' }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== 'user') return NextResponse.json({ error: 'invalid request' }, { status: 400 });

  const today = new Date();
  const ov = await getOverview(today);
  const instructions = [
    `You are giveback's assistant for ${ov.org.name}, a ${ORG_TYPES[ov.org.orgType]}${ov.org.tradition ? ` (${ov.org.tradition} tradition)` : ''}. Today is ${today.toISOString().slice(0, 10)}. Money is in ${ov.currency}.`,
    'Answer with the tools: every figure must come from a tool result, never from memory or guesses. If a tool has no data for the question, say so.',
    'Be brief: a direct answer first, then at most two supporting facts. Plain text, no markdown tables. Round to whole dollars in prose.',
    'Only suggest campaigns and ideas that fit this organization type and its own history. Never suggest something from a different kind of organization.',
    'You cannot move money or send anything. If the user wants an invoice or a reserve plan, say you can propose it and they will be asked to confirm before anything happens.',
    'The cashback and pricing advantage are simulated in this sandbox; mention that only if asked.',
  ].join('\n');

  const model = aiModels()[0];
  const call = async (payload: Record<string, unknown>) => {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, instructions, tools: TOOL_DEFINITIONS, max_output_tokens: 4000, ...payload }), signal: req.signal,
    });
    if (!r.ok) throw new Error(`model error ${r.status}`);
    return (await r.json()) as { id: string; output: OutputItem[] };
  };

  try {
    let res = await call({ input: parsed.data.messages.map((m) => ({ role: m.role, content: m.text })) });
    for (let step = 0; step < MAX_STEPS; step++) {
      const calls = res.output.filter((o) => o.type === 'function_call');
      if (!calls.length) break;
      const outputs = calls.map((c) => {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(c.arguments ?? '{}'); } catch { /* bad arguments: the tool reports it */ }
        return { type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(runTool(c.name ?? '', args, ov, today)) };
      });
      res = await call({ previous_response_id: res.id, input: outputs });
    }
    const reply = res.output.filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).map((c) => c.text ?? '').join('').trim();
    return NextResponse.json({ reply: reply || 'I could not put together an answer. Try rephrasing.' });
  } catch (e) {
    console.error('[chat]', e);
    return NextResponse.json({ error: 'The assistant is unavailable right now. Try again in a moment.' }, { status: 502 });
  }
}
