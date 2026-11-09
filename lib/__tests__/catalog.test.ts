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
