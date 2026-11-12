import { connection } from 'next/server';
import { getCashbackAccount } from '@/lib/payouts';
import { Cashback } from './cashback';

export default async function CashbackPage() {
  await connection(); // live data: render per request
  return <Cashback account={await getCashbackAccount()} />;
}
