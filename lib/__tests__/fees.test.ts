import { describe, expect, it } from 'vitest';
import { convertUsdCents } from '../currency';
import { feeCoverCents, payoutFeeCents, platformFeeCents, splitPayment, vendorShareCents } from '../fees';

describe('admin fee = PayPal + giveback', () => {
  it("giveback's fee is 1.25% + $0.10 (fixed part converted per currency)", () => {
    expect(platformFeeCents(5_000, 'USD')).toBe(63 + 10); // 62.5 rounds to 63
    expect(platformFeeCents(5_000, 'CAD')).toBe(63 + 15);
    expect(platformFeeCents(0, 'USD')).toBe(0);
  });

  it('matches the worked example: $10,000 in 200 payments of $50', () => {
    const paypal = 200 * (Math.round((5_000 * 289) / 10_000) + 30); // 2.89% + $0.30 each
    const giveback = 200 * platformFeeCents(5_000, 'USD');
    expect(paypal).toBe(200 * (145 + 30)); // $350 (the doc rounds to $349)
    expect(giveback).toBe(200 * 73); // about $146
  });

  it('the vendor gets payment minus both fees, never below zero', () => {
    const amount = 5_000;
    expect(vendorShareCents(amount, 175, platformFeeCents(amount, 'USD'))).toBe(5_000 - 175 - 73);
    expect(vendorShareCents(100, 175, 73)).toBe(0);
  });

  it('payout fee is 2% on top of the payout, capped', () => {
    // sandbox observation: a 32.41 CAD payout cost 0.65, so the platform needed 33.06 on hand
    expect(payoutFeeCents(3_306, 'CAD')).toBe(65);
    expect(payoutFeeCents(0, 'USD')).toBe(0);
    expect(payoutFeeCents(1_000_000, 'USD')).toBe(100); // capped at $1
    expect(payoutFeeCents(1_000_000, 'CAD')).toBe(125); // capped at CAD 1.25
  });

  it('splitPayment bundles the payout fee with the PayPal fee and the money adds up', () => {
    const s = splitPayment(5_000, 175, 'USD');
    expect(s.platformFee).toBe(73);
    expect(s.paypalLump).toBe(175 + s.payoutFee);
    expect(s.paypalLump + s.platformFee + s.vendorShare).toBe(5_000);
    // the platform keeps exactly its own fee after paying the vendor and PayPal's payout fee
    expect(5_000 - 175 - (s.vendorShare + s.payoutFee)).toBe(s.platformFee);
  });

  it('cover-the-fee makes the vendor net at least the intended total, below and above the payout cap', () => {
    for (const cur of ['USD', 'CAD'] as const) {
      for (const total of [500, 1_200, 5_000, 25_000, 400_000]) {
        const gross = total + feeCoverCents(total, cur);
        const paypal = Math.round((gross * 289) / 10_000) + convertUsdCents(30, cur);
        expect(splitPayment(gross, paypal, cur).vendorShare).toBeGreaterThanOrEqual(total - 1);
      }
    }
  });
});
