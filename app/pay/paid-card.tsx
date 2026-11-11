import { CURRENCIES, type CurrencyCode } from '@/lib/currency';
import { centsToDecimal } from '@/lib/money';
import styles from './pay.module.css';

// The confirmation a supporter sees on their phone: PAID stamp, amount and a thank-you. `pending` is for
// a payment PayPal has accepted but not completed yet (no stamp).
export function PaidCard({ org, amountCents, currency, firstName, pending = false }: { org: string; amountCents: number; currency: string; firstName: string | null; pending?: boolean }) {
  const symbol = CURRENCIES[currency as CurrencyCode]?.symbol ?? '';
  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <span className={styles.org}>{org}</span>
        {pending ? null : <div className={styles.stamp}>PAID</div>}
        <div className={styles.amount}>
          {symbol}{centsToDecimal(amountCents)}
          <span className={styles.cur}>{currency}</span>
        </div>
        <div className={styles.thanks}>{firstName ? `Thank you, ${firstName}!` : 'Thank you!'}</div>
        <p className={styles.note}>
          {pending
            ? 'PayPal is still processing this payment. You will get a receipt from PayPal when it completes.'
            : 'Your receipt is in your PayPal account. You can close this page.'}
        </p>
      </div>
    </main>
  );
}
