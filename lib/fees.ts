// The ADMIN FEE a vendor pays on every payment = PayPal's fee + giveback's platform fee.
//   PayPal:   2.89% + $0.30  (SANDBOX PRICING, measured from sandbox captures)
//   payout:   2% of the payout, capped (PayPal charges the platform to send the vendor its share through Payouts).
//             Bundled into the admin fee and shown to the vendor as part of "PayPal fees". Observed in the sandbox: 0.65 on a 32.41 CAD payout.
//   giveback: 1.25% + $0.10  (our platform fee; cashback later returns part of it to the vendor)
// "Cover the admin fee": the supporter can add it to their payment so the organization keeps the full amount.
// Both fees are charged on the WHOLE payment (including the extra), so the add-on is grossed up:
// c = (rate * total + fixed) / (1 - rate). Fixed parts scale by currency.
import { convertUsdCents, type CurrencyCode } from './currency';

export const PAYPAL_RATE_BP = 289; // 2.89% in basis points
export const PAYPAL_FIXED_USD_CENTS = 30;
export const PLATFORM_RATE_BP = 125; // 1.25%
export const PLATFORM_FIXED_USD_CENTS = 10;
// ASSUMPTION: the domestic cap is about $1 (CAD 1.25 on PayPal's CAD fee page for another market). Verify for the sandbox/live account.
export const PAYOUT_FEE_BP = 200;
const PAYOUT_FEE_CAP_USD_CENTS = 100;
const PAYOUT_FEE_CAP_OVERRIDES: Partial<Record<CurrencyCode, number>> = { CAD: 125 };
const payoutCap = (currency: CurrencyCode) => PAYOUT_FEE_CAP_OVERRIDES[currency] ?? convertUsdCents(PAYOUT_FEE_CAP_USD_CENTS, currency);
const RATE_BP = PAYPAL_RATE_BP + PLATFORM_RATE_BP;
const FIXED_USD_CENTS = PAYPAL_FIXED_USD_CENTS + PLATFORM_FIXED_USD_CENTS;

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

/** giveback's platform fee on one payment of `amountCents` (percentage + a fixed amount in that currency). */
export function platformFeeCents(amountCents: number, currency: string): number {
  if (amountCents <= 0) return 0;
  return Math.round((amountCents * PLATFORM_RATE_BP) / 10_000) + convertUsdCents(PLATFORM_FIXED_USD_CENTS, currency as CurrencyCode);
}

/**
 * PayPal's fee for paying the vendor, given the cents the platform has left after PayPal's and giveback's fees.
 * PayPal charges the fee ON TOP of the payout (platform pays P + fee), so with X available: P = X / 1.02, fee = X - P, capped.
 */
export function payoutFeeCents(availableCents: number, currency: string): number {
  if (availableCents <= 0) return 0;
  const uncapped = availableCents - Math.floor((availableCents * 10_000) / (10_000 + PAYOUT_FEE_BP));
  return Math.min(uncapped, payoutCap(currency as CurrencyCode));
}

/** The vendor's share of a payment: what is left after PayPal's fee, giveback's fee and the payout fee. Never negative. */
export const vendorShareCents = (amountCents: number, paypalFeeCents: number, platformFee: number, payoutFee = 0) =>
  Math.max(0, amountCents - paypalFeeCents - platformFee - payoutFee);

/** Everything in one go for a payment: the lump "PayPal fees" (PayPal + payout), giveback's fee and what the vendor receives. */
export function splitPayment(amountCents: number, paypalFeeCents: number, currency: string) {
  const platformFee = platformFeeCents(amountCents, currency);
  const available = Math.max(0, amountCents - paypalFeeCents - platformFee);
  const payoutFee = payoutFeeCents(available, currency);
  return { platformFee, payoutFee, paypalLump: paypalFeeCents + payoutFee, vendorShare: available - payoutFee };
}

/** Extra cents a supporter adds so the organization nets `totalCents` after the whole admin fee (PayPal + payout + giveback). */
export function feeCoverCents(totalCents: number, currency: CurrencyCode): number {
  if (totalCents <= 0) return 0;
  const fixed = convertUsdCents(FIXED_USD_CENTS, currency);
  // The platform must hold X = min(1.02 * net, net + cap) before the payout fee; both fees are charged on the whole gross A:
  // A * (1 - rate) - fixed = X.
  const x100 = Math.min(totalCents * (10_000 + PAYOUT_FEE_BP) / 100, (totalCents + payoutCap(currency)) * 100); // X * 100
  return Math.ceil((x100 * 100 + fixed * 10_000) / (10_000 - RATE_BP)) - totalCents;
}
