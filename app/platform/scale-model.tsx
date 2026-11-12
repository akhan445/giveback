'use client';

// Illustrative scale model: what giveback would earn if many vendors like Riverside signed up.
// Uses the same fee and cashback code as the app. The inputs are assumptions, not forecasts.
import { useMemo, useState } from 'react';
import { computeCashback } from '@/lib/cashback';
import { platformFeeCents } from '@/lib/fees';
import styles from './platform.module.css';

const usd = (c: number, d = 0) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const PRESETS = [100, 500, 2000];

export function ScaleModel() {
  const [vendors, setVendors] = useState(500);
  const [monthly, setMonthly] = useState(6000); // dollars per vendor per month
  const [avg, setAvg] = useState(35); // dollars per payment

  const m = useMemo(() => {
    const volume = monthly * 100;
    const n = Math.max(1, Math.round(monthly / avg));
    const fee = n * platformFeeCents(avg * 100, 'USD');
    const cash = computeCashback(volume, n);
    const net = fee - cash.cashbackCents;
    return {
      volume: volume * vendors,
      fee: fee * vendors,
      cashback: cash.cashbackCents * vendors,
      net: net * vendors,
      tier: cash.tier.name,
      perPayment: Math.round(net / n),
      pct: volume ? (net / volume) * 100 : 0,
      payments: n * vendors,
    };
  }, [vendors, monthly, avg]);

  return (
    <div className={styles.model}>
      <div className={`${styles.card} ${styles.ctl}`}>
        <span className={styles.tag}>Illustrative · not a forecast</span>
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button key={p} type="button" className={vendors === p ? styles.on : ''} onClick={() => setVendors(p)}>{p.toLocaleString('en-US')} vendors</button>
          ))}
        </div>
        <label><b><span>Vendors</span><span className={styles.mono}>{vendors.toLocaleString('en-US')}</span></b>
          <input type="range" min={10} max={5000} step={10} value={vendors} onChange={(e) => setVendors(Number(e.target.value))} aria-label="Number of vendors" /></label>
        <label><b><span>Raised per vendor, per month</span><span className={styles.mono}>{usd(monthly * 100)}</span></b>
          <input type="range" min={500} max={80000} step={500} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} aria-label="Raised per vendor per month" /></label>
        <label><b><span>Average payment</span><span className={styles.mono}>{usd(avg * 100)}</span></b>
          <input type="range" min={5} max={250} step={5} value={avg} onChange={(e) => setAvg(Number(e.target.value))} aria-label="Average payment" /></label>
        <p className={styles.note}>Riverside, our sample vendor, raises about $6,000 a month in payments of about $35. Each vendor lands in the {m.tier} cashback tier at these settings.</p>
      </div>
      <div className={styles.out}>
        <div className={`${styles.card} ${styles.tile}`}><div className={styles.lab}>Volume per month</div><div className={styles.v}>{usd(m.volume)}</div><div className={styles.n}>{m.payments.toLocaleString('en-US')} payments</div></div>
        <div className={`${styles.card} ${styles.tile}`}><div className={styles.lab}>giveback fees</div><div className={styles.v}>{usd(m.fee)}</div><div className={styles.n}>1.25% + $0.10 per payment</div></div>
        <div className={`${styles.card} ${styles.tile} ${styles.soft}`}><div className={styles.lab}>Cashback paid back</div><div className={`${styles.v} ${styles.green}`}>− {usd(m.cashback)}</div><div className={styles.n}>the vendors keep this</div></div>
        <div className={`${styles.card} ${styles.tile} ${styles.dark}`}><div className={styles.lab}>giveback keeps / month</div><div className={styles.v}>{usd(m.net)}</div><div className={styles.n}>{usd(m.net * 12)} a year · {m.pct.toFixed(2)}% of volume · {usd(m.perPayment, 2)} per payment</div></div>
      </div>
    </div>
  );
}
