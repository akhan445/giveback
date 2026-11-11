import { ReturnView } from '../return-view';

export const dynamic = 'force-dynamic';

// Where PayPal sends a supporter's phone after they donate from the public donate page (the QR code on the
// live display). Same confirmation as the counter's, plus a Donate again link.
export default async function PayDonated({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ReturnView token={token} again />;
}
