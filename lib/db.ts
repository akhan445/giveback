// One shared Postgres pool (Neon, pooled connection string). Server-side only.
// On Vercel, attachDatabasePool lets Fluid compute close idle connections cleanly.
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export function db(): Pool {
  if (!globalForPg.pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL must be set (see env.example)');
    // TLS settings come from the connection string (sslmode=require).
    const pool = new Pool({ connectionString, max: 5 });
    attachDatabasePool(pool);
    globalForPg.pgPool = pool;
  }
  return globalForPg.pgPool;
}
