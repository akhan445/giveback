import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--gb-ui' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--gb-mono' });

export const metadata: Metadata = { title: 'Payment' };

// No app navigation here: this is what a supporter sees on their own phone.
export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${dmSans.variable} ${plexMono.variable}`}>{children}</div>;
}
