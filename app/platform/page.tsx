import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { TIERS } from '@/lib/cashback';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import { PAYOUT_FEE_BP, PAYPAL_FIXED_USD_CENTS, PAYPAL_RATE_BP, PLATFORM_FIXED_USD_CENTS, PLATFORM_RATE_BP, splitPayment } from '@/lib/fees';
import { getYearLedger } from '@/lib/ledger';
import { ScaleModel } from './scale-model';
import { GivebackMark } from '../brand';
import styles from './platform.module.css';

export const metadata: Metadata = { title: 'Platform economics' };

const money = (c: number, d = 0) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (bp: number) => `${(bp / 100).toFixed(2).replace(/0$/, '')}%`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function PlatformPage() {
  await connection();
  const year = new Date().getUTCFullYear();
  const months = await getYearLedger(year);
  const t = months.reduce((a, m) => ({ volume: a.volume + m.volumeCents, fee: a.fee + m.platformFeeCents, cash: a.cash + m.cashbackCents, n: a.n + m.count }), { volume: 0, fee: 0, cash: 0, n: 0 });
  const net = t.fee - t.cash;
  const byMonth = new Map(months.map((m) => [Number(m.month.slice(5)), m]));
  const series = MONTHS.map((label, i) => {
    const m = byMonth.get(i + 1);
    return { label, fee: m?.platformFeeCents ?? 0, cash: m?.cashbackCents ?? 0 };
  });
  const maxV = Math.max(1, ...series.map((s) => s.fee));

  // The $50 worked example: same code as the Counter and the landing page.
  const SALE = 5000;
  const paypal = Math.round((SALE * PAYPAL_RATE_BP) / 10_000) + PAYPAL_FIXED_USD_CENTS;
  const sp = splitPayment(SALE, paypal, 'USD');
  const unit = TIERS.map((tier) => {
    const rebate = Math.round((SALE * tier.rateBp) / 10_000);
    return { name: tier.name, rate: tier.rateBp, rebate, keep: sp.platformFee - rebate };
  });

  const W = 800, H = 250, PADL = 8, PADB = 26, PADT = 14;
  const bw = (W - PADL) / 12;
  const y = (v: number) => H - PADB - (v / maxV) * (H - PADB - PADT);

  return (
    <div className={styles.wrap}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}><GivebackMark size={34} />giveback</Link>
        <div className={styles.pills}>
          <span className={styles.pill}>Sandbox demo</span>
          <Link href="/vendor/dashboard" className={styles.pill}>Vendor app →</Link>
        </div>
      </header>

      <section className={styles.head}>
        <div className={styles.lab}>The platform</div>
        <h1>giveback earns pennies per payment, and gives some back.</h1>
        <p className={styles.sub}>Every payment carries one admin fee: PayPal&apos;s fees plus ours. Volume earns the nonprofit cashback on our part. Below: real numbers from our sample vendor this year, the math of a single payment, and a scale model.</p>
      </section>

      <section className={styles.sect}>
        <div className={styles.lab}>Real data · {year} · {DEFAULT_CURRENCY}</div>
        <h2>Riverside Kitchen, year to date</h2>
        <p className={styles.lead}>One example vendor, from sandbox payment history. Early months are seeded sample data; recent payments are real sandbox transactions.</p>
        <div className={styles.tiles}>
          <div className={`${styles.card} ${styles.tile}`}><div className={styles.lab}>Volume processed</div><div className={styles.v}>{money(t.volume)}</div><div className={styles.n}>{t.n.toLocaleString('en-US')} payments</div></div>
          <div className={`${styles.card} ${styles.tile}`}><div className={styles.lab}>giveback fees earned</div><div className={styles.v}>{money(t.fee)}</div><div className={styles.n}>{t.volume ? pct((t.fee / t.volume) * 10_000) : '0%'} of volume</div></div>
          <div className={`${styles.card} ${styles.tile} ${styles.soft}`}><div className={styles.lab}>Cashback paid back</div><div className={`${styles.v} ${styles.green}`}>− {money(t.cash)}</div><div className={styles.n}>earned by the vendor</div></div>
          <div className={`${styles.card} ${styles.tile} ${styles.dark}`}><div className={styles.lab}>giveback keeps</div><div className={styles.v}>{money(net)}</div><div className={styles.n}>{t.n ? `${money(Math.round(net / t.n), 2)} per payment` : '-'}</div></div>
        </div>
      </section>

      <section className={`${styles.sect} ${styles.two}`}>
        <div>
          <div className={styles.lab}>One payment</div>
          <h2>A {money(SALE)} sale, where it goes</h2>
          <p className={styles.lead}>PayPal&apos;s fees, including what PayPal charges to send the vendor its share, are passed through. giveback keeps its own fee, less cashback.</p>
          <div className={styles.card}>
            <div className={styles.row}><span>Supporter pays</span><span className={styles.mono}>{money(SALE, 2)}</span></div>
            <div className={styles.row}><span>PayPal ({pct(PAYPAL_RATE_BP)} + ${(PAYPAL_FIXED_USD_CENTS / 100).toFixed(2)})</span><span className={styles.mono}>− {money(paypal, 2)}</span></div>
            <div className={styles.row}><span>PayPal payout fee ({pct(PAYOUT_FEE_BP)})</span><span className={styles.mono}>− {money(sp.payoutFee, 2)}</span></div>
            <div className={styles.row}><span>giveback ({pct(PLATFORM_RATE_BP)} + ${(PLATFORM_FIXED_USD_CENTS / 100).toFixed(2)})</span><span className={`${styles.mono} ${styles.green}`}>− {money(sp.platformFee, 2)}</span></div>
            <div className={`${styles.row} ${styles.total}`}><span>Nonprofit receives</span><span className={styles.mono}>{money(sp.vendorShare, 2)}</span></div>
            <div className={`${styles.row} ${styles.hl}`}><span>Vendor and giveback each see the fees as one admin fee</span><b className={styles.mono}>{money(sp.paypalLump + sp.platformFee, 2)}</b></div>
          </div>
        </div>
        <div>
          <div className={styles.lab}>Cashback tiers</div>
          <h2>What each tier costs us</h2>
          <p className={styles.lead}>Cashback is a rebate on giveback&apos;s fee, so we always keep a margin, even at the top tier.</p>
          <div className={styles.card}>
            <table className={styles.tbl}>
              <thead><tr><th>Tier</th><th>Cashback</th><th>Per {money(SALE)}</th><th>giveback keeps</th></tr></thead>
              <tbody>
                {unit.map((u) => (
                  <tr key={u.name}><td>{u.name}</td><td>{pct(u.rate)}</td><td className={styles.green}>− {money(u.rebate, 2)}</td><td>{money(u.keep, 2)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>Tiers use monthly volume ($0 / $10,000 / $50,000), plus 0.05% for 200 or more payments. In the sandbox the pricing advantage that funds cashback is simulated.</p>
          </div>
        </div>
      </section>

      <section className={styles.sect}>
        <div className={styles.lab}>By month · {year}</div>
        <h2>Fees earned vs cashback paid back</h2>
        <div className={`${styles.card} ${styles.chart}`}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly giveback fees and cashback">
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={PADL} x2={W} y1={y(maxV * f)} y2={y(maxV * f)} stroke="#e9eddf" />
            ))}
            {series.map((s, i) => {
              const x = PADL + i * bw + bw * 0.15;
              const w = bw * 0.7;
              return (
                <g key={s.label}>
                  <rect x={x} y={y(s.fee)} width={w / 2 - 1} height={H - PADB - y(s.fee)} fill="#25301f" rx="1" />
                  <rect x={x + w / 2 + 1} y={y(s.cash)} width={w / 2 - 1} height={H - PADB - y(s.cash)} fill="#4f6b3a" rx="1" />
                  {s.fee > 0 && <text x={x + w / 2} y={y(s.fee) - 5} textAnchor="middle" style={{ font: '500 9px IBM Plex Mono, monospace', fill: '#7a8472' }}>{money(s.fee)}</text>}
                  <text x={x + w / 2} y={H - 8} textAnchor="middle" style={{ font: '500 10px IBM Plex Mono, monospace', fill: '#7a8472' }}>{s.label}</text>
                </g>
              );
            })}
          </svg>
          <div className={styles.legend}><span><i style={{ background: '#25301f' }} />giveback fees earned</span><span><i style={{ background: '#4f6b3a' }} />cashback paid back</span></div>
        </div>
      </section>

      <section className={styles.sect}>
        <div className={styles.lab}>Scale model · illustrative</div>
        <h2>What if 500 vendors joined?</h2>
        <p className={styles.lead}>Move the sliders. It runs the same fee and cashback code as the app. The inputs are assumptions, not forecasts, and nothing here is real revenue.</p>
        <ScaleModel />
      </section>

      <section className={styles.sect}>
        <div className={styles.lab}>How we collect today, and in production</div>
        <h2>Sandbox mechanics</h2>
        <div className={styles.card}>
          <p className={styles.sub} style={{ maxWidth: 'none' }}>Supporters pay the giveback platform account. PayPal takes its fee, then giveback pays the nonprofit its share through the Payouts API right away, and keeps its own fee in the platform account. A real launch would use PayPal&apos;s partner fee collection and negotiated volume pricing; the PayPal payout fee shown above is a sandbox-era cost we pass through to vendors.</p>
        </div>
      </section>

      <footer className={styles.foot}>
        <span>Sandbox demo: all payments, fees and cashback use PayPal sandbox money. The pricing advantage is simulated.</span>
        <Link href="/" style={{ color: 'inherit' }}>← giveback home</Link>
      </footer>
    </div>
  );
}
