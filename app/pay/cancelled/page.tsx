import { getOrgProfile } from '@/lib/history';
import { findPaidOrder } from '@/lib/payments';
import { PaidCard } from '../paid-card';
import styles from '../pay.module.css';

export const dynamic = 'force-dynamic';

// Where PayPal sends a supporter's phone if they back out of the payment. PayPal also sends people here
// when they tap "Return to merchant" after an order was already paid (or tap Cancel while it was still
// processing), so we check: if that order was paid, show the PAID confirmation instead of "cancelled".
export default async function PayCancelled({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const org = (await getOrgProfile()).name;

  if (token && /^[A-Za-z0-9-]{8,40}$/.test(token)) {
    const paid = await findPaidOrder(token).catch(() => null);
    if (paid) {
      return <PaidCard org={org} amountCents={paid.amountCents} currency={paid.currency} firstName={paid.anonymous ? null : paid.payerFirstName} />;
    }
  }

  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <span className={styles.org}>{org}</span>
        <div className={styles.thanks}>Payment cancelled</div>
        <p className={styles.note}>You have not been charged. To pay, scan the code on the screen again.</p>
      </div>
    </main>
  );
}
