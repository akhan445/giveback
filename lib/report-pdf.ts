// Year-end "giveback report" as a PDF: savings summary, cashback by month with the tier reached, the
// illustrative competitor comparison and the payout log. Built with pdf-lib (pure JS, runs on Vercel).
// The standard PDF fonts only cover basic Latin, so text is kept to plain characters.
import { RIVERSIDE_ICON_PNG } from './brand-assets';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { LedgerMonth, YearTotals } from './ledger';
import type { PayoutRow } from './payouts';

const INK = rgb(0.145, 0.188, 0.122);
const MUTE = rgb(0.478, 0.518, 0.447);
const GREEN = rgb(0.31, 0.42, 0.227);
const LINE = rgb(0.875, 0.89, 0.827);
const SOFT = rgb(0.914, 0.929, 0.875);
const RED = rgb(0.608, 0.11, 0.11);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ascii = (s: string) => s.replace(/[−–—]/g, '-').replace(/·/g, '|').replace(/[^\x20-\x7e]/g, '');

export type ReportData = {
  orgName: string;
  year: number;
  currency: string;
  months: LedgerMonth[];
  totals: YearTotals;
  payouts: PayoutRow[];
  generatedAt: Date;
};

export async function buildYearEndPdf(d: ReportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const money = (c: number) => ascii(new Intl.NumberFormat('en-CA', { style: 'currency', currency: d.currency }).format(c / 100));
  const pct = (bp: number) => `${(bp / 100).toFixed(2)}%`;
  const M = 48;
  const W = 612 - M * 2;
  let y = 744;

  const text = (t: string, x: number, yy: number, size: number, font: PDFFont = reg, color = INK) => page.drawText(ascii(t), { x, y: yy, size, font, color });
  const right = (t: string, xr: number, yy: number, size: number, font: PDFFont = reg, color = INK) => text(t, xr - font.widthOfTextAtSize(ascii(t), size), yy, size, font, color);
  const rule = (yy: number, dashed = false) => page.drawLine({ start: { x: M, y: yy }, end: { x: M + W, y: yy }, thickness: 0.6, color: LINE, ...(dashed ? { dashArray: [2, 3] } : {}) });

  // Header
  const logo = await pdf.embedPng(RIVERSIDE_ICON_PNG);
  page.drawImage(logo, { x: M + W - 40, y: y - 28, width: 40, height: 40 });
  text('GIVEBACK  |  YEAR-END REPORT', M, y, 9, mono, MUTE);
  y -= 30;
  text(d.orgName, M, y, 24, bold);
  y -= 20;
  text(`${d.year} savings and cashback summary`, M, y, 11, reg, MUTE);
  y -= 34;

  // Headline
  text('Your volume earned you', M, y, 13, reg);
  y -= 30;
  text(money(d.totals.freeMoneyCents), M, y, 30, bold, GREEN);
  const wFree = bold.widthOfTextAtSize(ascii(money(d.totals.freeMoneyCents)), 30);
  text('in free money this year', M + wFree + 10, y + 3, 13, reg);
  y -= 16;
  text(`${money(d.totals.cashbackCents)} cashback from your volume + ${money(d.totals.feeCoveredCents)} of admin fees covered by supporters.`, M, y, 9.5, reg, MUTE);
  y -= 30;

  // Summary
  text('WHERE YOUR MONEY WENT (YEAR TO DATE)', M, y, 8.5, mono, MUTE);
  y -= 8;
  rule(y);
  const rows: [string, string, 'n' | 'g' | 'r' | 'b'][] = [
    [`Raised (${d.totals.count.toLocaleString('en-CA')} payments)`, money(d.totals.volumeCents), 'n'],
    ['Admin fee (PayPal + giveback)', `- ${money(d.totals.feeCents)}`, 'r'],
    ['Cashback earned', `+ ${money(d.totals.cashbackCents)}`, 'g'],
    ['You keep', money(d.totals.keepCents), 'b'],
  ];
  for (const [k, v, t] of rows) {
    y -= 19;
    text(k, M, y, 11, t === 'b' ? bold : reg);
    right(v, M + W, y, 11, t === 'b' ? bold : mono, t === 'g' ? GREEN : t === 'r' ? RED : INK);
    y -= 6;
    rule(y, true);
  }
  y -= 16;
  text(`Supporters covered ${money(d.totals.feeCoveredCents)} of the fee (already included in Raised). Effective fee rate after cashback: ${pct(d.totals.effectiveFeeBp)}.`, M, y, 9, reg, MUTE);
  y -= 24;

  // Competitor comparison
  page.drawRectangle({ x: M, y: y - 30, width: W, height: 44, color: SOFT });
  text('A typical platform (2.9% + $0.30 per payment + 1% platform fee), illustrative:', M + 10, y - 2, 9.5, reg);
  text(`you would keep ${money(d.totals.competitorKeepCents)}`, M + 10, y - 20, 11, bold);
  right(`${money(d.totals.keepCents - d.totals.competitorKeepCents)} more with giveback`, M + W - 10, y - 20, 11, bold, GREEN);
  y -= 66;

  // Monthly chart
  text('CASHBACK BY MONTH AND TIER REACHED', M, y, 8.5, mono, MUTE);
  y -= 12;
  const chartH = 96;
  const base = y - chartH - 16;
  const byKey = new Map(d.months.map((m) => [m.month, m]));
  const max = Math.max(1, ...d.months.map((m) => m.cashbackCents));
  const slot = W / 12;
  for (let i = 0; i < 12; i++) {
    const m = byKey.get(`${d.year}-${String(i + 1).padStart(2, '0')}`);
    const x = M + i * slot + 6;
    const bw = slot - 12;
    if (m && m.cashbackCents > 0) {
      const h = Math.max(2, (m.cashbackCents / max) * chartH);
      page.drawRectangle({ x, y: base, width: bw, height: h, color: GREEN });
      const label = money(m.cashbackCents).replace(/\.00$/, '');
      right(label, x + bw / 2 + reg.widthOfTextAtSize(label, 7) / 2, base + h + 3, 7, reg, INK);
      const tier = m.tier.toUpperCase();
      text(tier, x + bw / 2 - mono.widthOfTextAtSize(tier, 5.5) / 2, base - 20, 5.5, mono, MUTE);
    }
    text(MONTHS[i], x + bw / 2 - reg.widthOfTextAtSize(MONTHS[i], 8) / 2, base - 10, 8, reg, MUTE);
  }
  page.drawLine({ start: { x: M, y: base }, end: { x: M + W, y: base }, thickness: 0.8, color: INK });
  y = base - 42;

  // Payout log
  text('PAYOUT LOG', M, y, 8.5, mono, MUTE);
  y -= 8;
  rule(y);
  const cols = { date: M, amount: M + 100, type: M + 190, batch: M + 260, status: M + W };
  y -= 14;
  text('DATE', cols.date, y, 7.5, mono, MUTE);
  text('AMOUNT', cols.amount, y, 7.5, mono, MUTE);
  text('TYPE', cols.type, y, 7.5, mono, MUTE);
  text('PAYPAL BATCH', cols.batch, y, 7.5, mono, MUTE);
  right('STATUS', cols.status, y, 7.5, mono, MUTE);
  const shown = d.payouts.filter((p) => p.year === d.year);
  if (shown.length === 0) {
    y -= 20;
    text('No payouts yet this year. Cashback accrues until it is collected or paid out at year end.', M, y, 9.5, reg, MUTE);
  }
  for (const p of shown.slice(0, 6)) {
    y -= 8;
    rule(y, true);
    y -= 14;
    text(new Date(p.createdAt).toISOString().slice(0, 10), cols.date, y, 9.5, mono);
    text(money(p.amountCents), cols.amount, y, 9.5, mono);
    text(p.trigger === 'year_end' ? 'Year-end' : 'Manual', cols.type, y, 9.5, reg);
    text(p.paypalBatchId ?? '-', cols.batch, y, 8.5, mono);
    right(p.status, cols.status, y, 8.5, mono, p.status === 'SUCCESS' ? GREEN : MUTE);
  }

  // Footer
  const lines = ['Sandbox demo: cashback is simulated. In a real launch it would be funded by pooled-volume pricing and a sponsor pool.', 'The competitor comparison uses illustrative assumptions.'];
  lines.forEach((l, i) => text(l, M, 60 - i * 11, 7.5, reg, MUTE));
  text(`Generated ${d.generatedAt.toISOString().slice(0, 10)} by giveback`, M, 36, 7.5, reg, MUTE);

  return pdf.save();
}
