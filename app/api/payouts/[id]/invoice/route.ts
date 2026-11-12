import { getOrgProfile } from '@/lib/history';
import { buildInvoicePdf, invoiceNumber } from '@/lib/invoice-pdf';
import { getPayout, getPayoutStatement } from '@/lib/payouts';

export const dynamic = 'force-dynamic';

// The invoice exists once the payout has succeeded. Opens inline so the link can show it in a new tab.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const payout = Number.isInteger(id) && id > 0 ? await getPayout(id) : null;
  if (!payout) return new Response('Not found', { status: 404 });
  if (payout.status !== 'SUCCESS') return new Response('The invoice is available once the payout has succeeded.', { status: 409 });
  const [org, statement] = await Promise.all([getOrgProfile(), getPayoutStatement(payout)]);
  const bytes = await buildInvoicePdf({ orgName: org.name, payout, ...statement });
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${invoiceNumber(payout)}.pdf"`, 'Cache-Control': 'no-store' },
  });
}
