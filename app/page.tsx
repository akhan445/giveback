import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import { TIERS } from '@/lib/cashback';
import { CURRENCY_CODES } from '@/lib/currency';
import { PAYPAL_FIXED_USD_CENTS, PAYPAL_RATE_BP, PLATFORM_FIXED_USD_CENTS, PLATFORM_RATE_BP, splitPayment } from '@/lib/fees';
import { LandingMap } from './landing-map';
import { GivebackMark } from './brand';
import styles from './landing.module.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--gb-ui' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--gb-mono' });

export const metadata: Metadata = {
  title: { absolute: 'giveback: the platform that gives back' },
  description: 'Payments for nonprofits built on PayPal: a point of sale, live dashboards, an AI cash-flow assistant, and cashback on every dollar raised.',
};

// The worked example on this page comes from the same fee code the Counter uses, so it cannot drift.
const SALE = 5000;
const paypalFee = Math.round((SALE * PAYPAL_RATE_BP) / 10_000) + PAYPAL_FIXED_USD_CENTS;
const { platformFee: gbFee, paypalLump, vendorShare: net } = splitPayment(SALE, paypalFee, 'USD');
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const pct = (bp: number) => `${(bp / 100).toFixed(2).replace(/0$/, '')}%`;
const cashLow = Math.round((SALE * TIERS[0].rateBp) / 10_000);
const cashHigh = Math.round((SALE * TIERS[TIERS.length - 1].rateBp) / 10_000);
const cashRange = `+$${(cashLow / 100).toFixed(2)}–${(cashHigh / 100).toFixed(2)}`;

const SHOTS = [
  { src: '/landing/counter.png', w: 1440, h: 820, title: 'Counter', text: 'Price-first buttons, a receipt cart, PayPal checkout and QR.' },
  { src: '/landing/forecast.png', w: 770, h: 516, title: 'Forecast', text: 'Your own history, seasonal markers and a dashed projection.' },
  { src: '/landing/cashback.png', w: 1440, h: 820, title: 'Cashback', text: 'Balance, tiers and a payout log with PDF invoices.' },
  { src: '/landing/ask.png', w: 592, h: 420, title: 'Ask giveback', text: 'Ask about rent or cash flow; it proposes an invoice and you confirm.' },
  { src: '/landing/reports.png', w: 1440, h: 820, title: 'Reports', text: 'Live displays and your own widgets in AG Studio.' },
  { src: '/landing/report.png', w: 850, h: 1100, title: 'Year-end report', text: 'Savings, a monthly chart and the payout log as a PDF.' },
];

const Loop = () => (
  <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#4f6b3a" strokeWidth="1.6" aria-hidden>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
  </svg>
);
const Heart = () => (
  <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#4f6b3a" strokeWidth="1.6" aria-hidden>
    <path d="M12 21s-7-4.4-9-9.2C1.6 8 4 5 7 5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3 0 5.4 3 4 6.8-2 4.8-9 9.2-9 9.2z" />
  </svg>
);

