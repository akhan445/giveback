// What a dollar does, by kind of organization: the picture that fills up on the live display and the
// unit counted on the milestone grid ("2,840 meals served", "1,128 trees planted"). Defaults come from
// the organization type; an organization can override every part in Settings (stored on org_settings).
import type { OrgType } from './org';

export const HERO_SHAPES = {
  pot: 'Stock pot',
  bowl: 'Soup bowl',
  loaf: 'Loaf of bread',
  bag: 'Grocery bag',
  drop: 'Water drop',
  house: 'House',
  thermo: 'Thermometer',
  bulb: 'Lightbulb',
  heart: 'Heart',
  star: 'Star',
  trophy: 'Trophy',
} as const;
export type HeroShape = keyof typeof HERO_SHAPES;

export const CELL_SHAPES = {
  plate: 'Plate',
  tree: 'Tree',
  paw: 'Paw',
  cross: 'Medical cross',
  book: 'Book',
  house: 'House',
  ticket: 'Ticket',
  ball: 'Ball',
  person: 'Person',
  heart: 'Heart',
  star: 'Star',
} as const;
export type CellShape = keyof typeof CELL_SHAPES;

export const HERO_KEYS = Object.keys(HERO_SHAPES) as [HeroShape, ...HeroShape[]];
export const CELL_KEYS = Object.keys(CELL_SHAPES) as [CellShape, ...CellShape[]];

export type Impact = {
  hero: HeroShape; // the big picture that fills from the bottom
  cell: CellShape; // one cell of the milestone grid
  unit: string; // "meals"
  done: string; // "meals served"
  unitCents: number; // what one unit costs
};

export const IMPACT: Record<OrgType, Impact> = {
  food_bank: { hero: 'pot', cell: 'plate', unit: 'meals', done: 'meals served', unitCents: 200 },
  faith: { hero: 'heart', cell: 'house', unit: 'families', done: 'families supported', unitCents: 4000 },
  environment: { hero: 'drop', cell: 'tree', unit: 'trees', done: 'trees planted', unitCents: 500 },
  education: { hero: 'bulb', cell: 'book', unit: 'books', done: 'books given', unitCents: 800 },
  animal: { hero: 'house', cell: 'paw', unit: 'animals', done: 'animals cared for', unitCents: 6000 },
  health: { hero: 'thermo', cell: 'cross', unit: 'patients', done: 'patients treated', unitCents: 3000 },
  arts: { hero: 'star', cell: 'ticket', unit: 'tickets', done: 'tickets funded', unitCents: 1500 },
  youth_sports: { hero: 'trophy', cell: 'ball', unit: 'kids', done: 'kids playing', unitCents: 4500 },
  other: { hero: 'heart', cell: 'person', unit: 'people', done: 'people helped', unitCents: 2000 },
};

export const defaultImpact = (orgType: string | null | undefined): Impact => IMPACT[orgType as OrgType] ?? IMPACT.other;

/** The organization's own choices laid over the defaults for its type. */
export function resolveImpact(orgType: string | null | undefined, overrides: Partial<Impact> | null | undefined): Impact {
  const base = defaultImpact(orgType);
  const o = overrides ?? {};
  return {
    hero: o.hero && o.hero in HERO_SHAPES ? o.hero : base.hero,
    cell: o.cell && o.cell in CELL_SHAPES ? o.cell : base.cell,
    unit: o.unit?.trim() || base.unit,
    done: o.done?.trim() || base.done,
    unitCents: o.unitCents && o.unitCents > 0 ? Math.round(o.unitCents) : base.unitCents,
  };
}

/** Whole units a given amount (dollars) pays for. */
export const unitsFor = (dollars: number, impact: Impact) => Math.floor((dollars * 100) / impact.unitCents);

/** Parse the impact JSON carried on the campaign row; falls back to the "other" defaults. */
export function parseImpact(json: string | null | undefined): Impact {
  try {
    return resolveImpact(null, JSON.parse(json ?? '{}') as Partial<Impact>);
  } catch {
    return resolveImpact(null, null);
  }
}
