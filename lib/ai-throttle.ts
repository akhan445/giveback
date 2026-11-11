// Paces requests to OpenAI so a burst from the Studio agent (it makes several large calls per question)
// waits for the per-minute token budget instead of failing with rate_limit_exceeded. In-memory, so it
// is per server instance: enough for a demo, not a substitute for a higher quota.

const WINDOW_MS = 60_000;

type Spend = { at: number; tokens: number };

/** Rough token count for a request body (about 3.5 characters per token) plus room for the reply. */
export const estimateTokens = (bodyChars: number, replyReserve = 1500) => Math.ceil(bodyChars / 3.5) + replyReserve;

/** How long to wait before spending `tokens` without going over `budget` in any rolling minute. */
export function waitMs(history: Spend[], tokens: number, now: number, budget: number): number {
  const live = history.filter((s) => now - s.at < WINDOW_MS).sort((a, b) => a.at - b.at);
  let used = live.reduce((t, s) => t + s.tokens, 0);
  if (used + tokens <= budget) return 0;
  for (const s of live) {
    used -= s.tokens;
    if (used + tokens <= budget) return Math.max(0, s.at + WINDOW_MS - now);
  }
  return 0; // a single request bigger than the whole budget: let it through
}

const spent: Spend[] = [];
const MAX_WAIT_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits (up to 30 s) until the budget allows `tokens`, then records the spend. */
export async function throttle(tokens: number, budget: number, signal?: AbortSignal): Promise<void> {
  const started = Date.now();
  for (;;) {
    const now = Date.now();
    const w = waitMs(spent, tokens, now, budget);
    if (w <= 0 || now - started + w > MAX_WAIT_MS || signal?.aborted) break;
    await sleep(Math.min(w, 5_000));
  }
  const now = Date.now();
  spent.push({ at: now, tokens });
  while (spent.length && now - spent[0].at >= WINDOW_MS) spent.shift();
}