export default function Home() {
  return (
    <div className={`${dmSans.variable} ${plexMono.variable} ${styles.page}`}>
      <div className={styles.wrap}>
        <header className={styles.nav}>
          <div className={styles.brand}><GivebackMark size={34} />giveback</div>
          <div className={styles.pills}>
            <span className={styles.pill}>Sandbox demo</span>
            <span className={styles.pill}>Built on PayPal</span>
          </div>
        </header>

        <section className={styles.hero}>
          <div>
            <div className={styles.lab}>Payments for nonprofits</div>
            <h1>The platform that gives back.</h1>
            <p className={styles.sub}>Take donations and sales with PayPal from anywhere in the world, see your cash flow, ask an AI what you can afford, and earn cashback on every dollar you raise.</p>
            <div className={styles.cta}>
              <Link href="/vendor/dashboard" target="_blank" rel="noopener" className={styles.btn}><span>Try the vendor app</span><span>⏎</span></Link>
              <Link href="/platform" target="_blank" rel="noopener" className={`${styles.btn} ${styles.ghost}`}><span>See the platform</span><span>→</span></Link>
            </div>
          </div>
          <div className={`${styles.card} ${styles.math}`}>
            <div className={styles.lab}>A {usd(SALE).replace('.00', '')} sale, where it goes</div>
            <div className={styles.row} style={{ marginTop: 10 }}><span>Supporter pays</span><span className={styles.mono}>{usd(SALE)}</span></div>
            <div className={styles.row}><span>PayPal fees ({pct(PAYPAL_RATE_BP)} + ${(PAYPAL_FIXED_USD_CENTS / 100).toFixed(2)}, plus payout)</span><span className={styles.mono}>− {usd(paypalLump)}</span></div>
            <div className={styles.row}><span>giveback ({pct(PLATFORM_RATE_BP)} + ${(PLATFORM_FIXED_USD_CENTS / 100).toFixed(2)})</span><span className={styles.mono}>− {usd(gbFee)}</span></div>
            <div className={styles.row}><b>Nonprofit receives</b><b className={styles.mono}>{usd(net)}</b></div>
            <div className={styles.rowhl}><span>Cashback at {pct(TIERS[0].rateBp)}–{pct(TIERS[TIERS.length - 1].rateBp)} of volume</span><b className={`${styles.mono} ${styles.green}`}>{cashRange}</b></div>
          </div>
        </section>

        <section className={styles.sect}>
          <div className={styles.lab}>How it works</div>
          <h2>Follow the {usd(SALE).replace('.00', '')}.</h2>
          <div className={`${styles.card} ${styles.proc}`}>
            <div className={styles.rail} aria-hidden>
              <div className={styles.railA} /><div className={styles.railB} />
              {[0, 33.3, 66.6, 100].map((p, i) => (
                <b key={p} className={`${styles.dot} ${i === 3 ? styles.g : ''}`} style={{ left: `${p}%` }}>{i + 1}</b>
              ))}
            </div>
            <div className={styles.cols}>
              <div className={styles.col}>
                <div className={styles.icon}>
                  <div className={styles.phone}><div className={styles.mono} style={{ fontWeight: 600, fontSize: 17 }}>{usd(SALE)}</div><span className={styles.stamp}>PAID</span></div>
                </div>
                <div className={styles.big}>{usd(SALE)}</div><div className={styles.cap}>Supporter pays</div>
              </div>
              <div className={styles.col}>
                <div className={styles.icon}><GivebackMark size={84} /></div>
                <div className={`${styles.big} ${styles.red}`}>− {usd(paypalLump + gbFee)}</div><div className={styles.cap}>Platform and infrastructure fees</div>
              </div>
              <div className={styles.col}>
                <div className={styles.icon}><Heart /></div>
                <div className={`${styles.big} ${styles.green}`}>{usd(net)}*</div><div className={styles.cap}>Nonprofit gets</div>
                <div className={styles.note}>* Supporter pays the fees upfront and you get all {usd(SALE).replace('.00', '')}.</div>
              </div>
              <div className={`${styles.col} ${styles.hl}`}>
                <div className={styles.icon}><Loop /></div>
                <div className={`${styles.big} ${styles.green}`}>{cashRange}</div><div className={styles.cap}>This transaction earns cashback: more coming back to you</div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.sect}>
          <div className={styles.lab}>Anywhere</div>
          <h2>Collect from supporters in any country.</h2>
          <div className={styles.globe}>
            <LandingMap />
            <div>
              <p className={styles.sub}>PayPal checkout works in 200+ markets. A mosque in Toronto can take a gift from a supporter in London, and a school in Sydney can sell tickets to families abroad. Fees and payouts are handled in each currency.</p>
              <div className={styles.chips}>{CURRENCY_CODES.map((c) => <span key={c} className={styles.chip}>{c}</span>)}</div>
            </div>
          </div>
        </section>

        <section className={`${styles.sect} ${styles.doors}`}>
          <div className={styles.door}>
            <div className={styles.lab}>For nonprofits</div>
            <h3>Example vendor: Riverside Community Kitchen</h3>
            <p>Counter, live dashboard, AI cash-flow forecast, cashback wallet, reports.</p>
            <div className={styles.tags}>{['Counter', 'Dashboard', 'Cashback', 'Reports'].map((t) => <span key={t}>{t}</span>)}</div>
            <Link href="/vendor/dashboard" target="_blank" rel="noopener" className={styles.btn} style={{ marginTop: 8 }}><span>Open the vendor app</span><span>⏎</span></Link>
          </div>
          <div className={`${styles.door} ${styles.dark}`}>
            <div className={styles.lab}>For giveback</div>
            <h3>The platform: giveback</h3>
            <p>How giveback earns pennies per payment, what it pays back, and the scale model.</p>
            <div className={styles.tags}>{['Revenue', 'Cashback paid', 'Scale model'].map((t) => <span key={t}>{t}</span>)}</div>
            <Link href="/platform" target="_blank" rel="noopener" className={`${styles.btn} ${styles.light}`} style={{ marginTop: 8 }}><span>See the economics</span><span>→</span></Link>
          </div>
        </section>

        <section className={styles.sect}>
          <div className={styles.lab}>Inside the app</div>
          <h2>Everything a director needs, in one place.</h2>
          <div className={styles.shots}>
            {SHOTS.map((s) => (
              <div key={s.title}>
                <div className={styles.shot}>
                  <div className={styles.bar}><i /><i /><i /></div>
                  <div className={styles.frame}><Image src={s.src} width={s.w} height={s.h} alt={`${s.title} screen`} unoptimized /></div>
                </div>
                <p className={styles.shotcap}><b>{s.title}.</b> {s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className={styles.foot}>
          <span>Sandbox demo: payments, fees and cashback use PayPal sandbox money. The pricing advantage is simulated.</span>
          <span>giveback · open source · MIT</span>
        </footer>
      </div>
    </div>
  );
}
