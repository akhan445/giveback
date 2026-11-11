// The kind of organization decides which opportunities the AI may recommend.
export const ORG_TYPES = {
  food_bank: 'Food bank or kitchen',
  faith: 'Faith community',
  environment: 'Environment or ocean',
  education: 'School or education',
  animal: 'Animal rescue',
  health: 'Health or medical',
  arts: 'Arts or culture',
  youth_sports: 'Youth sports',
  other: 'Other nonprofit',
} as const;
export type OrgType = keyof typeof ORG_TYPES;
export const ORG_TYPE_KEYS = Object.keys(ORG_TYPES) as [OrgType, ...OrgType[]];

export const TRADITIONS = {
  muslim: 'Muslim',
  christian: 'Christian',
  jewish: 'Jewish',
  hindu: 'Hindu',
  sikh: 'Sikh',
  other: 'Other',
} as const;
export type Tradition = keyof typeof TRADITIONS;
export const TRADITION_KEYS = Object.keys(TRADITIONS) as [Tradition, ...Tradition[]];

export type OrgProfile = { name: string; orgType: OrgType; tradition: Tradition | null };
