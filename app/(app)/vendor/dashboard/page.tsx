import { connection } from 'next/server';
import { getOverview } from '@/lib/overview';
import { listSponsors } from '@/lib/sponsors';
import { Overview } from './overview';

export default async function OverviewPage() {
  await connection(); // live data: render per request
  const [data, sponsors] = await Promise.all([getOverview(), listSponsors().catch(() => [])]);
  return <Overview data={data} sponsors={sponsors} />;
}
