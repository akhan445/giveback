import { describe, expect, it } from 'vitest';
import { computeCashback, effectiveFeeBp, tierFor, tierProgress } from '../cashback';

describe('cashback tiers', () => {
  it('picks the tier by monthly volume', () => {
    expect(tierFor(0).name).toBe('Starter');
    expect(tierFor(999_999).name).toBe('Starter');
    expect(tierFor(1_000_000).name).toBe('Builder');
    expect(tierFor(5_000_000).name).toBe('Champion');
  });

  it('pays the tier rate on the whole volume', () => {
    expect(computeCashback(800_000, 50).cashbackCents).toBe(4_000); // $8,000 * 0.5%
    expect(computeCashback(2_000_000, 50).cashbackCents).toBe(15_000); // $20,000 * 0.75%
  });

  it('adds the transaction-count bonus', () => {
    const r = computeCashback(800_000, 200);
    expect(r.rateBp).toBe(55);
    expect(r.cashbackCents).toBe(4_400);
  });

  it('rejects non-integer or negative volume', () => {
    expect(() => computeCashback(10.5, 1)).toThrow();
    expect(() => computeCashback(-1, 1)).toThrow();
  });

  it('says what the next tier is worth', () => {
    const p = tierProgress(740_000, 50); // $7,400
    expect(p.next?.name).toBe('Builder');
    expect(p.toNextCents).toBe(260_000);
    expect(p.nextGainCents).toBe(7_500 - 3_700); // $75 at the threshold vs $37 now
    expect(tierProgress(6_000_000, 0).next).toBeNull();
  });

  it('computes the effective fee rate after cashback', () => {
    // $10,000 volume, $329 fee, $100 covered by supporters, $50 cashback -> 1.79%
    expect(effectiveFeeBp(1_000_000, 32_900, 10_000, 5_000)).toBeCloseTo(179);
    expect(effectiveFeeBp(0, 0, 0, 0)).toBe(0);
  });
});
