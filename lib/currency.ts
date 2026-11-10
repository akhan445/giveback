// Currencies a vendor can sell in. The catalog is priced in USD; other currencies use the
// SIMULATED rates below (sandbox demo only). A real launch would let each organization set
// its own prices per currency or pull live rates. Two-decimal currencies only, so money
// stays integer minor units everywhere.

export const CURRENCIES = {
  USD: { flag: 'US', symbol: '$', rate: 1, label: 'US dollar' },
  CAD: { flag: 'CA', symbol: '$', rate: 1.38, label: 'Canadian dollar' },
  EUR: { flag: 'EU', symbol: '€', rate: 0.92, label: 'Euro' },
  GBP: { flag: 'GB', symbol: '£', rate: 0.79, label: 'British pound' },
  AUD: { flag: 'AU', symbol: '$', rate: 1.52, label: 'Australian dollar' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as [CurrencyCode, ...CurrencyCode[]];

// The currency of the organization's PayPal account. Selling in it means PayPal never converts
// (no FX loss). Set NEXT_PUBLIC_ORG_CURRENCY; the sandbox business account holds CAD.
const configured = process.env.NEXT_PUBLIC_ORG_CURRENCY as CurrencyCode | undefined;
export const DEFAULT_CURRENCY: CurrencyCode = configured && configured in CURRENCIES ? configured : 'CAD';

/** Converts a USD price in cents to `currency`, rounded to the nearest 5 minor units (so $3.50 -> 4.85, not 4.83). */
export function convertUsdCents(usdCents: number, currency: CurrencyCode): number {
  if (currency === 'USD') return usdCents;
  return Math.round((usdCents * CURRENCIES[currency].rate) / 5) * 5;
}
