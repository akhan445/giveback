// The "Ask giveback" assistant: a read-only analyst over the organization's own data. It answers with tools (every figure
// comes from a query), can PREPARE a sponsor invoice (the director confirms), and cannot change anything itself.
import { aiModels, openAiKey } from './ai';
import { paymentBreakdown } from './analysis';
import { latestSummary, listDrafts } from './ai-store';
import { runTool, TOOL_DEFINITIONS, type InvoiceProposal } from './chat-tools';
import { ORG_TYPES } from './org';
import { getOverview } from './overview';
import { listSponsors } from './sponsors';

type OutputItem = { type: string; name?: string; arguments?: string; call_id?: string; content?: { type: string; text?: string }[] };
export type ChatMessage = { role: 'user' | 'assistant'; text: string };
const MAX_STEPS = 5;

export class AssistantUnavailable extends Error {}

export async function runAssistant(messages: ChatMessage[], opts: { signal?: AbortSignal; summaryMode?: boolean; draftTitle?: string } = {}): Promise<{ reply: string; proposals: InvoiceProposal[] }> {
  const key = openAiKey();
  if (!key) throw new AssistantUnavailable('The assistant is not configured: set AG_STUDIO_OPENAI_API_KEY.');
  const today = new Date();
  const [ov, sponsors, saved, drafts] = await Promise.all([getOverview(today), listSponsors().catch(() => []), latestSummary().catch(() => null), listDrafts().catch(() => [])]);
  const proposals: InvoiceProposal[] = [];
  const instructions = [
    `You are giveback's analyst for ${ov.org.name}, a ${ORG_TYPES[ov.org.orgType]}${ov.org.tradition ? ` (${ov.org.tradition} tradition)` : ''}. Today is ${today.toISOString().slice(0, 10)}. Money is in ${ov.currency}.`,
    'Your job is to help the director understand their money: explain trends, compare months, spot what is unusual, say why cash is short or strong, and suggest next steps. Discuss details when asked and dig deeper on follow-ups.',
    'Answer with the tools: every figure must come from a tool result, never from memory or guesses. If a tool has no data for the question, say so. Do not invent numbers for scenarios the tools did not compute; if you estimate, label it an estimate and show the arithmetic.',
    'Be brief: a direct answer first, then at most three supporting facts. Plain text, no markdown tables, no markdown bold. Round to whole dollars in prose.',
    'Only suggest campaigns and ideas that fit this organization type and its own history.',
    'You can only read data and write analysis. You cannot create, save, edit or schedule anything. The conversation and the dashboard summary are saved automatically, but you never change plans, settings or campaigns: if asked, say you can write the plan as text and the director applies it. Never claim you created or changed something.',
    'To invoice a sponsor, call propose_sponsor_invoice: it only prepares a card the director must confirm. After it, say the invoice is prepared below and needs their Confirm click; never say it was sent. When money is short (for example rent), check get_sponsor_pledges and when you recommend invoicing a pledge that is not yet invoiced, ALSO call propose_sponsor_invoice for it in the same turn.',
    'The cashback and pricing advantage are simulated in this sandbox; mention that only if asked.',
    ...(opts.summaryMode ? ['Write the dashboard summary now: 4 to 6 short lines, plain text, each starting with a dash. Cover where this month stands (raised, cashback tier, effective fee rate), what is coming up, sponsor money still owed, and one thing to watch. Use the tools first. No greeting, no questions.'] : []),
    ...(opts.draftTitle ? [`Write the working-draft summary for "${opts.draftTitle}" from the conversation so far: what was decided, the key numbers that came from the tools, and the next steps. 4 to 7 short lines, each starting with a dash, plain text. If nothing was decided yet, say what is still open. No greeting, no questions.`] : []),
    ...(drafts.length && !opts.summaryMode && !opts.draftTitle ? [`Working drafts the director saved earlier (continue from these when they reopen one):\n${drafts.map((d) => `- ${d.title}\n${d.summary}`).join('\n')}`] : []),
    ...(saved && !opts.summaryMode && !opts.draftTitle ? [`The saved dashboard summary the director is looking at (from ${saved.createdAt.slice(0, 10)}):\n${saved.body}`] : []),
  ].join('\n');

  const model = aiModels()[0];
  const call = async (payload: Record<string, unknown>) => {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, instructions, tools: TOOL_DEFINITIONS, max_output_tokens: 4000, ...payload }), signal: opts.signal,
    });
    if (!r.ok) throw new Error(`model error ${r.status}`);
    return (await r.json()) as { id: string; output: OutputItem[] };
  };

  let res = await call({ input: messages.map((m) => ({ role: m.role, content: m.text })) });
  for (let step = 0; step < MAX_STEPS; step++) {
    const calls = res.output.filter((o) => o.type === 'function_call');
    if (!calls.length) break;
    const outputs = await Promise.all(calls.map(async (c) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.arguments ?? '{}'); } catch { /* bad arguments: the tool reports it */ }
      const out = c.name === 'get_payment_breakdown' ? await paymentBreakdown(Number(args.days)) : runTool(c.name ?? '', args, ov, today, sponsors);
      const prop = (out as { proposal?: InvoiceProposal }).proposal;
      if (prop && !opts.summaryMode && !opts.draftTitle && !proposals.some((p) => p.sponsorId === prop.sponsorId)) proposals.push(prop);
      return { type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(out) };
    }));
    res = await call({ previous_response_id: res.id, input: outputs });
  }
  const reply = res.output.filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).map((c) => c.text ?? '').join('').trim();
  return { reply, proposals };
}
