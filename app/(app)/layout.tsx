import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import { getOrgProfile } from '@/lib/history';
import { AppNav } from './app-nav';
import styles from './app-nav.module.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--gb-ui' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--gb-mono' });

export const dynamic = 'force-dynamic';

// Shared shell: the nav stays mounted while only the page below it changes.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrgProfile();
  return (
    <div className={`${dmSans.variable} ${plexMono.variable} ${styles.shell}`}>
      <AppNav orgName={org.name} />
      <div className={styles.page}>{children}</div>
    </div>
  );
}
