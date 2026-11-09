import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--gb-ui' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--gb-mono' });

export const metadata: Metadata = { title: 'Counter' };

export default function PosLayout({ children }: LayoutProps<'/pos'>) {
  return <div className={`${dmSans.variable} ${plexMono.variable}`}>{children}</div>;
}
