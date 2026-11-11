'use client';

import { useEffect, useRef, useState } from 'react';
import { AU, CA, EU, GB, US } from 'country-flag-icons/react/3x2';
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '@/lib/currency';
import styles from './pos.module.css';

const FLAGS = { US, CA, EU, GB, AU } as const;

function Flag({ code }: { code: CurrencyCode }) {
  const Icon = FLAGS[CURRENCIES[code].flag];
  return <Icon className={styles.flag} aria-hidden="true" />;
}

/** Themed currency menu: flag + code on the button, flag + code + name in the list. */
export function CurrencyPicker({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className={styles.picker} ref={root}>
      <button
        type="button"
        className={styles.pickerBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Currency: ${value}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Flag code={value} />
        <span className={styles.code}>{value}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true" className={open ? styles.chevUp : undefined}>
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className={styles.menu} role="listbox" aria-label="Currency">
          {CURRENCY_CODES.map((code) => (
            <li key={code} role="option" aria-selected={code === value}>
              <button
                type="button"
                className={`${styles.opt} ${code === value ? styles.optOn : ''}`}
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                }}
              >
                <Flag code={code} />
                <span className={styles.code}>{code}</span>
                <span className={styles.optName}>{CURRENCIES[code].label}</span>
                <span className={styles.tick}>{code === value ? '✓' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
