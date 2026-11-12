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

export type WorkingDraft = { cardId: string; title: string; summary: string; updatedAt: string };

export async function listDrafts(): Promise<WorkingDraft[]> {
  const { rows } = await db().query<{ card_id: string; title: string; summary: string; updated_at: Date }>('SELECT card_id, title, summary, updated_at FROM working_drafts ORDER BY updated_at DESC');
  return rows.map((r) => ({ cardId: r.card_id, title: r.title, summary: r.summary, updatedAt: r.updated_at.toISOString() }));
}

export async function saveDraft(cardId: string, title: string, summary: string): Promise<WorkingDraft> {
  const { rows } = await db().query<{ updated_at: Date }>(
    `INSERT INTO working_drafts (card_id, title, summary) VALUES ($1,$2,$3)
     ON CONFLICT (card_id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, updated_at = now() RETURNING updated_at`, [cardId, title, summary]);
  return { cardId, title, summary, updatedAt: rows[0].updated_at.toISOString() };
}

export async function deleteDraft(cardId: string) {
  await db().query('DELETE FROM working_drafts WHERE card_id = $1', [cardId]);
}
