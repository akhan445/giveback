import { describe, expect, it } from 'vitest';
import { allow, clientKey } from './rate-limit';

describe('allow', () => {
  it('lets a device start many orders but blocks a flood, per device', () => {
    const t = 1_000_000;
    for (let i = 0; i < 30; i++) expect(allow('a', t + i)).toBe(true);
    expect(allow('a', t + 31)).toBe(false);
    expect(allow('b', t + 31)).toBe(true); // another device is unaffected
  });
  it('forgets attempts after the window', () => {
    const t = 5_000_000;
    for (let i = 0; i < 30; i++) allow('c', t);
    expect(allow('c', t + 1)).toBe(false);
    expect(allow('c', t + 10 * 60_000 + 1)).toBe(true);
  });
});

describe('clientKey', () => {
  it('takes the first forwarded address', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
    expect(clientKey(new Headers())).toBe('local');
  });
});
