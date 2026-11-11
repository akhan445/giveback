// What a dollar does, by kind of organization: the picture that fills up on the live display and the
// unit counted on the milestone grid ("2,820 meals served", "1,128 trees planted"). Unit costs are
// illustrative defaults; a real organization would set its own.
import type { OrgType } from './org';

export type Shape = 'bowl' | 'tree' | 'paw' | 'heart' | 'book' | 'star' | 'ball';
export type CellShape = Shape | 'plate';

export type Impact = {
  hero: Shape; // the big picture that fills from the bottom
  cell: CellShape; // one cell of the milestone grid
  unit: string; // "meals"
  done: string; // "meals served"
  unitCents: number; // what one unit costs
};

export const IMPACT: Record<OrgType, Impact> = {
  food_bank: { hero: 'bowl', cell: 'plate', unit: 'meals', done: 'meals served', unitCents: 200 },
  faith: { hero: 'heart', cell: 'heart', unit: 'families', done: 'families supported', unitCents: 4000 },
  environment: { hero: 'tree', cell: 'tree', unit: 'trees', done: 'trees planted', unitCents: 500 },
  education: { hero: 'book', cell: 'book', unit: 'books', done: 'books given', unitCents: 800 },
  animal: { hero: 'paw', cell: 'paw', unit: 'animals', done: 'animals cared for', unitCents: 6000 },
  health: { hero: 'heart', cell: 'heart', unit: 'patients', done: 'patients treated', unitCents: 3000 },
  arts: { hero: 'star', cell: 'star', unit: 'tickets', done: 'tickets funded', unitCents: 1500 },
  youth_sports: { hero: 'ball', cell: 'ball', unit: 'kids', done: 'kids playing', unitCents: 4500 },
  other: { hero: 'heart', cell: 'heart', unit: 'people', done: 'people helped', unitCents: 2000 },
};

export const impactFor = (orgType: string | null | undefined): Impact => IMPACT[(orgType as OrgType) ?? 'other'] ?? IMPACT.other;

/** Whole units a given amount (dollars) pays for. */
export const unitsFor = (dollars: number, impact: Impact) => Math.floor((dollars * 100) / impact.unitCents);
