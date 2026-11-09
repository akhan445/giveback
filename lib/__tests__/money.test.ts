import { describe, expect, it } from 'vitest';
import { centsToDecimal, decimalToCents } from '../money';

describe('money', () => {
  it('formats cents as a decimal string', () => {
    expect(centsToDecimal(0)).toBe('0.00');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(centsToDecimal(1234)).toBe('12.34');
  });
  it('parses decimal strings without float error', () => {
    expect(decimalToCents('12.34')).toBe(1234);
    expect(decimalToCents('0.1')).toBe(10);
    expect(decimalToCents('19.99')).toBe(1999);
    expect(decimalToCents('5')).toBe(500);
  });
  it('rejects junk', () => {
    expect(() => decimalToCents('-1')).toThrow();
    expect(() => decimalToCents('1.234')).toThrow();
    expect(() => centsToDecimal(1.5)).toThrow();
  });
});
