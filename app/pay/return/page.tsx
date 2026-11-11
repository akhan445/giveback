import { ReturnView } from '../return-view';

export const dynamic = 'force-dynamic';

// Where PayPal sends a supporter's phone after they approve a payment started from the counter's QR code.
// PayPal adds ?token=<order id>.
export default async function PayReturn({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ReturnView token={token} again={false} />;
}
