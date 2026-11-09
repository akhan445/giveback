import { describe, expect, it } from 'vitest';
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
