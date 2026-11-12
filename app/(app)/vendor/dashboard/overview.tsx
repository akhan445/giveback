'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TIERS } from '@/lib/cashback';
import type { InvoiceProposal } from '@/lib/chat-tools';
import type { SponsorRow } from '@/lib/sponsors';
import { convertUsdCents } from '@/lib/currency';
import { eventCard, reserveCard, type Card } from '@/lib/insight-text';
import type { Overview as OverviewData } from '@/lib/overview';
import { ORG_TYPES } from '@/lib/org';
import styles from './overview.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function Overview({ data, sponsors }: { data: OverviewData; sponsors: SponsorRow[] }) {
  const router = useRouter();
  const fmt = useMemo(() => new Intl.NumberFormat('en-CA', { style: 'currency', currency: data.currency }), [data.currency]);
  const fmt0 = useMemo(() => new Intl.NumberFormat('en-CA', { style: 'currency', currency: data.currency, maximumFractionDigits: 0 }), [data.currency]);
  const money = (c: number) => fmt.format(c / 100);
  const money0 = (c: number) => fmt0.format(c / 100);
  const pct = (bp: number) => `${(bp / 100).toFixed(2)}%`;

  const m = data.month;
  const monthName = FULL_MONTHS[Number(m.key.slice(5, 7)) - 1];
  const youKeep = m.volumeCents - m.feeCents + m.cashbackCents;
  // Illustrative competitor: 2.9% + $0.30 + a 1% platform fee (labelled as an assumption).
  const competitorFee = Math.round(m.volumeCents * 0.039) + m.count * convertUsdCents(30, data.currency);
  const competitorKeeps = m.volumeCents - competitorFee;
  const typicalBp = m.volumeCents ? (competitorFee / m.volumeCents) * 10_000 : 0;
  const vsLastYear = m.lastYearCents == null ? null : m.volumeCents - m.lastYearCents;

  const [dismissed, setDismissed] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [open, setOpen] = useState<string | null>(null);
  const [barHover, setBarHover] = useState(false);
  const [barX, setBarX] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const chat = useChat();
  const allCards: Card[] = [
    ...data.opportunities.map((o) => eventCard(o, money0)),
    ...(data.reserve ? [reserveCard(data.reserve, money0)] : []),
  ];
  const live = allCards.filter((c) => !dismissed.includes(c.id));
  const tags = [...new Set(live.map((c) => c.tag))];
  const activeFilter = filter === 'All' || tags.includes(filter) ? filter : 'All';
  const cards = activeFilter === 'All' ? live : live.filter((c) => c.tag === activeFilter);
  // The few numbers behind a card, shown under "Why this?".
  const evidence = (c: Card): { label: string; cents: number }[] => {
    const ev = data.opportunities.find((o) => o.id === c.id);
    if (ev) {
      const mm = ev.start.slice(5, 7);
      return data.monthly.filter((x) => x.month.endsWith(`-${mm}`) && x.month < data.month.key).map((x) => ({ label: x.month, cents: x.cents }));
    }
    if (c.id === 'reserve' && data.reserve) {
      return [...data.reserve.peakMonths, ...data.reserve.lowMonths].sort((a, b) => a - b).map((mo) => ({ label: `${MONTHS[mo - 1]} (${data.reserve!.peakMonths.includes(mo) ? 'peak' : 'low'})`, cents: data.chart[mo - 1].typicalCents }));
    }
    return [];
  };

  const askAbout = (text: string) => { setChatOpen(true); void chat.send(text); };

  return (
    <div className={`${styles.root} ${chatOpen ? styles.withChat : ''}`}>
      <div className={styles.wrap}>
        <section className={styles.kpis}>
          <div className={styles.card}><div className={styles.label}>Today</div><div className={styles.big}>{money(data.today.volumeCents)}</div><div className={styles.sub}>{data.today.count} payments</div></div>
          <div className={styles.card}><div className={styles.label}>Raised in {monthName}</div><div className={styles.big}>{money0(m.volumeCents)}</div>
            <div className={`${styles.sub} ${vsLastYear != null && vsLastYear >= 0 ? styles.good : ''}`}>{vsLastYear == null ? `${m.count} payments` : `${vsLastYear >= 0 ? '+' : '−'}${money0(Math.abs(vsLastYear))} vs same days last ${monthName}`}</div></div>
          <div className={styles.card}><div className={styles.label}>Cashback earned</div><div className={styles.big}>{money(m.cashbackCents)}</div><div className={styles.sub}>{pct(m.rateBp)} · {m.tier} tier</div></div>
          <div className={styles.card}><div className={styles.label}>Effective fee rate</div><div className={styles.big}>{pct(m.effectiveFeeBp)}</div>
            <div className={`${styles.sub} ${styles.good}`}>vs {pct(typicalBp)} typical ·{' '}
              <span className={styles.tip} title={`(admin fee ${money(m.feeCents)} − fees covered by supporters ${money(m.feeCoveredCents)} − cashback ${money(m.cashbackCents)}) ÷ ${money(m.volumeCents)} raised`}>formula ⓘ</span></div></div>
        </section>

        <div className={styles.cols}>
          <div className={styles.stack}>
            <section className={styles.card}>
              <div className={styles.chartHead}><div className={styles.label}>Where your money goes · {monthName}</div><div className={styles.label} style={{ textTransform: 'none' }}>illustrative</div></div>
              <div style={{ marginTop: 6 }}>
                {[
                  { k: 'Raised', v: m.volumeCents, sign: '', tip: 'Everything supporters paid this month, in your currency.', cls: '' },
                  { k: 'Admin fee', v: m.feeCents, sign: '−', tip: "PayPal's fee (2.89% + $0.30) plus giveback's platform fee (1.25% + $0.10) on those payments.", cls: '' },
                  { k: 'Cashback', v: m.cashbackCents, sign: '+', tip: 'Volume cashback on this month’s total, paid to your PayPal account monthly (simulated in the sandbox).', cls: styles.good },
                  { k: 'You keep', v: youKeep, sign: '', tip: 'Raised − admin fee + cashback.', cls: styles.keep },
                ].map((r) => (
                  <div key={r.k} className={`${styles.row} ${styles.hov} ${r.cls === styles.keep ? styles.keep : ''}`} title={r.tip} tabIndex={0}>
                    <i className={styles.share} style={{ width: `${m.volumeCents ? Math.max(1.5, (r.v / m.volumeCents) * 100) : 0}%` }} />
                    <span>{r.k}</span><span className={`${styles.mono} ${r.cls === styles.good ? styles.good : ''}`}>{r.sign}{money(r.v)}</span>
                  </div>
                ))}
              </div>
              <div className={styles.sub} style={{ marginTop: 6 }}>Supporters covered {money(m.feeCoveredCents)} of the fee (already part of Raised).</div>
              <div className={styles.vs}>Typical platform (2.9% + $0.30 + 1% platform fee): you would keep <b>{money(competitorKeeps)}</b> →
                {' '}you keep <b className={styles.good}>{money(youKeep - competitorKeeps)} more</b></div>
            </section>

            <section className={styles.card}>
              <div className={styles.chartHead}><div className={styles.label}>Cashback · {monthName}</div><div className={styles.label} style={{ textTransform: 'none' }}>simulated in sandbox</div></div>
              <div className={styles.cbStats}>
                <div><div className={styles.sub}>So far this month</div><div className={`${styles.big} ${styles.good}`}>{money(data.cashbackSummary.monthCents)}</div></div>
                <div><div className={styles.sub}>Year to date</div><div className={styles.big}>{money(data.cashbackSummary.yearToDateCents)}</div></div>
                <div><div className={styles.sub}>Avg cashback per transaction</div><div className={styles.big}>{money(data.cashbackSummary.perPaymentCents)}</div></div>
              </div>
              <div className={styles.tierStack}>
                {TIERS.map((t) => (
                  <div key={t.name} className={t.name === data.tier.current.name ? styles.tierOn : styles.tierOff}>
                    {t.name} {pct(t.rateBp)} {t.fromCents === 0 ? 'from $0' : `at ${money0(t.fromCents)}`}
                  </div>
                ))}
              </div>
              <div className={styles.barWrap} tabIndex={0}
                onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setBarX(Math.min(Math.max(e.clientX - r.left, 235), Math.max(235, r.width - 235))); }}
                onMouseEnter={() => setBarHover(true)} onMouseLeave={() => setBarHover(false)}
                onFocus={() => { setBarX(235); setBarHover(true); }} onBlur={() => setBarHover(false)}>
                <div className={styles.bar}>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.round(data.tier.fraction * 10) ? styles.f : ''} />)}</div>
                {barHover && <div className={styles.barTip} style={{ left: barX }}>{data.tier.next
                  ? `${money0(m.volumeCents)} of ${money0(data.tier.next.fromCents)} · ${Math.round((m.volumeCents / data.tier.next.fromCents) * 100)}% of the way to ${data.tier.next.name} · ${money0(data.tier.toNextCents)} to go`
                  : `${money0(m.volumeCents)} raised · top tier reached`}</div>}
              </div>
              <div className={styles.sub}>{data.tier.next
                ? <>Raise <b style={{ color: 'var(--ink)' }}>{money0(data.tier.toNextCents)} more</b> this month and cashback goes {pct(data.tier.current.rateBp)} → {pct(data.tier.next.rateBp)}: about <b className={styles.good}>+{money0(data.tier.nextGainCents)}</b> more this month.</>
                : 'Top tier reached. Every dollar earns the best cashback rate.'}</div>
              <div className={styles.vs}>The cashback advantage: you get back an average of <b className={styles.good}>{money(data.cashbackSummary.perPaymentCents)}</b> per transaction, <b className={styles.good}>{money(data.cashbackSummary.per100Cents)}</b> on every $100 raised. A typical platform gives back $0, so your fees fall from {pct(typicalBp)} to <b>{pct(m.effectiveFeeBp)}</b>.</div>
            </section>

            <SponsorInvoices sponsors={sponsors} money={money} onAsk={askAbout} />

            <HistoryChart data={data} money0={money0} onAsk={askAbout} />
          </div>

          <div className={styles.stack}>
            <div>
              <div className={styles.aiHead}>
                <div className={styles.label}>AI opportunities</div>
                <div className={styles.sub}>Tailored for <b style={{ color: 'var(--ink)' }}>{ORG_TYPES[data.org.orgType]}</b> · <Link href="/vendor/settings" style={{ color: 'inherit' }}>change</Link></div>
              </div>
              <div className={styles.chipsRow} role="tablist" aria-label="Filter opportunities">
                {['All', ...tags].map((t) => (
                  <button key={t} role="tab" aria-selected={activeFilter === t} className={`${styles.tag} ${styles.fchip} ${t === 'Smoothing' ? styles.red : t === 'All' ? styles.neutral : ''} ${activeFilter === t ? styles.fon : ''}`} onClick={() => setFilter(t)}>
                    {t} {t === 'All' ? live.length : live.filter((c) => c.tag === t).length}
                  </button>
                ))}
                {dismissed.length > 0 && <button className={styles.link} onClick={() => setDismissed([])}>Restore {dismissed.length} dismissed</button>}
              </div>
              <div className={styles.opps}>
                {cards.length === 0 && <div className={styles.card}><span className={styles.sub}>No new opportunities right now.</span></div>}
                {cards.map((c) => (
                  <article key={c.id} className={styles.opp}>
                    <span className={`${styles.tag} ${c.tone === 'amber' ? styles.amber : c.tone === 'red' ? styles.red : ''}`}>{c.tag}</span>
                    <h4>{c.title}</h4><p>{c.body}</p>
                    {open === c.id && (() => {
                      const rows = evidence(c); const mx = Math.max(1, ...rows.map((r) => r.cents));
                      return <div className={styles.why}><div className={styles.label}>The numbers behind this</div>
                        {rows.map((r) => <div key={r.label} className={styles.whyRow}><span className={styles.mono}>{r.label}</span><i><b style={{ width: `${(r.cents / mx) * 100}%` }} /></i><span className={styles.mono}>{money0(r.cents)}</span></div>)}
                        <div className={styles.sub}>From your own payment history. Dates come from a fixed calendar, not the AI.</div></div>;
                    })()}
                    <div className={styles.actions}>
                      <button className={`${styles.btn} ${styles.p}`} onClick={() => askAbout(`${c.action}: ${c.title}`)}>{c.action}</button>
                      <button className={styles.link} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide numbers' : 'Why this?'}</button>
                      <button className={styles.link} onClick={() => askAbout(`Tell me more about: ${c.title}`)}>Ask about this</button>
                      <button className={styles.link} onClick={() => setDismissed((d) => [...d, c.id])}>Dismiss</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            {!chatOpen && <Chat chat={chat} money={money} onSent={() => router.refresh()} onExpand={() => setChatOpen(true)} />}
          </div>
        </div>
      </div>

      {chatOpen && (
        <aside className={styles.drawer}>
          <Chat chat={chat} side money={money} onSent={() => router.refresh()} onExpand={() => setChatOpen(false)} />
        </aside>
      )}
    </div>
  );
}

// --- History chart ------------------------------------------------------------------

function HistoryChart({ data, money0, onAsk }: { data: OverviewData; money0: (c: number) => string; onAsk: (q: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const W = 760, H = 400, pl = 56, pb = 34, pt = 74;
  const maxVal = Math.max(1, ...data.chart.map((c) => Math.max(c.typicalCents, c.actualCents ?? 0, c.projectedCents ?? 0)));
  const step = [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000].map((v) => v * 100).find((v) => maxVal / v <= 5) ?? maxVal;
  const top = Math.ceil(maxVal / step) * step;
  const bw = (W - pl) / 12;
  const X = (i: number) => pl + bw * i + bw / 2;
  const Y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const actual = data.chart.map((c, i) => (c.actualCents != null ? { i, x: X(i), y: Y(c.actualCents) } : null)).filter(Boolean) as { i: number; x: number; y: number }[];
  const cur = data.chart.findIndex((c) => c.partialCents != null || (c.projectedCents != null && c.actualCents == null));
  const proj = data.chart.map((c, i) => (c.projectedCents != null && i >= Math.max(0, cur) ? { i, x: X(i), y: Y(c.projectedCents) } : null)).filter(Boolean) as { i: number; x: number; y: number }[];
  const dash = actual.length && proj.length ? [actual[actual.length - 1], ...proj] : proj;
  const p = data.projection;
  const growthPct = p.lastYearCents > 0 ? Math.round((p.projectedCents / p.lastYearCents - 1) * 100) : null;

  const valueOf = (i: number) => { const c = data.chart[i]; return c.actualCents ?? c.projectedCents ?? c.partialCents; };
  const kindOf = (i: number) => (data.chart[i].actualCents != null ? 'this year' : 'projected');
  const fmtDay = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
  const range = (e: { start: string; end: string }) => (e.start === e.end ? fmtDay(e.start) : `${fmtDay(e.start)} – ${fmtDay(e.end)}`);
  // Events that touch month i (a break that spans several months shows in each of them).
  const eventsIn = (i: number) => data.events.filter((e) => {
    const s0 = Number(e.start.slice(0, 4)) * 12 + Number(e.start.slice(5, 7)) - 1;
    const e0 = Number(e.end.slice(0, 4)) * 12 + Number(e.end.slice(5, 7)) - 1;
    for (let k = s0; k <= e0; k++) if (k % 12 === i) return true;
    return false;
  });
  const active = hover ?? picked;

  return (
    <section className={styles.card}>
      <div className={styles.chartHead}>
        <div className={styles.label}>Raised by month · this year vs past years avg</div>
        <div className={styles.legend}><span style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 0, height: 14, borderLeft: '2px dashed var(--red)' }} />seasonal markers</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4f6b3a' }} />this year</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 10, background: '#d9e1c6' }} />past years avg</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fcfcf9', border: '2px solid #4f6b3a', boxSizing: 'border-box' }} />projection</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Raised by month" style={{ fontFamily: 'var(--gb-mono), monospace', fontSize: 12, fill: '#6b7563' }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={pl} x2={W} y1={Y(t)} y2={Y(t)} stroke="#dfe3d3" /><text x={0} y={Y(t) + 4}>{money0(t)}</text></g>)}
        {data.chart.map((c, i) => (
          <g key={c.month}>
            <rect x={X(i) - bw * 0.32} y={Y(c.typicalCents)} width={bw * 0.64} height={Math.max(0, Y(0) - Y(c.typicalCents))} rx={2}
              fill={picked === i ? '#a9bd8a' : active === i ? '#cfdab6' : '#e1e7d2'} />
            <text x={X(i)} y={H - 10} textAnchor="middle" fontWeight={active === i ? 700 : 400} fill={active === i ? '#25301f' : undefined}>{MONTHS[i]}</text>
          </g>
        ))}
        {data.markers.map((mk, k) => (
          <g key={mk.month}>
            <line x1={X(mk.month - 1)} x2={X(mk.month - 1)} y1={pt - 14 - (k % 3) * 14 + 4} y2={Y(0)} stroke="#9b1c1c" strokeDasharray="2 3" opacity={0.45} />
            <text x={X(mk.month - 1)} y={pt - 16 - (k % 3) * 14} textAnchor={mk.month >= 11 ? 'end' : mk.month <= 2 ? 'start' : 'middle'} fill="#9b1c1c" fontSize={11}>{mk.label}</text>
          </g>
        ))}
        {actual.length > 1 && <polyline fill="none" stroke="#4f6b3a" strokeWidth={2.5} points={actual.map((q) => `${q.x},${q.y}`).join(' ')} />}
        {dash.length > 1 && <polyline fill="none" stroke="#4f6b3a" strokeWidth={2} strokeDasharray="4 4" points={dash.map((q) => `${q.x},${q.y}`).join(' ')} />}
        {actual.map((q) => <circle key={q.i} cx={q.x} cy={q.y} r={active === q.i ? 6 : 4} fill="#4f6b3a" />)}
        {proj.map((q) => <circle key={q.i} cx={q.x} cy={q.y} r={active === q.i ? 6 : 4} fill="#fcfcf9" stroke="#4f6b3a" strokeWidth={2} />)}
        {picked != null && valueOf(picked) != null && (
          <text x={X(picked)} y={Y(Math.max(valueOf(picked) ?? 0, data.chart[picked].typicalCents)) - 10} textAnchor={picked >= 11 ? 'end' : 'middle'} fontWeight={700} fontSize={13} fill="#25301f">{money0(valueOf(picked) ?? 0)}</text>
        )}
        {data.chart.map((c, i) => (
          <rect key={`hit${c.month}`} x={pl + bw * i} y={pt - 6} width={bw} height={H - pt - pb + 6} fill="transparent" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(i)} onClick={() => setPicked(picked === i ? null : i)} />
        ))}
        {hover != null && (() => {
          const lines: { t: string; c: string; w?: number }[] = [
            { t: FULL_MONTHS[hover], c: '#fbfcf7', w: 700 },
            { t: `${kindOf(hover)}: ${valueOf(hover) != null ? money0(valueOf(hover) ?? 0) : '–'}`, c: '#fbfcf7' },
            { t: `Past years avg: ${money0(data.chart[hover].typicalCents)}`, c: '#c9d4b6' },
            ...eventsIn(hover).map((e) => ({ t: `${e.name} · ${range(e)}`, c: '#f2b8b8' })),
          ];
          const tipW = Math.min(W - 8, Math.max(...lines.map((l) => l.t.length)) * 7.4 + 26); // sized to the longest line
          const tipH = lines.length * 18 + 16;
          const px = X(hover);
          const py = Y(Math.max(valueOf(hover) ?? 0, data.chart[hover].typicalCents));
          let tx = Math.min(W - tipW - 4, Math.max(2, px - tipW / 2));
          // Normally above the pinned amount label (about 38px over the highest mark). With no room
          // above (a tall month), it moves beside the point instead of covering it.
          let ty = py - tipH - 38;
          if (ty < 4) {
            ty = Math.max(4, Math.min(H - pb - tipH, py - tipH / 2));
            tx = px > W / 2 ? Math.max(2, px - tipW - 66) : px + 66; // clear of the pinned amount label
          }
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={tipW} height={tipH} rx={8} fill="#25301f" />
              {lines.map((l, k) => <text key={k} x={tx + 13} y={ty + 20 + k * 18} fill={l.c} fontWeight={l.w}>{l.t}</text>)}
            </g>
          );
        })()}
      </svg>
      {picked != null ? (
        <div className={styles.pickBar}>
          <span><b>{FULL_MONTHS[picked]}</b> · {kindOf(picked)} {money0(valueOf(picked) ?? 0)} · past years avg {money0(data.chart[picked].typicalCents)}
            {eventsIn(picked).map((e) => <span key={e.name + e.start} style={{ display: 'block', color: 'var(--red)', fontSize: 12 }}>{e.name} · {range(e)}</span>)}</span>
          <span className={styles.actions}>
            <button className={`${styles.btn} ${styles.p}`} onClick={() => onAsk(`What drives ${FULL_MONTHS[picked]} for us, and what could we do to raise more in ${FULL_MONTHS[picked]}?`)}>Ask giveback</button>
            <button className={styles.link} onClick={() => setPicked(null)}>Clear</button>
          </span>
        </div>
      ) : (
        <div className={styles.sub}>Hover a month for its numbers, click it to pin it and ask giveback about it.</div>
      )}
      <div className={styles.sub} style={{ marginTop: 6 }}>On track for <b style={{ color: 'var(--ink)' }}>{money0(p.projectedCents)}</b> this year{p.lastYearCents > 0 && <> (last year {money0(p.lastYearCents)}{growthPct != null && `, ${growthPct >= 0 ? '+' : ''}${growthPct}%`})</>}. The projection uses the same months in earlier years, scaled by your growth.</div>
    </section>
  );
}

