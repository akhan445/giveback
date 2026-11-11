// Country names and regions for reporting where supporters give from (PayPal reports the payer's
// ISO 3166 country code). Only the countries we show; anything else falls back to the code.
export const COUNTRIES: Record<string, { name: string; region: string }> = {
  CA: { name: 'Canada', region: 'North America' },
  US: { name: 'United States', region: 'North America' },
  MX: { name: 'Mexico', region: 'Latin America' },
  BR: { name: 'Brazil', region: 'Latin America' },
  GB: { name: 'United Kingdom', region: 'Europe' },
  IE: { name: 'Ireland', region: 'Europe' },
  DE: { name: 'Germany', region: 'Europe' },
  FR: { name: 'France', region: 'Europe' },
  NL: { name: 'Netherlands', region: 'Europe' },
  ES: { name: 'Spain', region: 'Europe' },
  IT: { name: 'Italy', region: 'Europe' },
  IN: { name: 'India', region: 'Asia' },
  PK: { name: 'Pakistan', region: 'Asia' },
  PH: { name: 'Philippines', region: 'Asia' },
  JP: { name: 'Japan', region: 'Asia' },
  AE: { name: 'United Arab Emirates', region: 'Middle East' },
  NG: { name: 'Nigeria', region: 'Africa' },
  KE: { name: 'Kenya', region: 'Africa' },
  ZA: { name: 'South Africa', region: 'Africa' },
  AU: { name: 'Australia', region: 'Oceania' },
  NZ: { name: 'New Zealand', region: 'Oceania' },
};

export const countryName = (code?: string | null) => (code ? (COUNTRIES[code]?.name ?? code) : 'Unknown');
export const countryRegion = (code?: string | null) => (code ? (COUNTRIES[code]?.region ?? 'Other') : 'Unknown');
