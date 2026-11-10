// "Cover our fees": the supporter can add the PayPal fee to their payment so the organization
// keeps the full amount. PayPal's real fee is charged on the WHOLE payment (including the extra),
// so the add-on is grossed up: c = (rate * total + fixed) / (1 - rate).
// SANDBOX PRICING: 2.89% + $0.30, measured from sandbox captures. Fixed part scales by currency.
import { convertUsdCents, type CurrencyCode } from './currency';

const RATE_BP = 289; // 2.89% in basis points
const FIXED_USD_CENTS = 30;

const TAG = 'fee_cover:';
/** Stored on the PayPal order (custom_id) so the capture and the webhook can both read it back. */
export const feeCoverTag = (cents: number) => `${TAG}${cents}`;
export function parseFeeCoverTag(customId?: string | null): number {
  if (!customId?.startsWith(TAG)) return 0;
  const n = Number(customId.slice(TAG.length));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Extra cents a supporter adds so the organization nets `totalCents` after PayPal's fee. */
export function feeCoverCents(totalCents: number, currency: CurrencyCode): number {
  if (totalCents <= 0) return 0;
  const fixed = convertUsdCents(FIXED_USD_CENTS, currency);
  return Math.ceil((totalCents * RATE_BP + fixed * 10_000) / (10_000 - RATE_BP));
}
