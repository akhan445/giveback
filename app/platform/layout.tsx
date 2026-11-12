import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import styles from './platform.module.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--gb-ui' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--gb-mono' });

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${dmSans.variable} ${plexMono.variable} ${styles.page}`}>{children}</div>;
}
