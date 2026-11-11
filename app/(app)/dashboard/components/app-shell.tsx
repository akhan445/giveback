'use client';

import type { ReactNode } from 'react';
import { AgStudioLogo } from './ui/logo';

// The Reports frame: a left sidebar and a light canvas under the app's own top nav. Shared by the
// dashboard, its loading skeleton and its error page.

export function AppShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-pp-canvas font-paypal text-pp-ink">
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-64 shrink-0 flex-col border-r border-pp-border bg-white" aria-label="Reports">
          <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
          <a
            href="https://www.ag-grid.com/studio/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 border-t border-pp-border px-4 py-3 text-xs text-pp-muted hover:text-pp-ink"
          >
            <span className="whitespace-nowrap">Powered by</span> <AgStudioLogo className="h-7 w-auto" />
          </a>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
