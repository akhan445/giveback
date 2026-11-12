// The cashback payout invoice: one PDF per successful payout, rebuilt on demand from the stored payout and the
// payment ledger (nothing is stored, so it always matches the books). Plain Latin text only (standard PDF fonts).
import { GIVEBACK_ICON_PNG } from './brand-assets';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { LedgerMonth } from './ledger';
import type { PayoutRow } from './payouts';

const INK = rgb(0.145, 0.188, 0.122);
const MUTE = rgb(0.478, 0.518, 0.447);
const GREEN = rgb(0.31, 0.42, 0.227);
const LINE = rgb(0.875, 0.89, 0.827);
const SOFT = rgb(0.914, 0.929, 0.875);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ascii = (s: string) => s.replace(/[−–—]/g, '-').replace(/·/g, '|').replace(/[^\x20-\x7e]/g, '');

export const invoiceNumber = (p: Pick<PayoutRow, 'year' | 'id'>) => `GB-INV-${p.year}-${String(p.id).padStart(4, '0')}`;

export type InvoiceData = {
  orgName: string;
  payout: PayoutRow;
  months: LedgerMonth[];
  earnedCents: number;
  earlierCents: number;
  adjustmentCents: number;
};

export async function buildInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const p = d.payout;
  const money = (c: number) => ascii(new Intl.NumberFormat('en-CA', { style: 'currency', currency: p.currency }).format(c / 100));
  const M = 48;
  const W = 612 - M * 2;
  let y = 744;
  const text = (t: string, x: number, yy: number, size: number, font: PDFFont = reg, color = INK) => page.drawText(ascii(t), { x, y: yy, size, font, color });
  const right = (t: string, xr: number, yy: number, size: number, font: PDFFont = reg, color = INK) => text(t, xr - font.widthOfTextAtSize(ascii(t), size), yy, size, font, color);
  const rule = (yy: number, dashed = false) => page.drawLine({ start: { x: M, y: yy }, end: { x: M + W, y: yy }, thickness: 0.6, color: LINE, ...(dashed ? { dashArray: [2, 3] } : {}) });

  const logo = await pdf.embedPng(GIVEBACK_ICON_PNG);
  page.drawImage(logo, { x: M + W - 34, y: y - 22, width: 34, height: 34 });
  text('GIVEBACK  |  CASHBACK PAYOUT INVOICE', M, y, 9, mono, MUTE);
  y -= 34;
  text('Invoice', M, y, 26, bold);
  right(invoiceNumber(p), M + W, y + 4, 14, mono, INK);
  y -= 20;
  right(`Issued ${new Date(p.createdAt).toISOString().slice(0, 10)}`, M + W, y + 6, 10, reg, MUTE);

  // Parties
  y -= 24;
  text('FROM', M, y, 8, mono, MUTE);
  text('TO', M + 280, y, 8, mono, MUTE);
  y -= 15;
  text('giveback', M, y, 12, bold);
  text(d.orgName, M + 280, y, 12, bold);
  y -= 14;
  text('Cashback platform (PayPal Payouts)', M, y, 9.5, reg, MUTE);
  text(p.recipientEmail, M + 280, y, 9.5, reg, MUTE);
  y -= 30;

  // Lines
  text(`CASHBACK EARNED IN ${p.year}`, M, y, 8.5, mono, MUTE);
  y -= 8;
  rule(y);
  y -= 14;
  text('MONTH', M, y, 7.5, mono, MUTE);
  text('TIER', M + 150, y, 7.5, mono, MUTE);
  right('RATE', M + 330, y, 7.5, mono, MUTE);
  right('RAISED', M + 430, y, 7.5, mono, MUTE);
  right('CASHBACK', M + W, y, 7.5, mono, MUTE);
  for (const m of d.months) {
    y -= 7;
    rule(y, true);
    y -= 14;
    text(MONTHS[Number(m.month.slice(5, 7)) - 1], M, y, 10);
    text(m.tier, M + 150, y, 10, reg, MUTE);
    right(`${(m.rateBp / 100).toFixed(2)}%`, M + 330, y, 10, mono);
    right(money(m.volumeCents), M + 430, y, 10, mono);
    right(money(m.cashbackCents), M + W, y, 10, mono, GREEN);
  }
  y -= 10;
  rule(y);

  const line = (label: string, value: string, strong = false, color = INK) => {
    y -= 19;
    text(label, M + 250, y, strong ? 12 : 10.5, strong ? bold : reg);
    right(value, M + W, y, strong ? 12 : 10.5, strong ? bold : mono, color);
  };
  line('Cashback earned', money(d.earnedCents));
  if (d.earlierCents > 0) line('Less: earlier payouts this year', `- ${money(d.earlierCents)}`);
  if (d.adjustmentCents !== 0) line('Adjustment', `${d.adjustmentCents < 0 ? '- ' : ''}${money(Math.abs(d.adjustmentCents))}`);
  y -= 36;
  page.drawRectangle({ x: M + 240, y: y - 8, width: W - 240, height: 30, color: SOFT });
  text('Paid to you', M + 250, y + 2, 12, bold);
  right(money(p.amountCents), M + W - 10, y + 2, 14, bold, GREEN);

  // Payment details
  y -= 46;
  text('PAYMENT DETAILS', M, y, 8.5, mono, MUTE);
  y -= 8;
  rule(y);
  const kv: [string, string][] = [
    ['Method', 'PayPal Payouts'],
    ['PayPal batch', p.paypalBatchId ?? '-'],
    ['Status', p.status === 'SUCCESS' ? 'Paid' : p.status],
    ['Type', p.trigger === 'year_end' ? 'Year-end automatic payout' : 'Collected on request'],
  ];
  for (const [k, v] of kv) {
    y -= 18;
    text(k, M, y, 10, reg, MUTE);
    text(v, M + 120, y, 10, k === 'PayPal batch' ? mono : reg);
  }

  text('Sandbox demo: cashback is simulated and paid with PayPal sandbox money.', M, 60, 7.5, reg, MUTE);
  text('In a real launch it would be funded by pooled-volume pricing and a sponsor pool.', M, 49, 7.5, reg, MUTE);
  text('Generated by giveback', M, 36, 7.5, reg, MUTE);
  return pdf.save();
}
