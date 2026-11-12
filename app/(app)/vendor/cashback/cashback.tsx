'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { tierProgress } from '@/lib/cashback';
import { explainCheck } from '@/lib/payout-rules';
import type { CashbackAccount } from '@/lib/payouts';
import base from '../dashboard/overview.module.css';
import s from './cashback.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REASONS: Record<string, string> = {
  below_minimum: 'Your balance is below the minimum.',
  cooldown: 'The wait between payouts has not passed yet.',
  in_flight: 'A payout is already on its way.',
  no_balance: 'There is no cashback to collect yet.',
  no_recipient: 'Add a payout email in Settings.',
};
const statusClass = (st: string) => (['SUCCESS'].includes(st) ? '' : ['PENDING', 'PROCESSING', 'ONHOLD', 'UNCLAIMED'].includes(st) ? s.wait : s.bad);

export function Cashback({ account: a }: { account: CashbackAccount }) {
  const router = useRouter();
  const fmt = useMemo(() => new Intl.NumberFormat('en-CA', { style: 'currency', currency: a.currency }), [a.currency]);
  const money = (c: number) => fmt.format(c / 100);
  const date = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const pct = (bp: number) => `${(bp / 100).toFixed(2)}%`;

  const [confirm, setConfirm] = useState(false);
  const [resetAsk, setResetAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'good' | 'err'; text: string } | null>(null);

  // While a payout is on its way, re-read the page now and then (the server asks PayPal for the status).
  useEffect(() => {
    if (!a.inFlight) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [a.inFlight, router]);

  async function run(trigger: 'manual') {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/payouts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trigger }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; reason?: string; payout?: { amountCents: number } };
      if (res.ok && body.payout) setMsg({ kind: 'good', text: `${money(body.payout.amountCents)} is on its way to ${a.recipientEmail} through PayPal Payouts.` });
      else setMsg({ kind: 'err', text: body.reason ? REASONS[body.reason] ?? 'Payout not allowed.' : body.error ?? 'Payout failed.' });
    } catch {
      setMsg({ kind: 'err', text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
      setConfirm(false);
      router.refresh();
    }
  }

  async function demo(action: 'simulate_month' | 'reset') {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      if (res.ok) setMsg({ kind: 'good', text: action === 'reset' ? 'Demo data reset to the original seed. PayPal sandbox data was not changed.' : 'A month passed: sample payments were added to this month and earlier payouts moved 30 days back, so you can collect again.' });
      else setMsg({ kind: 'err', text: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not complete that.' });
    } catch {
      setMsg({ kind: 'err', text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
      setResetAsk(false);
      router.refresh();
    }
  }

  const t = a.totals;
  const monthKey = `${a.year}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  const cur = a.months.find((m) => m.month === monthKey);
  const prog = tierProgress(cur?.volumeCents ?? 0, cur?.count ?? 0);
  const filled = Math.round(prog.fraction * 30);
  const competitorBp = t.volumeCents ? ((t.volumeCents - t.competitorKeepCents) / t.volumeCents) * 10_000 : 0;
  const maxCb = Math.max(1, ...a.months.map((m) => m.cashbackCents));
  const best = a.months.reduce<(typeof a.months)[number] | null>((b, m) => (!b || m.cashbackCents > b.cashbackCents ? m : b), null);
  const byMonth = new Map(a.months.map((m) => [m.month, m]));
  const monthsWithVolume = a.months.length;
  const reason = a.check.ok ? '' : explainCheck(a.check, money, date);
  const minMet = a.balanceCents >= a.minCents;
  const waitClear = !(!a.check.ok && a.check.reason === 'cooldown');

  const rows = [
    { k: 'Raised', v: t.volumeCents, sign: '', cls: '', tip: 'Everything supporters paid this year, in your currency.' },
    { k: 'Admin fee', v: t.feeCents, sign: '−', cls: '', tip: "PayPal's fee (2.89% + $0.30) plus giveback's platform fee (1.25% + $0.10) on those payments." },
    { k: 'Cashback', v: t.cashbackCents, sign: '+', cls: base.good, tip: 'Volume cashback earned each month, paid to your PayPal account when you collect it.' },
    { k: 'You keep', v: t.keepCents, sign: '', cls: base.keep, tip: 'Raised − admin fee + cashback.' },
  ];

  return (
    <div className={base.root}>
      <div className={base.wrap}>
        <div className={s.head}>
          <div><div className={base.label}>{a.year} · year to date</div><h1>Cashback</h1></div>
          <div className={base.label} style={{ textTransform: 'none' }}>Cashback is simulated in the sandbox; the payout itself is a real PayPal Payouts call.</div>
        </div>

        {msg && <div className={`${s.banner} ${msg.kind === 'good' ? s.good : s.err}`} role="status">{msg.text}</div>}

        <div className={s.top}>
          <section className={base.card} style={{ padding: 22 }}>
            <div className={base.label}>This year with giveback</div>
            <div className={s.headline}>Your volume earned you <span className={base.good}>{money(t.freeMoneyCents)}</span> in free money.</div>
            <div className={s.flow}>
              <div className={s.box}><div className={base.label}>Raised</div><b>{money(t.volumeCents)}</b></div><span className={s.arrow}>→</span>
              <div className={`${s.box} ${s.fee}`}><div className={base.label}>Admin fee</div><b className={s.neg}>−{money(t.feeCents)}</b></div><span className={s.arrow}>→</span>
              <div className={s.box}><div className={base.label}>Cashback</div><b className={base.good}>+{money(t.cashbackCents)}</b></div><span className={s.arrow}>→</span>
              <div className={`${s.box} ${s.keep}`}><div className={base.label}>You keep</div><b>{money(t.keepCents)}</b></div>
            </div>
            <div className={base.sub} style={{ marginTop: 12 }}>
              Free money = cashback {money(t.cashbackCents)} + admin fees your supporters covered {money(t.feeCoveredCents)}.
              {' '}Effective fee rate after cashback: <b className={base.mono}>{pct(t.effectiveFeeBp)}</b> vs about <b className={base.mono}>{pct(competitorBp)}</b> on a typical platform (illustrative).
            </div>
            <div className={base.label} style={{ marginTop: 18 }}>
              Tier {prog.current.name} · {pct(cur?.rateBp ?? prog.current.rateBp)}
              {prog.next ? ` · raise ${money(prog.toNextCents)} more this month to reach ${pct(prog.next.rateBp)}, about ${money(prog.nextGainCents)} more cashback` : ' · top tier'}
            </div>
            <div className={base.bar} aria-label="Tier progress">{Array.from({ length: 30 }, (_, i) => <i key={i} className={i < filled ? base.f : ''} />)}</div>
            <div className={base.cbStats} style={{ marginBottom: 0 }}>
              <div><div className={base.sub}>Payments this year</div><div className={base.big}>{t.count.toLocaleString('en-CA')}</div></div>
              <div><div className={base.sub}>Avg cashback per payment</div><div className={base.big}>{money(t.count ? Math.round(t.cashbackCents / t.count) : 0)}</div></div>
              <div><div className={base.sub}>Best month</div><div className={base.big}>{best ? `${MONTHS[Number(best.month.slice(5, 7)) - 1]} · ${money(best.cashbackCents).replace(/\.00$/, '')}` : '–'}</div></div>
            </div>
          </section>

          <aside className={s.wallet}>
            <div className={base.label}>Cashback balance · {a.balanceCents > 0 ? 'ready to collect' : 'nothing to collect'}</div>
            <div className={s.walletBig}>{money(a.balanceCents)}<small>{a.currency}</small></div>
            <div className={s.walletNote}>{monthsWithVolume} month{monthsWithVolume === 1 ? '' : 's'} of volume. Paid by giveback to your PayPal account <b>{a.recipientEmail ?? '(none set)'}</b>.</div>
            <button className={s.collect} disabled={!a.check.ok || busy} onClick={() => setConfirm(true)}><span>Collect cashback</span><span>⏎</span></button>
            <div className={s.why}>{reason}{reason && a.check.ok === false && a.check.reason === 'cooldown' ? ' (sandbox: “Add a month of sample activity” moves the clock forward 30 days)' : ''}</div>
            <a className={s.ghost} href="/api/reports/year-end"><span>Year-end report PDF</span><span>↓</span></a>
            <div className={s.rules}>
              <span className={minMet ? s.ok : ''}>{minMet ? '✓' : '○'} Minimum {money(a.minCents)}</span>
              <span className={waitClear ? s.ok : ''}>{waitClear ? '✓' : '○'} {a.cooldownDays}-day wait between payouts{waitClear ? ' clear' : ''}</span>
            </div>
            <div className={s.demo}>
              <button className={s.sim} disabled={busy} onClick={() => void demo('simulate_month')} title="Sandbox only: inserts realistic sample payments for the current month, so you can reach the minimum and test the payout.">Add a month of sample activity (sandbox)</button>
              {resetAsk ? (
                <div className={s.resetAsk}>
                  <div>Clears sample and test payments, settlements, cashback payouts, sponsor invoices and Counter items, then restores the original seed.</div>
                  <div><b>This does not reset PayPal.</b> Sandbox balances and transactions stay and must be cleared by hand in PayPal&rsquo;s developer dashboard.</div>
                  <div className={s.resetBtns}>
                    <button className={s.sim} disabled={busy} onClick={() => void demo('reset')}>Yes, reset demo data</button>
                    <button className={s.sim} disabled={busy} onClick={() => setResetAsk(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className={s.sim} disabled={busy} onClick={() => setResetAsk(true)}>Reset demo data (sandbox)</button>
              )}
              <div className={s.simNote}>Sample data only. PayPal sandbox balances and transactions are not reset; do that by hand in PayPal&rsquo;s developer dashboard.</div>
            </div>
          </aside>
        </div>

        <div className={s.mid}>
          <section className={base.card}>
            <div className={base.chartHead}><div className={base.label}>Where your money goes · {a.year} to date</div><div className={base.label} style={{ textTransform: 'none' }}>illustrative</div></div>
            <div style={{ marginTop: 6 }}>
              {rows.map((r) => (
                <div key={r.k} className={`${base.row} ${base.hov} ${r.cls === base.keep ? base.keep : ''}`} title={r.tip} tabIndex={0}>
                  <i className={base.share} style={{ width: `${t.volumeCents ? Math.max(1.5, (r.v / t.volumeCents) * 100) : 0}%` }} />
                  <span>{r.k}</span><span className={`${base.mono} ${r.cls === base.good ? base.good : ''}`}>{r.sign}{money(r.v)}</span>
                </div>
              ))}
            </div>
            <div className={base.sub} style={{ marginTop: 6 }}>Supporters covered {money(t.feeCoveredCents)} of the fee (already part of Raised).</div>
            <div className={base.vs}>Typical platform (2.9% + $0.30 + 1% platform fee): you would keep <b>{money(t.competitorKeepCents)}</b> →
              {' '}you keep <b className={base.good}>{money(t.keepCents - t.competitorKeepCents)} more</b></div>
          </section>

          <section className={base.card}>
            <div className={base.chartHead}><div className={base.label}>Cashback by month</div><div className={base.label} style={{ textTransform: 'none' }}>amount earned · tier reached</div></div>
            <div className={s.months}>
              {MONTHS.map((name, i) => {
                const m = byMonth.get(`${a.year}-${String(i + 1).padStart(2, '0')}`);
                return (
                  <div key={name} className={`${s.col} ${m ? '' : s.empty}`} title={m ? `${name}: ${money(m.cashbackCents)} (${m.tier}, ${pct(m.rateBp)})` : `${name}: no payments yet`}>
                    {m && <em>{money(m.cashbackCents).replace(/\.00$/, '')}</em>}
                    <b style={{ height: m ? `${Math.max(2, (m.cashbackCents / maxCb) * 78)}%` : 0 }} />
                    <span>{name}</span>
                    <i>{m ? m.tier : ''}</i>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className={base.card}>
          <div className={base.chartHead}><div className={base.label}>Payout log</div><div className={base.label} style={{ textTransform: 'none' }}>live status from PayPal · {a.cooldownDays} days between payouts</div></div>
          {a.payouts.length === 0 ? (
            <div className={s.empty}>No payouts yet. Collect your cashback above.</div>
          ) : (
            <div className={s.scroll}>
              <table className={s.table}>
                <thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Sent to</th><th>PayPal batch</th><th>Status</th><th>Invoice</th></tr></thead>
                <tbody>
                  {a.payouts.map((p) => (
                    <tr key={p.id}>
                      <td className={base.mono}>{date(p.createdAt)}</td>
                      <td className={base.mono}>{money(p.amountCents)}</td>
                      <td>{p.trigger === 'year_end' ? 'Year-end' : 'Manual'}</td>
                      <td className={base.mono} style={{ fontSize: 12 }}>{p.recipientEmail}</td>
                      <td className={base.mono} style={{ fontSize: 12 }} title={p.error ?? undefined}>{p.paypalBatchId ?? '–'}</td>
                      <td><span className={`${s.status} ${statusClass(p.status)}`}>{p.status === 'SUCCESS' ? 'Success' : p.status.toLowerCase()}</span></td>
                      <td>{p.status === 'SUCCESS' ? <a className={s.inv} href={`/api/payouts/${p.id}/invoice`} target="_blank" rel="noopener noreferrer">PDF ↗</a> : <span className={base.sub}>after success</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {confirm && (
        <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Confirm payout" onClick={() => !busy && setConfirm(false)}>
          <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={base.label}>Confirm payout</div>
            <h2>Send {money(a.balanceCents)} to your PayPal account?</h2>
            <dl>
              <div><dt>Amount</dt><dd>{money(a.balanceCents)} {a.currency}</dd></div>
              <div><dt>To</dt><dd>{a.recipientEmail}</dd></div>
              <div><dt>From</dt><dd>giveback (PayPal Payouts)</dd></div>
              <div><dt>Next payout</dt><dd>in {a.cooldownDays} days</dd></div>
            </dl>
            <div className={base.sub}>This moves real sandbox money through PayPal. It cannot be undone from here.</div>
            <div className={base.actions} style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className={base.btn} onClick={() => setConfirm(false)} disabled={busy}>Cancel</button>
              <button className={`${base.btn} ${base.p}`} onClick={() => void run('manual')} disabled={busy}>{busy ? 'Sending…' : 'Confirm payout'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
