import { getOrgProfile } from '@/lib/history';
import styles from '../pay.module.css';

export const dynamic = 'force-dynamic';

// Where PayPal sends a supporter's phone if they back out of the payment.
export default async function PayCancelled() {
  const org = (await getOrgProfile()).name;
  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <span className={styles.org}>{org}</span>
        <div className={styles.thanks}>Payment cancelled</div>
        <p className={styles.note}>You have not been charged. To pay, scan the code on the counter screen again.</p>
      </div>
    </main>
  );
}
