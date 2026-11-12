import { getOrgProfile } from '@/lib/history';
import { listSponsors } from '@/lib/sponsors';
import { buildSponsorReceiptPdf } from '@/lib/sponsor-receipt-pdf';

export const dynamic = 'force-dynamic';

// A receipt exists once the sponsor's invoice is paid. Opens inline so the link can show it in a new tab.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const sponsor = Number.isInteger(id) && id > 0 ? (await listSponsors()).find((s) => s.id === id) : undefined;
  if (!sponsor?.invoice) return new Response('Not found', { status: 404 });
  if (sponsor.invoice.status !== 'PAID') return new Response('The receipt is available once the invoice is paid.', { status: 409 });
  const bytes = await buildSponsorReceiptPdf((await getOrgProfile()).name, sponsor);
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${sponsor.invoice.invoiceNumber ?? 'receipt'}-receipt.pdf"`, 'Cache-Control': 'no-store' },
  });
}
