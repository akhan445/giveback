// Money helpers. Everything internal is integer cents; PayPal speaks decimal strings.

/** 1234 -> "12.34" */
export function centsToDecimal(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError(`invalid cents: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** "12.34" -> 1234. Parses the string directly so floating point never touches money. */
export function decimalToCents(value: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!m) throw new RangeError(`invalid amount: ${value}`);
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
}
