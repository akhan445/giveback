// Saved Ask giveback state: the conversation and the latest AI summary, so a director who leaves can come back and continue.
import { db } from './db';
import type { InvoiceProposal } from './chat-tools';

export type SavedMsg = { role: 'user' | 'assistant'; text: string; proposals?: InvoiceProposal[] };
export type SavedSummary = { body: string; createdAt: string };

export async function listChat(limit = 40): Promise<SavedMsg[]> {
  const { rows } = await db().query<{ role: 'user' | 'assistant'; text: string; proposals: InvoiceProposal[] | null }>(
    'SELECT role, text, proposals FROM (SELECT * FROM chat_messages ORDER BY id DESC LIMIT $1) t ORDER BY id', [limit]);
  return rows.map((r) => ({ role: r.role, text: r.text, ...(r.proposals?.length ? { proposals: r.proposals } : {}) }));
}

export async function saveChatTurn(user: string, assistant: string, proposals?: InvoiceProposal[]) {
  await db().query('INSERT INTO chat_messages (role, text) VALUES ($1, $2)', ['user', user]);
  await db().query('INSERT INTO chat_messages (role, text, proposals) VALUES ($1, $2, $3)', ['assistant', assistant, proposals?.length ? JSON.stringify(proposals) : null]);
}

export async function clearChat() {
  await db().query('DELETE FROM chat_messages');
}

export async function latestSummary(): Promise<SavedSummary | null> {
  const { rows } = await db().query<{ body: string; created_at: Date }>('SELECT body, created_at FROM ai_summaries ORDER BY id DESC LIMIT 1');
  return rows[0] ? { body: rows[0].body, createdAt: rows[0].created_at.toISOString() } : null;
}

export async function saveSummary(body: string): Promise<SavedSummary> {
  const { rows } = await db().query<{ created_at: Date }>('INSERT INTO ai_summaries (body) VALUES ($1) RETURNING created_at', [body]);
  return { body, createdAt: rows[0].created_at.toISOString() };
}
