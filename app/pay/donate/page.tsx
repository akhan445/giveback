import type { Metadata } from 'next';
import { getGoal, getOrgProfile } from '@/lib/history';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import { resolveImpact } from '@/lib/impact';
import { DonateForm } from './donate-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Donate' };

// Public donate page: what the QR code on the live display opens. No sign-in; PayPal asks the supporter to approve.
export default async function DonatePage() {
  const [org, goal] = await Promise.all([getOrgProfile(), getGoal()]);
  const impact = resolveImpact(org.orgType, goal.impact);
  return <DonateForm org={org.name} goalName={goal.name} currency={DEFAULT_CURRENCY} unit={impact.unit} unitCents={impact.unitCents} />;
}
