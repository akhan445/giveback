// SVG artwork for the live display, drawn in a 100 x 100 box. Static strings authored here (never user
// input), rendered with dangerouslySetInnerHTML. Colours come from the --lv-* tokens in live.module.css.
import type { CellShape, HeroShape } from '@/lib/impact';

const dim = 'fill="var(--lv-dim)" stroke="var(--lv-line)" stroke-width="1.5"';
const line = 'fill="none" stroke="var(--lv-muted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';

/** body: the part that fills (clip path); range: y of its top and bottom; detail: drawn over/around it. */
export const HERO: Record<HeroShape, { range: [number, number]; body: string; detail: string }> = {
  pot: {
    range: [30, 90],
    body: '<path d="M22 30 H78 V80 Q78 90 68 90 H32 Q22 90 22 80 Z"/>',
    detail: `<g ${dim}><path d="M16 29 C16 12 84 12 84 29 Z"/><circle cx="50" cy="10" r="4.5"/></g><g ${line}><path d="M22 42 H9 Q5 42 5 46 V50 Q5 54 9 54 H22 M78 42 H91 Q95 42 95 46 V50 Q95 54 91 54 H78"/></g>`,
  },
  bowl: {
    range: [44, 90],
    body: '<path d="M6 44 H94 C94 74 76 90 50 90 C24 90 6 74 6 44 Z"/>',
    detail: `<g ${line}><path d="M34 33 C28 25 40 20 34 10 M50 33 C44 25 56 20 50 10 M66 33 C60 25 72 20 66 10 M32 94 H68"/></g>`,
  },
  loaf: {
    range: [20, 90],
    body: '<path d="M12 50 C12 28 30 20 50 20 C70 20 88 28 88 50 C88 56 84 60 80 60 V84 C80 88 76 90 72 90 H28 C24 90 20 88 20 84 V60 C16 60 12 56 12 50 Z"/>',
    detail: `<g ${line}><path d="M32 32 L40 50 M48 28 L56 48 M64 32 L70 48"/></g>`,
  },
  bag: {
    range: [30, 92],
    body: '<path d="M20 30 H80 L86 92 H14 Z"/>',
    detail: `<g ${dim}><circle cx="36" cy="22" r="11"/><circle cx="52" cy="18" r="10"/><path d="M64 4 L78 34 L68 36 L58 8 Z"/></g><g ${line}><path d="M20 30 H80"/></g>`,
  },
  drop: { range: [10, 94], body: '<path d="M50 6 C50 6 18 44 18 64 C18 82 32 94 50 94 C68 94 82 82 82 64 C82 44 50 6 50 6 Z"/>', detail: '' },
  house: { range: [10, 90], body: '<path d="M50 8 L94 48 H82 V90 H18 V48 H6 Z"/>', detail: '' },
  thermo: {
    range: [8, 92],
    body: '<path d="M50 4 C44 4 40 8 40 14 V60 C34 64 30 70 30 77 C30 88 39 96 50 96 C61 96 70 88 70 77 C70 70 66 64 60 60 V14 C60 8 56 4 50 4 Z"/>',
    detail: '<g stroke="var(--lv-muted)" stroke-width="2" stroke-linecap="round"><path d="M68 20 H78 M68 34 H78 M68 48 H78"/></g>',
  },
  bulb: {
    range: [6, 80],
    body: '<path d="M50 6 C28 6 16 22 16 40 C16 54 26 62 32 70 V80 H68 V70 C74 62 84 54 84 40 C84 22 72 6 50 6 Z"/>',
    detail: '<g stroke="var(--lv-muted)" stroke-width="3" stroke-linecap="round"><path d="M36 87 H64 M42 94 H58"/></g>',
  },
  heart: { range: [14, 92], body: '<path d="M50 92 C8 60 4 30 24 18 C36 11 46 17 50 28 C54 17 64 11 76 18 C96 30 92 60 50 92 Z"/>', detail: '' },
  star: { range: [5, 93], body: '<polygon points="50,5 62,37 96,38 69,59 79,93 50,73 21,93 31,59 4,38 38,37"/>', detail: '' },
  trophy: {
    range: [8, 92],
    body: '<path d="M28 8 H72 V36 C72 52 62 60 50 60 C38 60 28 52 28 36 Z"/><rect x="44" y="60" width="12" height="20"/><path d="M30 80 H70 V92 H30 Z"/>',
    detail: `<g ${line}><path d="M28 16 H12 C12 34 20 42 30 44 M72 16 H88 C88 34 80 42 70 44"/></g>`,
  },
};

/** One cell of the milestone grid (filled with currentColor). */
export const CELL: Record<CellShape, string> = {
  plate: '<circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="24" fill="none" stroke="var(--lv-bg)" stroke-width="7" opacity=".55"/>',
  tree: '<path d="M50 6 C28 6 14 22 18 40 C8 46 12 66 30 66 H44 V94 H56 V66 H70 C88 66 92 46 82 40 C86 22 72 6 50 6 Z"/>',
  paw: '<ellipse cx="50" cy="66" rx="24" ry="20"/><ellipse cx="22" cy="42" rx="9" ry="12"/><ellipse cx="40" cy="26" rx="9" ry="13"/><ellipse cx="60" cy="26" rx="9" ry="13"/><ellipse cx="78" cy="42" rx="9" ry="12"/>',
  cross: '<path d="M38 8 H62 V38 H92 V62 H62 V92 H38 V62 H8 V38 H38 Z"/>',
  book: '<path d="M6 22 C26 15 40 17 50 26 C60 17 74 15 94 22 V80 C74 73 60 75 50 85 C40 75 26 73 6 80 Z"/>',
  house: '<path d="M50 8 L94 48 H82 V90 H18 V48 H6 Z"/>',
  ticket: '<path d="M6 26 H94 V42 a8 8 0 0 0 0 16 V74 H6 V58 a8 8 0 0 0 0 -16 Z"/>',
  ball: '<circle cx="50" cy="50" r="44"/><polygon points="50,34 64,45 59,62 41,62 36,45" fill="var(--lv-bg)" opacity=".5"/>',
  person: '<circle cx="50" cy="26" r="17"/><path d="M18 92 C18 62 32 50 50 50 C68 50 82 62 82 92 Z"/>',
  heart: '<path d="M50 92 C8 60 4 30 24 18 C36 11 46 17 50 28 C54 17 64 11 76 18 C96 30 92 60 50 92 Z"/>',
  star: '<polygon points="50,5 62,37 96,38 69,59 79,93 50,73 21,93 31,59 4,38 38,37"/>',
};
