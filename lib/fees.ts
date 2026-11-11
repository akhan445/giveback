// "Cover our fees": the supporter can add the PayPal fee to their payment so the organization
// keeps the full amount. PayPal's real fee is charged on the WHOLE payment (including the extra),
// so the add-on is grossed up: c = (rate * total + fixed) / (1 - rate).
// SANDBOX PRICING: 2.89% + $0.30, measured from sandbox captures. Fixed part scales by currency.
import { convertUsdCents, type CurrencyCode } from './currency';

const RATE_BP = 289; // 2.89% in basis points
const FIXED_USD_CENTS = 30;

const TAG = 'fee_cover:';
const ANON = '|anon';
/** Stored on the PayPal order (custom_id) so the capture and the webhook can both read it back. */
export const feeCoverTag = (cents: number, anonymous = false) => `${TAG}${cents}${anonymous ? ANON : ''}`;
export function parseOrderTag(customId?: string | null): { feeCoverCents: number; anonymous: boolean } {
  if (!customId?.startsWith(TAG)) return { feeCoverCents: 0, anonymous: false };
  const anonymous = customId.endsWith(ANON);
  const n = Number(customId.slice(TAG.length, anonymous ? -ANON.length : undefined));
  return { feeCoverCents: Number.isInteger(n) && n > 0 ? n : 0, anonymous };
}
export const parseFeeCoverTag = (customId?: string | null): number => parseOrderTag(customId).feeCoverCents;

/** Extra cents a supporter adds so the organization nets `totalCents` after PayPal's fee. */
export function feeCoverCents(totalCents: number, currency: CurrencyCode): number {
  if (totalCents <= 0) return 0;
  const fixed = convertUsdCents(FIXED_USD_CENTS, currency);
  return Math.ceil((totalCents * RATE_BP + fixed * 10_000) / (10_000 - RATE_BP));
}
