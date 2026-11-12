// Fills payments.platform_fee_cents for rows recorded before the platform fee existed (idempotent: only rows at 0).
// Usage: npm run db:backfill
import { Pool } from 'pg';
import { CURRENCY_CODES, convertUsdCents } from '../lib/currency';
import { PLATFORM_FIXED_USD_CENTS, PLATFORM_RATE_BP } from '../lib/fees';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED must be set');
  const pool = new Pool({ connectionString: url });
  const fixed = CURRENCY_CODES.map((c) => `WHEN '${c}' THEN ${convertUsdCents(PLATFORM_FIXED_USD_CENTS, c)}`).join(' ');
  const r = await pool.query(
    `UPDATE payments SET platform_fee_cents = round(amount_cents * ${PLATFORM_RATE_BP}::numeric / 10000)::int + (CASE currency ${fixed} ELSE ${PLATFORM_FIXED_USD_CENTS} END)
      WHERE platform_fee_cents = 0`,
  );
  console.log('backfilled', r.rowCount, 'payments');
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
