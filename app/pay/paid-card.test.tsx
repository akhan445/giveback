import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PaidCard } from './paid-card';

const base = { org: 'Riverside', amountCents: 541, currency: 'CAD', firstName: 'John' };

describe('PaidCard', () => {
  it('shows PAID and the amount, with no Donate again link for counter payments', () => {
    const html = renderToStaticMarkup(<PaidCard {...base} />);
    expect(html).toContain('PAID');
    expect(html).toContain('Thank you, John!');
    expect(html).not.toContain('Donate again');
  });
  it('adds the Donate again link only when asked (live display donors)', () => {
    const html = renderToStaticMarkup(<PaidCard {...base} again />);
    expect(html).toContain('Donate again');
    expect(html).toContain('href="/pay/donate"');
  });
  it('shows a plain thank you without a name, and no stamp while pending', () => {
    const html = renderToStaticMarkup(<PaidCard {...base} firstName={null} pending />);
    expect(html).toContain('Thank you!');
    expect(html).not.toContain('PAID');
  });
});
