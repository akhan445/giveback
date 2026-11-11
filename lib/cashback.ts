// Volume cashback. Integer cents everywhere, all in ONE currency (the organization's).
// SANDBOX: the cashback is simulated. In a real launch it would be funded by pooled-volume
// pricing and a sponsor pool. Tier rates are configurable here.

export interface Tier {
  name: string;
  /** Volume (cents) at which this tier starts, inclusive. */
  fromCents: number;
  /** Cashback rate in basis points (50 = 0.50%) applied to the month's whole volume. */
  rateBp: number;
}

export const TIERS: readonly Tier[] = [
  { name: 'Starter', fromCents: 0, rateBp: 50 },
  { name: 'Builder', fromCents: 1_000_000, rateBp: 75 }, // $10,000
  { name: 'Champion', fromCents: 5_000_000, rateBp: 100 }, // $50,000
];

/** Bonus for lots of small transactions: +0.05% once a month reaches 200 transactions. */
export const COUNT_BONUS = { minTransactions: 200, rateBp: 5 } as const;

export interface CashbackResult {
  tier: Tier;
  rateBp: number;
  bonusBp: number;
  cashbackCents: number;
}

export interface TierProgress {
  current: Tier;
  next: Tier | null;
  /** Volume still needed to reach `next`; 0 when already on the top tier. */
  toNextCents: number;
  /** Extra cashback per month if the whole month's volume were at the next tier's rate. */
  nextGainCents: number;
  /** 0..1 share of the way from the current tier's start to the next tier's start. */
  fraction: number;
}

export function tierFor(volumeCents: number): Tier {
  let tier = TIERS[0];
  for (const t of TIERS) if (volumeCents >= t.fromCents) tier = t;
  return tier;
}

export function computeCashback(volumeCents: number, transactionCount: number): CashbackResult {
  if (!Number.isInteger(volumeCents) || volumeCents < 0) throw new Error('volumeCents must be a non-negative integer');
  const tier = tierFor(volumeCents);
  const bonusBp = transactionCount >= COUNT_BONUS.minTransactions ? COUNT_BONUS.rateBp : 0;
  const rateBp = tier.rateBp + bonusBp;
  return { tier, rateBp, bonusBp, cashbackCents: Math.round((volumeCents * rateBp) / 10_000) };
}

export function tierProgress(volumeCents: number, transactionCount: number): TierProgress {
  const current = tierFor(volumeCents);
  const next = TIERS.find((t) => t.fromCents > current.fromCents) ?? null;
  if (!next) return { current, next, toNextCents: 0, nextGainCents: 0, fraction: 1 };
  const bonus = transactionCount >= COUNT_BONUS.minTransactions ? COUNT_BONUS.rateBp : 0;
  // What the month pays if it ends exactly at the next tier's start vs. what it pays now.
  const atNext = Math.round((next.fromCents * (next.rateBp + bonus)) / 10_000);
  const now = computeCashback(volumeCents, transactionCount).cashbackCents;
  return {
    current,
    next,
    toNextCents: next.fromCents - volumeCents,
    nextGainCents: Math.max(0, atNext - now),
    fraction: (volumeCents - current.fromCents) / (next.fromCents - current.fromCents),
  };
}

/** Effective fee rate after cashback, in basis points of volume: (fees kept by PayPal - fees covered - cashback) / volume. */
export function effectiveFeeBp(volumeCents: number, feeCents: number, feeCoveredCents: number, cashbackCents: number): number {
  if (volumeCents <= 0) return 0;
  return ((feeCents - feeCoveredCents - cashbackCents) / volumeCents) * 10_000;
}
