import { describe, expect, it } from 'vitest';
import { approveLink } from './paypal';

describe('approveLink', () => {
  it('prefers the payer-action link, falls back to approve, and returns undefined without links', () => {
    const links = [
      { rel: 'self', href: 'https://x/self' },
      { rel: 'approve', href: 'https://x/approve' },
      { rel: 'payer-action', href: 'https://x/payer' },
    ];
    expect(approveLink(links)).toBe('https://x/payer');
    expect(approveLink(links.slice(0, 2))).toBe('https://x/approve');
    expect(approveLink([{ rel: 'self', href: 'https://x/self' }])).toBeUndefined();
    expect(approveLink(undefined)).toBeUndefined();
  });
});
