import { describe, expect, it } from 'vitest';
import { estimateTokens, waitMs } from './ai-throttle';

describe('waitMs', () => {
  const h = [{ at: 0, tokens: 30_000 }, { at: 10_000, tokens: 25_000 }];
  it('lets a request through when it fits the budget', () => {
    expect(waitMs(h, 4_000, 20_000, 60_000)).toBe(0);
  });
  it('waits for the oldest spend to leave the window', () => {
    // 55k used; a 12k request needs 7k freed: the 30k spend at t=0 expires at t=60k
    expect(waitMs(h, 12_000, 20_000, 60_000)).toBe(40_000);
  });
  it('ignores spends older than a minute and lets oversized requests through', () => {
    expect(waitMs(h, 40_000, 90_000, 60_000)).toBe(0);
    expect(waitMs([], 100_000, 0, 60_000)).toBe(0);
  });
});

describe('estimateTokens', () => {
  it('scales with the body size', () => {
    expect(estimateTokens(35_000)).toBe(11_500);
  });
});
