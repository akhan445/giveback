'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './app-nav.module.css';

const TABS = [
  { href: '/pos', label: 'Counter' },
  { href: '/overview', label: 'Dashboard' },
  { href: '/dashboard', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
];

export function AppNav({ orgName }: { orgName: string }) {
  const path = usePathname();
  return (
    <header className={styles.nav}>
      <div className={styles.org}><span className={styles.logo}>{orgName[0]}</span>{orgName}</div>
      <nav className={styles.tabs} aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={path.startsWith(t.href) ? styles.on : ''} aria-current={path.startsWith(t.href) ? 'page' : undefined}>{t.label}</Link>
        ))}
      </nav>
    </header>
  );
}
