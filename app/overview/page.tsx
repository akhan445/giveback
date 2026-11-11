import { connection } from 'next/server';
import { getOverview } from '@/lib/overview';
import { Overview } from './overview';

export default async function OverviewPage() {
  await connection(); // live data: render per request
  return <Overview data={await getOverview()} />;
}
