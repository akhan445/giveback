// Applies db/schema.sql to the database in DATABASE_URL.  Usage: npm run db:migrate
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main() {
  // Migrations use the direct (non-pooled) connection, per Neon's guidance.
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED must be set');
  const pool = new Pool({ connectionString: url });
  await pool.query(readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
  const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1");
  console.log('tables:', rows.map((r) => r.table_name).join(', '));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
