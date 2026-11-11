'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG, MAX_DONATION_CENTS, MIN_DONATION_CENTS } from '@/lib/catalog';
import { CURRENCIES, DEFAULT_CURRENCY, convertUsdCents, type CurrencyCode } from '@/lib/currency';
import { feeCoverCents } from '@/lib/fees';
import { centsToDecimal } from '@/lib/money';
import { CurrencyPicker } from './currency-picker';
import styles from './pos.module.css';

const SDK_URL = 'https://www.sandbox.paypal.com/web-sdk/v6/core';

// Minimal types for the parts of the v6 SDK we use.
type PayPalSession = {
  start: (opts: { presentationMode: string }, order: Promise<{ orderId: string }>) => Promise<void>;
};
type PayPalSdk = {
  createPayPalOneTimePaymentSession: (cbs: {
    onApprove: (data: { orderId: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (e: unknown) => void;
  }) => PayPalSession;
};
declare global {
  interface Window {
    paypal?: { createInstance: (o: Record<string, unknown>) => Promise<PayPalSdk> };
  }
}

const MAX_QTY = 100;
const money = (cents: number, cur: CurrencyCode) => `${CURRENCIES[cur].symbol}${centsToDecimal(cents)}`;

/** A bill row you can swipe left to reveal a Delete button (works with touch and mouse). */
function SwipeRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const REVEAL = 72; // delete button (56px) + 16px of breathing room before the text
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; base: number } | null>(null);

  const open = dx <= -REVEAL / 2;
  return (
    <div className={styles.swipe}>
      <button
        type="button"
        className={styles.del}
        style={{ opacity: dx < 0 ? 1 : 0 }}
        onClick={onDelete}
        tabIndex={open ? 0 : -1}
        aria-label="Delete item"
      >
        Delete
      </button>
      <div
        className={styles.swipeFront}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform .18s ease' }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, base: dx };
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          setDx(Math.max(-REVEAL, Math.min(0, start.current.base + e.clientX - start.current.x)));
        }}
        onPointerUp={() => {
          start.current = null;
          setDragging(false);
          setDx((d) => (d <= -REVEAL / 2 ? -REVEAL : 0));
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDx(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`) && window.paypal) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('could not load the PayPal SDK'));
    document.head.appendChild(s);
  });
}

export default function PosPage() {
  const [orgName, setOrgName] = useState('');
  useEffect(() => { fetch('/api/org').then((r) => r.json()).then((o) => setOrgName(o.name ?? '')).catch(() => {}); }, []);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [donationInput, setDonationInput] = useState('');
  const [donationCents, setDonationCents] = useState(0);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [coverFees, setCoverFees] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [saleNo, setSaleNo] = useState<number>();
  const [stamp, setStamp] = useState<string>(); // receipt date/time, set on the client to avoid a server/client mismatch
  const [error, setError] = useState<string>();
  const [paid, setPaid] = useState<{ cents: number; currency: CurrencyCode; name: string | null }>();
  const slot = useRef<HTMLDivElement>(null);

  const priceOf = (usdCents: number) => convertUsdCents(usdCents, currency);
  const inputCents = Math.round(Number(donationInput || 0) * 100);
  const inputValid = inputCents >= MIN_DONATION_CENTS && inputCents <= MAX_DONATION_CENTS;
  const lines = CATALOG.filter((c) => qty[c.id]);
  // Display total only. The server prices the order again from ids and quantities.
  const subtotalCents =
    lines.reduce((sum, c) => sum + priceOf(c.priceCents) * qty[c.id], 0) + donationCents;
  const feeCents = coverFees ? feeCoverCents(subtotalCents, currency) : 0;
  const totalCents = subtotalCents + feeCents;

  // The PayPal session is created once; this ref gives it the latest cart when the button is clicked.
  const orderBody = useMemo(
    () => ({
      items: lines.map((c) => ({ id: c.id, qty: qty[c.id] })),
      currency,
      ...(coverFees && subtotalCents > 0 ? { coverFees: true } : {}),
      ...(anonymous ? { anonymous: true } : {}),
      ...(donationCents > 0 ? { donationCents } : {}),
    }),
    [lines, qty, donationCents, currency, coverFees, anonymous, subtotalCents],
  );
  const bodyRef = useRef(orderBody);
  const totalRef = useRef({ cents: totalCents, currency });
  useEffect(() => {
    bodyRef.current = orderBody;
    totalRef.current = { cents: totalCents, currency };
  });

  const startReceipt = useCallback(() => {
    fetch('/api/sales/next')
      .then((r) => (r.ok ? (r.json() as Promise<{ number: number }>) : undefined))
      .catch(() => undefined)
      .then((d) => {
        setSaleNo(d?.number);
        setStamp(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
      });
  }, []);
  useEffect(() => {
    startReceipt();
  }, [startReceipt]);

  const newSale = useCallback(() => {
    startReceipt();
    setQty({});
    setDonationInput('');
    setDonationCents(0);
    setCoverFees(false);
    setAnonymous(false);
    setPaid(undefined);
  }, [startReceipt]);

  useEffect(() => {
    if (!paid) return;
    const t = setTimeout(newSale, 6000);
    return () => clearTimeout(t);
  }, [paid, newSale]);

  // Load the v6 SDK once and mount the PayPal button.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ clientToken }] = await Promise.all([
          fetch('/api/paypal/client-token').then((r) => r.json() as Promise<{ clientToken: string }>),
          loadScript(SDK_URL),
        ]);
        const sdk = await window.paypal!.createInstance({
          clientToken,
          components: ['paypal-payments'],
          pageType: 'checkout',
        });
        if (cancelled) return;

        const session = sdk.createPayPalOneTimePaymentSession({
          onApprove: async ({ orderId }) => {
            const res = await fetch(`/api/orders/${orderId}/capture`, { method: 'POST' });
            if (!res.ok) return setError('Payment approved but capture failed. Check the dashboard.');
            const { payerFirstName } = (await res.json()) as { payerFirstName: string | null };
            setPaid({ ...totalRef.current, name: payerFirstName });
          },
          onCancel: () => setError('Checkout cancelled.'),
          onError: () => setError('PayPal checkout failed. Try again.'),
        });

        const button = document.createElement('paypal-button');
        button.setAttribute('type', 'pay');
        button.addEventListener('click', () => {
          setError(undefined);
          const order = fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyRef.current),
          }).then(async (r) => {
            if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'order failed');
            const { id } = (await r.json()) as { id: string };
            return { orderId: id };
          });
          order.catch((e: Error) => setError(e.message));
          session.start({ presentationMode: 'auto' }, order).catch(() => {});
        });
        slot.current?.replaceChildren(button);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bump = (id: string, d: number) =>
    setQty((q) => ({ ...q, [id]: Math.min(MAX_QTY, Math.max(0, (q[id] ?? 0) + d)) }));

  // A custom amount was typed in the old currency, so it is cleared rather than silently relabelled.
  const changeCurrency = (next: CurrencyCode) => {
    if (next === currency) return;
    setCurrency(next);
    setDonationCents(0);
    setDonationInput('');
  };

  const addDonation = () => {
    if (!inputValid) return;
    setDonationCents((d) => Math.min(MAX_DONATION_CENTS, d + inputCents));
    setDonationInput('');
  };

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.top}>
            <CurrencyPicker value={currency} onChange={changeCurrency} />
          </div>

          <div className={styles.grid}>
            {CATALOG.map((c) => {
              const n = qty[c.id] ?? 0;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className={`${styles.item} ${n ? styles.sel : ''}`}
                  onClick={() => bump(c.id, 1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      bump(c.id, 1);
                    }
                  }}
                >
                  <span className={styles.itemName}>{c.name}</span>
                  <span className={styles.itemBottom}>
                    <span className={styles.priceWrap}>
                      <span className={styles.price}>{money(priceOf(c.priceCents), currency)}</span>
                      {n > 0 && <span className={styles.qtyTag}>×{n}</span>}
                    </span>
                    {n > 0 && (
                      <span className={styles.controls} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => bump(c.id, 1)} disabled={n >= MAX_QTY} aria-label={`Add one ${c.name}`}>
                          Add +
                        </button>
                        <button type="button" className={styles.remove} onClick={() => bump(c.id, -1)} aria-label={`Remove one ${c.name}`}>
                          Remove −
                        </button>
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.donate}>
            <span className={styles.donateLabel}>Custom amount {CURRENCIES[currency].symbol}</span>
            <input
              className={styles.mono}
              inputMode="decimal"
              placeholder={`min ${money(MIN_DONATION_CENTS, currency)}`}
              value={donationInput}
              onChange={(e) => setDonationInput(e.target.value.replace(/[^0-9.]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              aria-label="Custom donation amount"
            />
            <button type="button" className={styles.add} onClick={addDonation} disabled={!inputValid}>
              Add <span aria-hidden="true">⏎</span>
            </button>
          </div>
        </main>

        <aside className={styles.cart}>
          <div className={styles.receipt}>
            <div className={styles.rcHead}>
              <span className={styles.rcOrg}>{orgName}</span>
              <span className={styles.rcSub}>
                {saleNo ? `Sale no. ${saleNo}` : 'New sale'}
                {stamp ? ` · ${stamp}` : ''}
              </span>
            </div>
            <hr className={styles.rule} />
            <div className={styles.rcItems}>
            {subtotalCents === 0 && <p className={styles.rcEmpty}>Tap an item to start</p>}
            {lines.map((c) => (
              <SwipeRow key={c.id} onDelete={() => setQty((q) => ({ ...q, [c.id]: 0 }))}>
                <div className={`${styles.line} ${styles.mono}`}>
                  <span>
                    {qty[c.id]} {c.name}
                  </span>
                  <i />
                  <span>{centsToDecimal(priceOf(c.priceCents) * qty[c.id])}</span>
                </div>
              </SwipeRow>
            ))}
            {donationCents > 0 && (
              <SwipeRow onDelete={() => setDonationCents(0)}>
                <div className={`${styles.line} ${styles.mono}`}>
                  <span>Donation</span>
                  <i />
                  <span>{centsToDecimal(donationCents)}</span>
                </div>
              </SwipeRow>
            )}
            {feeCents > 0 && (
              <SwipeRow onDelete={() => setCoverFees(false)}>
                <div className={`${styles.line} ${styles.mono}`}>
                  <span>Admin fees</span>
                  <i />
                  <span>{centsToDecimal(feeCents)}</span>
                </div>
              </SwipeRow>
            )}
            {subtotalCents > 0 && <p className={styles.swipeHint}>Swipe a row left to remove it</p>}
            </div>
            {subtotalCents > 0 && (
              <button
                type="button"
                role="switch"
                aria-checked={coverFees}
                className={`${styles.feeBoxRow} ${coverFees ? styles.feeOn : ''}`}
                onClick={() => setCoverFees((v) => !v)}
              >
                <span className={styles.feeCheck} aria-hidden="true">
                  {coverFees ? '✓' : ''}
                </span>
                <span className={styles.feeText}>
                  <b>Cover the PayPal fee</b>
                  <small>Org keeps 100%</small>
                </span>
                <span className={styles.mono}>+{centsToDecimal(feeCoverCents(subtotalCents, currency))}</span>
              </button>
            )}
            {subtotalCents > 0 && (
              <button
                type="button"
                role="switch"
                aria-checked={anonymous}
                className={`${styles.feeBoxRow} ${anonymous ? styles.feeOn : ''}`}
                onClick={() => setAnonymous((v) => !v)}
              >
                <span className={styles.feeCheck} aria-hidden="true">
                  {anonymous ? '✓' : ''}
                </span>
                <span className={styles.feeText}>
                  <b>Give anonymously</b>
                  <small>{anonymous ? 'Shown as Anonymous on screens' : 'Your PayPal name shows on screens'}</small>
                </span>
              </button>
            )}
            <hr className={styles.rule} />
            <div className={styles.total}>
              <span className={styles.label}>Total · {currency}</span>
              <b className={styles.mono}>{money(totalCents, currency)}</b>
            </div>
            <div className={styles.rcFoot}>Thank you for giving</div>
          </div>

          {error && <p className={styles.err}>{error}</p>}
          <div
            ref={slot}
            className={styles.ppSlot}
            style={{ opacity: totalCents > 0 ? 1 : 0.4, pointerEvents: totalCents > 0 ? 'auto' : 'none' }}
          />
          <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={newSale} disabled={totalCents === 0}>
            Clear
          </button>
        </aside>
      </div>

      {paid && (
        <div className={styles.overlay} role="dialog" aria-label="Payment confirmed">
          <div className={styles.card}>
            <div className={styles.stamp}>PAID</div>
            <div className={styles.mono} style={{ fontSize: 28, fontWeight: 600 }}>
              {money(paid.cents, paid.currency)} <span className={styles.label}>{paid.currency}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{paid.name ? `Thank you, ${paid.name}!` : 'Thank you!'}</div>
            <div style={{ color: 'var(--mute)' }}>Paid with PayPal</div>
            <button type="button" className={styles.btn} onClick={newSale}>
              New sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
