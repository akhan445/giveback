// Seeds realistic SANDBOX history so the dashboard has something to show (see lib/demo-seed.ts).
// Usage: npm run db:seed   (safe to repeat; never touches real captures/webhooks)
import { Pool } from 'pg';
import { seedPayments } from '../lib/demo-seed';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED must be set');
  const pool = new Pool({ connectionString: url });
  await seedPayments(pool, { log: true });
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
