// A small in-memory limit on how often one device may start a PayPal order, to stop bots flooding the
// server. It never limits how many donations a real person can make: the default allows 30 new orders
// per 10 minutes per device. Per server instance, which is enough for a demo.

const hits = new Map<string, number[]>();

/** Records an attempt and says whether it is allowed. */
export function allow(key: string, now = Date.now(), max = 30, windowMs = 10 * 60_000): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}

/** The caller's address as seen behind Vercel's proxy (first entry of x-forwarded-for). */
export const clientKey = (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
