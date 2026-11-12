import { connection } from 'next/server';
import { getOverview } from '@/lib/overview';
import { listSponsors } from '@/lib/sponsors';
import { latestSummary, listDrafts } from '@/lib/ai-store';
import { Overview } from './overview';

export default async function OverviewPage() {
  await connection(); // live data: render per request
  const [data, sponsors, summary, drafts] = await Promise.all([getOverview(), listSponsors().catch(() => []), latestSummary().catch(() => null), listDrafts().catch(() => [])]);
  return <Overview data={data} sponsors={sponsors} summary={summary} drafts={drafts} />;
}
