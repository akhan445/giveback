'use client';

import { useState } from 'react';
import { MAX_DONATION_CENTS, MIN_DONATION_CENTS } from '@/lib/catalog';
import { feeCoverCents } from '@/lib/fees';
import { CURRENCIES, type CurrencyCode } from '@/lib/currency';
import { centsToDecimal } from '@/lib/money';
import styles from '../pay.module.css';

const PRESETS = [10, 25, 50, 100]; // whole units of the organization's currency

export function DonateForm({ org, goalName, currency, unit, unitCents }: { org: string; goalName: string; currency: CurrencyCode; unit: string; unitCents: number }) {
  const symbol = CURRENCIES[currency].symbol;
  const [preset, setPreset] = useState<number | null>(25);
  const [custom, setCustom] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [coverFees, setCoverFees] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const cents = preset !== null ? preset * 100 : Math.round(Number(custom || 0) * 100);
  const valid = cents >= MIN_DONATION_CENTS && cents <= MAX_DONATION_CENTS;
  const count = Math.floor(cents / unitCents);
  const cover = valid ? feeCoverCents(cents, currency) : 0; // the server recomputes this; the client only shows it
  const total = cents + (coverFees ? cover : 0);

  async function donate() {
    if (!valid) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationCents: cents, currency, phone: true, from: 'donate', ...(coverFees ? { coverFees: true } : {}), ...(anonymous ? { anonymous: true } : {}) }),
      });
      const data = (await res.json()) as { approveUrl?: string; error?: string };
      if (!res.ok || !data.approveUrl) throw new Error(data.error ?? 'Could not start the payment');
      window.location.assign(data.approveUrl); // PayPal, then back to /pay/return
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className={styles.root}>
      <div className={styles.card} style={{ alignItems: 'stretch', textAlign: 'left' }}>
        <span className={styles.org} style={{ textAlign: 'center' }}>{org}</span>
        <h1 className={styles.thanks} style={{ margin: '4px 0 0', textAlign: 'center' }}>{goalName}</h1>
        <p className={styles.note} style={{ textAlign: 'center', alignSelf: 'center' }}>Choose an amount and pay with PayPal. No account needed on this page.</p>

        <div className={styles.amounts} role="group" aria-label="Amount">
          {PRESETS.map((n) => (
            <button key={n} type="button" className={`${styles.amt} ${preset === n ? styles.on : ''}`} onClick={() => { setPreset(n); setCustom(''); }}>
              {symbol}{n}
            </button>
          ))}
        </div>
        <label className={styles.customRow}>
          <span>Other amount {symbol}</span>
          <input
            inputMode="decimal"
            placeholder={`min ${symbol}${centsToDecimal(MIN_DONATION_CENTS)}`}
            value={custom}
            onChange={(e) => { setCustom(e.target.value.replace(/[^0-9.]/g, '')); setPreset(null); }}
            onFocus={() => setPreset(null)}
          />
        </label>

        {valid && count > 0 && <p className={styles.note} style={{ textAlign: 'center', alignSelf: 'center' }}>{symbol}{centsToDecimal(cents)} pays for about {count.toLocaleString('en-CA')} {unit}.</p>}

        <button type="button" role="switch" aria-checked={coverFees} className={`${styles.switch} ${coverFees ? styles.on : ''}`} onClick={() => setCoverFees((v) => !v)}>
          <span className={styles.box} aria-hidden="true">{coverFees ? '✓' : ''}</span>
          <span><b>Cover the admin fee{valid ? ` (+${symbol}${centsToDecimal(cover)})` : ''}</b><small>{org} keeps 100% of your gift</small></span>
        </button>

        <button type="button" role="switch" aria-checked={anonymous} className={`${styles.switch} ${anonymous ? styles.on : ''}`} onClick={() => setAnonymous((v) => !v)}>
          <span className={styles.box} aria-hidden="true">{anonymous ? '✓' : ''}</span>
          <span><b>Give anonymously</b><small>{anonymous ? 'Shown as Anonymous on the screen' : 'Your PayPal name shows on the screen'}</small></span>
        </button>

        {error && <p className={`${styles.note} ${styles.bad}`} role="alert" style={{ alignSelf: 'center', textAlign: 'center' }}>{error}</p>}
        <button type="button" className={styles.go} onClick={donate} disabled={!valid || busy}>
          {busy ? 'Opening PayPal…' : valid ? `Donate ${symbol}${centsToDecimal(total)} with PayPal` : 'Enter an amount'}
        </button>
      </div>
    </main>
  );
}
