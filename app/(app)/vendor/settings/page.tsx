import { connection } from 'next/server';
import { getGoal, getOrgProfile } from '@/lib/history';
import { getRecipientEmail } from '@/lib/payouts';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  await connection();
  return <SettingsForm initial={await getOrgProfile()} initialGoal={await getGoal()} initialPayoutEmail={(await getRecipientEmail()) ?? ''} />;
}
