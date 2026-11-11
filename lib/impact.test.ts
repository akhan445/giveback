import { describe, expect, it } from 'vitest';
import { parseImpact, resolveImpact, unitsFor } from './impact';

describe('resolveImpact', () => {
  it('uses the defaults for the organization type', () => {
    expect(resolveImpact('food_bank', null)).toMatchObject({ hero: 'pot', cell: 'plate', done: 'meals served', unitCents: 200 });
    expect(resolveImpact('environment', null)).toMatchObject({ hero: 'drop', cell: 'tree' });
  });
  it('lets the organization override any part and ignores junk', () => {
    const r = resolveImpact('food_bank', { hero: 'loaf', unit: ' hampers ', done: '', unitCents: -5, cell: 'nope' as never });
    expect(r).toMatchObject({ hero: 'loaf', cell: 'plate', unit: 'hampers', done: 'meals served', unitCents: 200 });
  });
});

describe('unitsFor', () => {
  it('counts whole units', () => {
    expect(unitsFor(5680, resolveImpact('food_bank', null))).toBe(2840);
    expect(unitsFor(5, resolveImpact('animal', null))).toBe(0);
  });
});

describe('parseImpact', () => {
  it('survives bad input', () => {
    expect(parseImpact('not json').unitCents).toBeGreaterThan(0);
    expect(parseImpact(JSON.stringify({ hero: 'bag', unitCents: 150 }))).toMatchObject({ hero: 'bag', unitCents: 150 });
  });
});
