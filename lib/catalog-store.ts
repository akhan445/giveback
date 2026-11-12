// The Counter's items and title live in Postgres so a volunteer can edit them. Seeded once from DEFAULT_CATALOG.
import { randomBytes } from 'node:crypto';
import { db } from './db';
import { DEFAULT_CATALOG, type CatalogItem } from './catalog';

export const DEFAULT_COUNTER_TITLE = 'Riverside Community Bake Sale';

async function ensureSeeded() {
  const { rows } = await db().query('SELECT 1 FROM catalog_items LIMIT 1');
  if (rows.length) return;
  for (const [i, c] of DEFAULT_CATALOG.entries()) {
    await db().query('INSERT INTO catalog_items (id, name, price_cents, sort) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [c.id, c.name, c.priceCents, i]);
  }
}

export async function listCatalog(): Promise<CatalogItem[]> {
  await ensureSeeded();
  const { rows } = await db().query<{ id: string; name: string; price_cents: number }>('SELECT id, name, price_cents FROM catalog_items ORDER BY sort, id');
  return rows.map((r) => ({ id: r.id, name: r.name, priceCents: r.price_cents }));
}

export async function addItem(name: string, priceCents: number): Promise<CatalogItem> {
  await ensureSeeded();
  const id = `i${randomBytes(5).toString('hex')}`;
  await db().query('INSERT INTO catalog_items (id, name, price_cents, sort) VALUES ($1,$2,$3,(SELECT COALESCE(MAX(sort),0)+1 FROM catalog_items))', [id, name, priceCents]);
  return { id, name, priceCents };
}

export async function updateItem(id: string, name: string, priceCents: number): Promise<boolean> {
  const r = await db().query('UPDATE catalog_items SET name = $2, price_cents = $3 WHERE id = $1', [id, name, priceCents]);
  return (r.rowCount ?? 0) > 0;
}

export async function deleteItem(id: string): Promise<void> {
  await db().query('DELETE FROM catalog_items WHERE id = $1', [id]);
}

export async function getCounterTitle(): Promise<string> {
  const { rows } = await db().query<{ counter_title: string }>('SELECT counter_title FROM org_settings WHERE id = 1');
  return rows[0]?.counter_title ?? DEFAULT_COUNTER_TITLE;
}

export async function setCounterTitle(title: string): Promise<void> {
  await db().query('UPDATE org_settings SET counter_title = $1, updated_at = now() WHERE id = 1', [title]);
}