// --- Chat ---------------------------------------------------------------------------

type Msg = { role: 'user' | 'assistant'; text: string; proposals?: InvoiceProposal[] };
const SUGGESTIONS = ['What will August look like?', 'When should we run a campaign?', 'Can we cover the March venue rent?'];

function useChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  async function send(raw: string) {
    const q = raw.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: q }];
    setMsgs(next); setBusy(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      const j = (await res.json()) as { reply?: string; error?: string; proposals?: InvoiceProposal[] };
      setMsgs([...next, { role: 'assistant', text: j.reply ?? j.error ?? 'Something went wrong.', proposals: j.proposals }]);
    } catch {
      setMsgs([...next, { role: 'assistant', text: 'I could not reach the assistant. Try again in a moment.' }]);
    } finally { setBusy(false); }
  }
  return { msgs, busy, send };
}

function Chat({ chat, side, money, onSent, onExpand }: { chat: ReturnType<typeof useChat>; side?: boolean; money: (c: number) => string; onSent: () => void; onExpand: () => void }) {
  const { msgs, busy, send } = chat;
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  return (
    <div className={`${styles.chat} ${side ? styles.side : ''}`}>
      <div className={styles.chatHead}><span className={styles.label}>Ask giveback</span><button onClick={onExpand}>{side ? 'Minimize −' : 'Expand +'}</button></div>
      <div className={styles.msgs}>
        {msgs.length === 0 && <div className={styles.a}>Ask about cash flow, campaigns or sponsors. I use your payment history and never move money without your confirmation.</div>}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <div className={m.role === 'user' ? styles.q : styles.a}>{m.text}</div>
            {m.proposals?.map((p) => <ProposalCard key={p.sponsorId} p={p} money={money} onSent={onSent} />)}
          </div>
        ))}
        {busy && <div className={styles.a}>Thinking…</div>}
        <div ref={end} />
      </div>
      <div className={styles.chips}>{SUGGESTIONS.map((s) => <button key={s} className={styles.chip} onClick={() => void send(s)}>{s}</button>)}</div>
      <form className={styles.compose} onSubmit={(e) => { e.preventDefault(); void send(text); setText(''); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about cash flow, campaigns, sponsors…" aria-label="Ask giveback" />
        <button className={`${styles.btn} ${styles.p}`} disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

// --- Sponsor invoices ---------------------------------------------------------------

const CHIP: Record<string, { label: string; cls: string }> = {
  SENT: { label: 'Sent', cls: 'spSent' }, PAID: { label: 'Paid', cls: 'spPaid' }, PENDING: { label: 'Sending…', cls: 'spSent' },
};
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '');

function SponsorInvoices({ sponsors, money, onAsk }: { sponsors: SponsorRow[]; money: (c: number) => string; onAsk: (t: string) => void }) {
  if (!sponsors.length) return null;
  return (
    <section className={styles.card}>
      <div className={styles.chartHead}><div className={styles.label}>Sponsor invoices</div><div className={styles.label} style={{ textTransform: 'none' }}>sent through PayPal Invoicing</div></div>
      {sponsors.map((s) => {
        const chip = s.invoice ? CHIP[s.invoice.status] : null;
        return (
          <div key={s.id} className={styles.spRow}>
            <div><b>{s.name}</b><div className={styles.sub}>Pledged {money(s.pledgeCents)} · due {s.dueDate}</div></div>
            <div className={styles.spAmt}>{money(s.pledgeCents)}</div>
            <div>{chip ? <span className={`${styles.spChip} ${styles[chip.cls]}`}>{chip.label}{s.invoice?.status === 'SENT' ? ` · ${shortDate(s.invoice.sentAt)}` : s.invoice?.status === 'PAID' ? ` · ${shortDate(s.invoice.paidAt)}` : ''}</span> : <span className={`${styles.spChip} ${styles.spDue}`}>Not invoiced</span>}</div>
            <div className={styles.spAct}>
              {s.invoice?.link && <a href={s.invoice.link} target="_blank" rel="noopener" className={styles.link}>PayPal ↗</a>}
              {!s.invoice && <button className={styles.link} onClick={() => onAsk(`Invoice ${s.name} for their pledge`)}>Ask AI to invoice</button>}
            </div>
          </div>
        );
      })}
      <div className={styles.sub} style={{ marginTop: 8 }}>Status updates from PayPal. The AI only proposes an invoice; it is sent when you confirm.</div>
    </section>
  );
}

function ProposalCard({ p, money, onSent }: { p: InvoiceProposal; money: (c: number) => string; onSent: () => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'cancelled'>('idle');
  const [error, setError] = useState<string>();
  async function confirm() {
    setState('sending'); setError(undefined);
    try {
      const res = await fetch(`/api/sponsors/${p.sponsorId}/invoice`, { method: 'POST' });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? 'Could not send the invoice');
      setState('sent'); onSent();
    } catch (e) { setError((e as Error).message); setState('idle'); }
  }
  return (
    <div className={styles.prop}>
      <div className={styles.label} style={{ color: 'var(--a)' }}>{state === 'sent' ? 'Invoice sent' : 'Proposed action · needs your confirmation'}</div>
      <div className={styles.propTitle}>Invoice {p.name} {money(p.amountCents)}</div>
      <div className={styles.sub}>Due {p.dueDate} · sent through PayPal Invoicing to {p.email}</div>
      {error && <div className={styles.sub} style={{ color: 'var(--red, #9b1c1c)', marginTop: 6 }} role="alert">{error}</div>}
      {state === 'sent' && <div className={styles.sub} style={{ marginTop: 6 }}>Sent. It shows under Sponsor invoices and updates when it is paid.</div>}
      {state === 'cancelled' && <div className={styles.sub} style={{ marginTop: 6 }}>Cancelled. Nothing was sent.</div>}
      {(state === 'idle' || state === 'sending') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className={`${styles.btn} ${styles.p}`} style={{ flex: 1 }} disabled={state === 'sending'} onClick={() => void confirm()}>{state === 'sending' ? 'Sending…' : 'Confirm and send'}</button>
          <button className={styles.btn} disabled={state === 'sending'} onClick={() => setState('cancelled')}>Cancel</button>
        </div>
      )}
    </div>
  );
}
