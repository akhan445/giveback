// Hardcoded opportunity calendar for 2026-27. Dates are fixed here on purpose: the AI never
// invents them. Each event is tagged to the organization types (and, for faith, traditions) it fits.
// Lunar dates (Ramadan, Eid) are the expected dates and can shift by a day.
import type { OrgType, Tradition } from './org';

export type CalendarEvent = {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
  types: OrgType[] | 'all';
  traditions?: Tradition[]; // only for faith orgs; omitted = every tradition
  /** One line of context for the AI to build the campaign idea from. */
  angle: string;
};

export const CALENDAR: CalendarEvent[] = [
  // Everyone
  { id: 'giving-tuesday-2026', name: 'Giving Tuesday', start: '2026-12-01', end: '2026-12-01', types: 'all', angle: 'The biggest online giving day of the year; supporters expect appeals.' },
  { id: 'year-end-2026', name: 'Year-end giving', start: '2026-12-15', end: '2026-12-31', types: 'all', angle: 'Many supporters give before tax year-end; a last-days reminder works.' },
  { id: 'giving-tuesday-2027', name: 'Giving Tuesday', start: '2027-11-30', end: '2027-11-30', types: 'all', angle: 'The biggest online giving day of the year.' },
  // Food bank
  { id: 'holiday-hunger-2026', name: 'Holiday hunger season', start: '2026-11-24', end: '2026-12-31', types: ['food_bank'], angle: 'Demand and giving both peak around the holidays.' },
  { id: 'march-break-2027', name: 'March break', start: '2027-03-15', end: '2027-03-19', types: ['food_bank', 'education', 'youth_sports'], angle: 'Kids are out of school for a week; families lose school meals and need activities.' },
  { id: 'summer-meals-2027', name: 'School summer break', start: '2027-06-26', end: '2027-09-07', types: ['food_bank', 'education', 'youth_sports'], angle: 'Kids lose school meals and structured days; need rises while giving dips.' },
  { id: 'world-food-day-2027', name: 'World Food Day', start: '2026-10-16', end: '2026-10-16', types: ['food_bank'], angle: 'A natural hook for a hunger-awareness appeal.' },
  // Faith
  { id: 'ramadan-2027', name: 'Ramadan', start: '2027-02-08', end: '2027-03-09', types: ['faith'], traditions: ['muslim'], angle: 'Giving and Zakat peak; evening iftar gatherings bring the community together.' },
  { id: 'eid-fitr-2027', name: 'Eid al-Fitr', start: '2027-03-10', end: '2027-03-12', types: ['faith'], traditions: ['muslim'], angle: 'Zakat al-Fitr and Eid gifts; families give generously.' },
  { id: 'eid-adha-2027', name: 'Eid al-Adha', start: '2027-05-16', end: '2027-05-19', types: ['faith'], traditions: ['muslim'], angle: 'Qurbani and charity around Eid.' },
  { id: 'advent-2026', name: 'Advent', start: '2026-11-29', end: '2026-12-24', types: ['faith'], traditions: ['christian'], angle: 'A season of giving; Christmas-week appeals perform best.' },
  { id: 'lent-2027', name: 'Lent', start: '2027-02-10', end: '2027-03-27', types: ['faith'], traditions: ['christian'], angle: 'A season of almsgiving and service.' },
  { id: 'easter-2027', name: 'Easter', start: '2027-03-28', end: '2027-03-28', types: ['faith'], traditions: ['christian'], angle: 'A high-attendance day; good for a gathering and appeal.' },
  { id: 'hanukkah-2026', name: 'Hanukkah', start: '2026-12-04', end: '2026-12-12', types: ['faith'], traditions: ['jewish'], angle: 'Tzedakah is central; give nightly for eight nights.' },
  { id: 'passover-2027', name: 'Passover', start: '2027-04-21', end: '2027-04-29', types: ['faith'], traditions: ['jewish'], angle: 'Maot Chitim (Passover food for those in need) is a traditional appeal.' },
  // Environment
  { id: 'wildlife-day-2027', name: 'World Wildlife Day', start: '2027-03-03', end: '2027-03-03', types: ['environment'], angle: 'A wildlife-protection appeal hook.' },
  { id: 'earth-day-2027', name: 'Earth Day', start: '2027-04-22', end: '2027-04-22', types: ['environment'], angle: 'The year\'s biggest environmental attention day; spring planting events fit.' },
  { id: 'oceans-day-2027', name: 'World Oceans Day', start: '2027-06-08', end: '2027-06-08', types: ['environment'], angle: 'Ocean-focused groups get their peak attention here; beach clean-ups fit.' },
  { id: 'planting-summer-2027', name: 'Summer break planting', start: '2027-07-05', end: '2027-08-20', types: ['environment'], angle: 'Kids are out of school for family planting days; nurseries often discount stock off-season, so compare quotes before buying trees.' },
  // Animals
  { id: 'kitten-season-2027', name: 'Kitten season', start: '2027-04-15', end: '2027-09-30', types: ['animal'], angle: 'Intake peaks; foster and supply appeals work.' },
  { id: 'holiday-adopt-2026', name: 'Holiday adoption push', start: '2026-12-01', end: '2026-12-23', types: ['animal'], angle: 'Gift-season adoption drives; remind families adopting is a big commitment.' },
  // Health
  { id: 'movember-2026', name: 'Movember', start: '2026-11-01', end: '2026-11-30', types: ['health'], angle: 'Men\'s health awareness month with built-in peer fundraising.' },
  { id: 'heart-month-2027', name: 'Heart Month', start: '2027-02-01', end: '2027-02-28', types: ['health'], angle: 'A cardiac-health awareness month.' },
  { id: 'health-day-2027', name: 'World Health Day', start: '2027-04-07', end: '2027-04-07', types: ['health'], angle: 'A hook for a prevention or screening appeal.' },
  // Education / youth sports / arts
  { id: 'back-to-school-2027', name: 'Back to school', start: '2027-08-25', end: '2027-09-15', types: ['education', 'youth_sports', 'arts'], angle: 'Families are in a planning and spending mindset; supply drives and registrations peak.' },
  { id: 'graduation-2027', name: 'Graduation season', start: '2027-06-01', end: '2027-06-25', types: ['education'], angle: 'Alumni and proud families give; scholarship appeals fit.' },
  { id: 'spring-season-2027', name: 'Spring sports registration', start: '2027-02-15', end: '2027-03-31', types: ['youth_sports'], angle: 'Registrations and sponsorships open for the spring season.' },
  { id: 'season-launch-2026', name: 'Fall season launch', start: '2026-11-15', end: '2026-12-31', types: ['arts'], angle: 'Holiday shows and gift memberships.' },
];

/** Events relevant to this organization, soonest first. */
export function eventsFor(orgType: OrgType, tradition: Tradition | null): CalendarEvent[] {
  return CALENDAR.filter((e) => {
    if (e.types !== 'all' && !e.types.includes(orgType)) return false;
    if (orgType === 'faith' && e.traditions && (!tradition || !e.traditions.includes(tradition))) return false;
    return true;
  }).sort((a, b) => a.start.localeCompare(b.start));
}
