import { describe, expect, it } from 'vitest';
import { splitPayment } from '../fees';
import { priceOrder } from '../catalog';

describe('priceOrder', () => {
  it('prices from server data, summing items and donation', () => {
    const o = priceOrder({ items: [{ id: 'cookie', qty: 2 }, { id: 'coffee', qty: 1 }], donationCents: 500 });
    expect(o.totalCents).toBe(2 * 1200 + 350 + 500);
    expect(o.kind).toBe('sale');
  });
  it('treats donation-only orders as donations', () => {
    expect(priceOrder({ items: [], donationCents: 2500 }).kind).toBe('donation');
  });
  it('rejects unknown items and empty orders', () => {
    expect(() => priceOrder({ items: [{ id: 'nope', qty: 1 }] })).toThrow(/unknown/);
    expect(() => priceOrder({ items: [] })).toThrow(/empty/);
  });
});

describe('priceOrder currencies', () => {
  it('defaults to USD and converts item prices server-side', () => {
    expect(priceOrder({ items: [{ id: 'coffee', qty: 1 }] }).currency).toBe('USD');
    const cad = priceOrder({ items: [{ id: 'coffee', qty: 2 }], currency: 'CAD' });
    expect(cad.currency).toBe('CAD');
    expect(cad.totalCents).toBe(2 * 485); // 350 * 1.38 = 483 -> nearest 5
  });
  it('takes donations as-is in the chosen currency', () => {
    expect(priceOrder({ items: [], donationCents: 1000, currency: 'EUR' }).totalCents).toBe(1000);
  });
});

describe('cover fees', () => {
  it('adds a server-computed add-on that covers PayPal fee on the whole payment', () => {
    const o = priceOrder({ items: [{ id: 'cookie', qty: 1 }], coverFees: true }); // $12.00
    expect(o.totalCents).toBe(1200 + o.feeCoverCents);
    // the organization nets at least the full $12.00 after PayPal's fee, the payout fee and giveback's fee on the new total
    const paypal = Math.round((o.totalCents * 289) / 10000) + 30;
    expect(splitPayment(o.totalCents, paypal, 'USD').vendorShare).toBeGreaterThanOrEqual(1200);
    expect(o.description).toContain('Admin fees');
  });
  it('adds nothing when off', () => {
    expect(priceOrder({ items: [{ id: 'cookie', qty: 1 }] }).feeCoverCents).toBe(0);
  });
  it('round-trips the order tag', async () => {
    const { feeCoverTag, parseFeeCoverTag } = await import('../fees');
    expect(parseFeeCoverTag(feeCoverTag(87))).toBe(87);
    expect(parseFeeCoverTag('something-else')).toBe(0);
    expect(parseFeeCoverTag(undefined)).toBe(0);
    const { parseOrderTag } = await import('../fees');
    expect(parseOrderTag(feeCoverTag(87, true))).toEqual({ feeCoverCents: 87, anonymous: true });
    expect(parseOrderTag(feeCoverTag(0))).toEqual({ feeCoverCents: 0, anonymous: false });
    expect(parseOrderTag('fee_cover:87')).toEqual({ feeCoverCents: 87, anonymous: false });
  });
});
