import { getOrgProfile } from '@/lib/history';
import { getCashbackAccount } from '@/lib/payouts';
import { buildYearEndPdf } from '@/lib/report-pdf';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [acct, org] = await Promise.all([getCashbackAccount(), getOrgProfile()]);
  const bytes = await buildYearEndPdf({
    orgName: org.name, year: acct.year, currency: acct.currency, months: acct.months, totals: acct.totals, payouts: acct.payouts, generatedAt: new Date(),
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="giveback-${acct.year}-year-end-report.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
