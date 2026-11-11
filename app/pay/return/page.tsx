import { captureAndRecord, type Captured } from '@/lib/capture';
import { CURRENCIES, type CurrencyCode } from '@/lib/currency';
import { getOrgProfile } from '@/lib/history';
import { centsToDecimal } from '@/lib/money';
import styles from '../pay.module.css';

export const dynamic = 'force-dynamic';

// Where PayPal sends a supporter's phone after they approve a payment from the counter's QR code.
// PayPal adds ?token=<order id>; we capture the payment here, so it is recorded even if the
// counter device is offline, and show the PAID confirmation.
export default async function PayReturn({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const org = (await getOrgProfile()).name;

  let paid: Captured | null = null;
  let failed = false;
  if (token && /^[A-Za-z0-9-]{8,40}$/.test(token)) {
    try {
      paid = await captureAndRecord(token);
    } catch {
      failed = true;
    }
  } else {
    failed = true;
  }

  if (failed || !paid) {
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

  const symbol = CURRENCIES[paid.currency as CurrencyCode]?.symbol ?? '';
  const completed = paid.status === 'COMPLETED';
  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <span className={styles.org}>{org}</span>
        {completed ? <div className={styles.stamp}>PAID</div> : null}
        <div className={styles.amount}>
          {symbol}{centsToDecimal(paid.amountCents)}
          <span className={styles.cur}>{paid.currency}</span>
        </div>
        <div className={styles.thanks}>{paid.payerFirstName ? `Thank you, ${paid.payerFirstName}!` : 'Thank you!'}</div>
        <p className={styles.note}>
          {completed
            ? 'Your receipt is in your PayPal account. You can close this page.'
            : 'PayPal is still processing this payment. You will get a receipt from PayPal when it completes.'}
        </p>
      </div>
    </main>
  );
}
