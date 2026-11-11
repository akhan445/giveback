import { connection } from 'next/server';
import { getOrgProfile } from '@/lib/history';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  await connection();
  return <SettingsForm initial={await getOrgProfile()} />;
}
