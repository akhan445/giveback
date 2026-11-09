// The things a volunteer can sell. Prices live on the SERVER: the browser only sends item
// ids and quantities, so a tampered client can never change what a sale costs.
import { z } from 'zod';

export const CATALOG = [
  { id: 'cookie', name: 'Cookie box', priceCents: 1200 },
  { id: 'coffee', name: 'Coffee', priceCents: 350 },
  { id: 'tshirt', name: 'Charity T-shirt', priceCents: 2500 },
  { id: 'raffle', name: 'Raffle ticket', priceCents: 500 },
] as const;

export const MIN_DONATION_CENTS = 100; // $1
export const MAX_DONATION_CENTS = 1_000_000; // $10,000
export const MAX_ORDER_CENTS = 2_000_000; // $20,000

export const orderRequestSchema = z.object({
  items: z.array(z.object({ id: z.string(), qty: z.number().int().min(1).max(100) })).max(20).default([]),
  donationCents: z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS).optional(),
});
export type OrderRequest = z.infer<typeof orderRequestSchema>;

export type PricedOrder = {
  totalCents: number;
  kind: 'sale' | 'donation';
  description: string;
};

/** Prices an order from server-side data. Throws on unknown items, empty or oversized orders. */
export function priceOrder(req: OrderRequest): PricedOrder {
  let totalCents = 0;
  const parts: string[] = [];
  for (const line of req.items) {
    const item = CATALOG.find((c) => c.id === line.id);
    if (!item) throw new RangeError(`unknown item: ${line.id}`);
    totalCents += item.priceCents * line.qty;
    parts.push(`${line.qty}x ${item.name}`);
  }
  if (req.donationCents) {
    totalCents += req.donationCents;
    parts.push('Donation');
  }
  if (totalCents <= 0) throw new RangeError('order is empty');
  if (totalCents > MAX_ORDER_CENTS) throw new RangeError('order too large');
  return {
    totalCents,
    kind: req.items.length === 0 ? 'donation' : 'sale',
    description: parts.join(', ').slice(0, 120),
  };
}
