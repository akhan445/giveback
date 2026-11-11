import { captureAndRecord, type Captured } from '@/lib/capture';
import { getOrgProfile } from '@/lib/history';
import { PaidCard } from './paid-card';
import styles from './pay.module.css';

// What a supporter's phone shows after PayPal sends it back: capture the payment (so it is recorded even if
// the counter or display is offline) and show the PAID confirmation. `again` adds a Donate again link.
export async function ReturnView({ token, again }: { token?: string; again: boolean }) {
  const org = (await getOrgProfile()).name;

  let paid: Captured | null = null;
  if (token && /^[A-Za-z0-9-]{8,40}$/.test(token)) {
    try {
      paid = await captureAndRecord(token);
    } catch {
      paid = null;
    }
  }

  if (!paid) {
    return (
      <main className={styles.root}>
        <div className={styles.card}>
          <span className={styles.org}>{org}</span>
          <div className={`${styles.thanks} ${styles.bad}`}>We could not confirm this payment</div>
          <p className={styles.note}>You have not been charged unless PayPal says so. Please ask the volunteer at the counter for help.</p>
        </div>
      </main>
    );
  }
  return <PaidCard org={org} amountCents={paid.amountCents} currency={paid.currency} firstName={paid.payerFirstName} pending={paid.status !== 'COMPLETED'} again={again} />;
}
