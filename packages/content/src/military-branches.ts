/**
 * Ticket 0902 — the five branches and what a person can do in each.
 *
 * Army, Navy, Marine Corps, Air Force and Coast Guard (no Space Force, as Payton chose). The branches share one engine
 * and one pay table; what differs is the table here: the titles of the ranks, the words for training and posts, the
 * age limit and the Smarts floor at the door, and four or five specialties each.
 *
 * Real and not: the rank titles are each branch's own. The maximum ages are the 2026 enlistment limits (Army 35,
 * Navy 41, Marine Corps 28, Air Force 42, Coast Guard 31), held to the game's own 35 ceiling. The Smarts floors come
 * from the minimum AFQT for a diploma holder (31 in four branches, 40 in the Coast Guard), which the game reads one
 * point lower (Army 30, from 0901) and nothing finer. The specialties are broad kinds of work each branch really does,
 * not any branch's own job codes. Which are open to whom, how dangerous each is, and what each is worth outside, are
 * judgements: `danger` is a weight 0903 will read and `skill` a tag 0904 will read; neither does anything yet.
 * Every post named is made up.
 */

import type { ServiceTrack } from './military-pay';

export const SERVICE_BRANCH_IDS = [
  'army',
  'navy',
  'marine-corps',
  'air-force',
  'coast-guard',
] as const;
export type ServiceBranchId = (typeof SERVICE_BRANCH_IDS)[number];

export interface ServiceBranchRow {
  readonly id: ServiceBranchId;
  /** "the Army", as it reads after "joined". */
  readonly name: string;
  /** "Army", as it reads in a header or a ledger line. */
  readonly short: string;
  /** "soldier". */
  readonly member: string;
  /** What the first year is called: "basic training", "boot camp". */
  readonly training: string;
  /** Weeks of it, for the lines. */
  readonly trainingWeeks: number;
  /** The school that makes an officer, as the branch names it. */
  readonly officerSchool: string;
  /** The branch's own limit on the age of an enlistment, and of an officer's commission. */
  readonly maxEnlistAge: number;
  readonly maxCommissionAge: number;
  /** The least Smarts the door takes. */
  readonly smartsFloor: number;
  /** Made-up posts, for the lines. Every one is fictional. */
  readonly posts: readonly string[];
  /** Enlisted grades E-1 to E-9, in the branch's own words, and their short forms. */
  readonly enlistedTitles: readonly string[];
  readonly enlistedAbbrs: readonly string[];
  /** Officer grades O-1 to O-6. */
  readonly officerTitles: readonly string[];
  readonly officerAbbrs: readonly string[];
}

const ARMY_LIKE_OFFICERS = [
  'Second Lieutenant',
  'First Lieutenant',
  'Captain',
  'Major',
  'Lieutenant Colonel',
  'Colonel',
];
const ARMY_LIKE_OFFICER_ABBRS = ['2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL'];
const SEA_OFFICERS = [
  'Ensign',
  'Lieutenant Junior Grade',
  'Lieutenant',
  'Lieutenant Commander',
  'Commander',
  'Captain',
];
const SEA_OFFICER_ABBRS = ['ENS', 'LTJG', 'LT', 'LCDR', 'CDR', 'CAPT'];
const SEA_ENLISTED = [
  'Seaman Recruit',
  'Seaman Apprentice',
  'Seaman',
  'Petty Officer Third Class',
  'Petty Officer Second Class',
  'Petty Officer First Class',
  'Chief Petty Officer',
  'Senior Chief Petty Officer',
  'Master Chief Petty Officer',
];
const SEA_ENLISTED_ABBRS = ['SR', 'SA', 'SN', 'PO3', 'PO2', 'PO1', 'CPO', 'SCPO', 'MCPO'];

export const SERVICE_BRANCHES: readonly ServiceBranchRow[] = [
  {
    id: 'army',
    name: 'the Army',
    short: 'Army',
    member: 'soldier',
    training: 'basic training',
    trainingWeeks: 10,
    officerSchool: 'Officer Candidate School',
    maxEnlistAge: 35,
    maxCommissionAge: 33,
    smartsFloor: 30,
    posts: ['Fort Harlan', 'Fort Carrow', 'Fort Medley', 'Fort Ostrander', 'Camp Verrill'],
    enlistedTitles: [
      'Private',
      'Private',
      'Private First Class',
      'Specialist',
      'Sergeant',
      'Staff Sergeant',
      'Sergeant First Class',
      'Master Sergeant',
      'Sergeant Major',
    ],
    enlistedAbbrs: ['PV1', 'PV2', 'PFC', 'SPC', 'SGT', 'SSG', 'SFC', 'MSG', 'SGM'],
    officerTitles: ARMY_LIKE_OFFICERS,
    officerAbbrs: ARMY_LIKE_OFFICER_ABBRS,
  },
  {
    id: 'navy',
    name: 'the Navy',
    short: 'Navy',
    member: 'sailor',
    training: 'boot camp',
    trainingWeeks: 8,
    officerSchool: 'Officer Candidate School',
    maxEnlistAge: 41,
    maxCommissionAge: 33,
    smartsFloor: 30,
    posts: [
      'Naval Station Corvin',
      'Naval Base Ashport',
      'Naval Station Tarrow',
      'Naval Base Linden Sound',
      'Naval Station Pell Harbor',
    ],
    enlistedTitles: SEA_ENLISTED,
    enlistedAbbrs: SEA_ENLISTED_ABBRS,
    officerTitles: SEA_OFFICERS,
    officerAbbrs: SEA_OFFICER_ABBRS,
  },
  {
    id: 'marine-corps',
    name: 'the Marine Corps',
    short: 'Marine Corps',
    member: 'Marine',
    training: 'boot camp',
    trainingWeeks: 13,
    officerSchool: 'Officer Candidates School',
    maxEnlistAge: 28,
    maxCommissionAge: 28,
    smartsFloor: 30,
    posts: ['Camp Dessen', 'Camp Ravick', 'Base Linholt', 'Camp Thessaly', 'Base Orcutt'],
    enlistedTitles: [
      'Private',
      'Private First Class',
      'Lance Corporal',
      'Corporal',
      'Sergeant',
      'Staff Sergeant',
      'Gunnery Sergeant',
      'Master Sergeant',
      'Sergeant Major',
    ],
    enlistedAbbrs: ['Pvt', 'PFC', 'LCpl', 'Cpl', 'Sgt', 'SSgt', 'GySgt', 'MSgt', 'SgtMaj'],
    officerTitles: ARMY_LIKE_OFFICERS,
    officerAbbrs: ARMY_LIKE_OFFICER_ABBRS,
  },
  {
    id: 'air-force',
    name: 'the Air Force',
    short: 'Air Force',
    member: 'airman',
    training: 'basic military training',
    trainingWeeks: 8,
    officerSchool: 'Officer Training School',
    maxEnlistAge: 42,
    maxCommissionAge: 33,
    smartsFloor: 30,
    posts: [
      'Hallen Air Force Base',
      'Corwin Air Force Base',
      'Marrow Air Force Base',
      'Teague Air Force Base',
      'Voss Air Force Base',
    ],
    enlistedTitles: [
      'Airman Basic',
      'Airman',
      'Airman First Class',
      'Senior Airman',
      'Staff Sergeant',
      'Technical Sergeant',
      'Master Sergeant',
      'Senior Master Sergeant',
      'Chief Master Sergeant',
    ],
    enlistedAbbrs: ['AB', 'Amn', 'A1C', 'SrA', 'SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt'],
    officerTitles: ARMY_LIKE_OFFICERS,
    officerAbbrs: ARMY_LIKE_OFFICER_ABBRS,
  },
  {
    id: 'coast-guard',
    name: 'the Coast Guard',
    short: 'Coast Guard',
    member: 'Coast Guardsman',
    training: 'boot camp',
    trainingWeeks: 8,
    officerSchool: 'Officer Candidate School',
    maxEnlistAge: 31,
    maxCommissionAge: 31,
    smartsFloor: 40,
    posts: [
      'Station Pelham',
      'Sector Garrow',
      'Base Ketterly',
      'Station Orrin',
      'Air Station Dunmore',
    ],
    enlistedTitles: SEA_ENLISTED,
    enlistedAbbrs: SEA_ENLISTED_ABBRS,
    officerTitles: SEA_OFFICERS,
    officerAbbrs: SEA_OFFICER_ABBRS,
  },
];

export const findServiceBranch = (id: string): ServiceBranchRow | undefined =>
  SERVICE_BRANCHES.find((row) => row.id === id);

export const isServiceBranchId = (value: unknown): value is ServiceBranchId =>
  typeof value === 'string' && (SERVICE_BRANCH_IDS as readonly string[]).includes(value);

/** The branch's own title for a grade on a ladder, in its own words. A grade out of range is the nearest one. */
export function rankTitle(branch: string, track: ServiceTrack, grade: number): string {
  const row = findServiceBranch(branch) ?? (SERVICE_BRANCHES[0] as ServiceBranchRow);
  const titles = track === 'officer' ? row.officerTitles : row.enlistedTitles;
  return titles[Math.max(1, Math.min(titles.length, Math.round(grade))) - 1] as string;
}

export function rankAbbr(branch: string, track: ServiceTrack, grade: number): string {
  const row = findServiceBranch(branch) ?? (SERVICE_BRANCHES[0] as ServiceBranchRow);
  const abbrs = track === 'officer' ? row.officerAbbrs : row.enlistedAbbrs;
  return abbrs[Math.max(1, Math.min(abbrs.length, Math.round(grade))) - 1] as string;
}

/* -------------------------------------------------------------------------- */
/* Specialties                                                                 */
/* -------------------------------------------------------------------------- */

/** What a specialty's skills are worth outside, for 0904 to read. */
export const SPECIALTY_SKILLS = [
  'combat',
  'medical',
  'mechanical',
  'technical',
  'security',
  'logistics',
  'maritime',
  'aviation',
] as const;
export type SpecialtySkill = (typeof SPECIALTY_SKILLS)[number];

export interface SpecialtyRow {
  /** `branch.slug`, unique across the table. */
  readonly id: string;
  readonly branch: ServiceBranchId;
  readonly name: string;
  /** The least Smarts, Health and Discipline it takes, beyond what the door asks. Absent is no extra bar. */
  readonly requires: {
    readonly smarts?: number;
    readonly health?: number;
    readonly discipline?: number;
  };
  /** 1 (mostly safe) to 3 (often in harm's way). 0903 reads it. */
  readonly danger: 1 | 2 | 3;
  readonly skill: SpecialtySkill;
}

/** The first row of each branch asks nothing beyond the door, so somebody who gets in always has something to choose. */
export const SPECIALTIES: readonly SpecialtyRow[] = [
  {
    id: 'army.infantry',
    branch: 'army',
    name: 'Infantry',
    requires: {},
    danger: 3,
    skill: 'combat',
  },
  {
    id: 'army.medic',
    branch: 'army',
    name: 'Combat Medic',
    requires: { smarts: 40 },
    danger: 2,
    skill: 'medical',
  },
  {
    id: 'army.mechanic',
    branch: 'army',
    name: 'Vehicle Mechanic',
    requires: { smarts: 35 },
    danger: 1,
    skill: 'mechanical',
  },
  {
    id: 'army.signal',
    branch: 'army',
    name: 'Signal Support',
    requires: { smarts: 50 },
    danger: 1,
    skill: 'technical',
  },
  {
    id: 'army.police',
    branch: 'army',
    name: 'Military Police',
    requires: { discipline: 50 },
    danger: 2,
    skill: 'security',
  },

  {
    id: 'navy.boatswain',
    branch: 'navy',
    name: "Boatswain's Mate",
    requires: {},
    danger: 2,
    skill: 'maritime',
  },
  {
    id: 'navy.corpsman',
    branch: 'navy',
    name: 'Hospital Corpsman',
    requires: { smarts: 45 },
    danger: 2,
    skill: 'medical',
  },
  {
    id: 'navy.machinist',
    branch: 'navy',
    name: "Machinist's Mate",
    requires: { smarts: 40 },
    danger: 2,
    skill: 'mechanical',
  },
  {
    id: 'navy.systems',
    branch: 'navy',
    name: 'Information Systems Technician',
    requires: { smarts: 55 },
    danger: 1,
    skill: 'technical',
  },
  {
    id: 'navy.aviation',
    branch: 'navy',
    name: 'Aviation Mechanic',
    requires: { smarts: 45 },
    danger: 2,
    skill: 'aviation',
  },

  {
    id: 'marine-corps.rifleman',
    branch: 'marine-corps',
    name: 'Rifleman',
    requires: {},
    danger: 3,
    skill: 'combat',
  },
  {
    id: 'marine-corps.engineer',
    branch: 'marine-corps',
    name: 'Combat Engineer',
    requires: { smarts: 40 },
    danger: 3,
    skill: 'combat',
  },
  {
    id: 'marine-corps.motor',
    branch: 'marine-corps',
    name: 'Motor Transport',
    requires: { smarts: 35 },
    danger: 1,
    skill: 'logistics',
  },
  {
    id: 'marine-corps.radio',
    branch: 'marine-corps',
    name: 'Radio Operator',
    requires: { smarts: 50 },
    danger: 1,
    skill: 'technical',
  },
  {
    id: 'marine-corps.ordnance',
    branch: 'marine-corps',
    name: 'Aviation Ordnance',
    requires: { smarts: 45 },
    danger: 2,
    skill: 'aviation',
  },

  {
    id: 'air-force.logistics',
    branch: 'air-force',
    name: 'Logistics Readiness',
    requires: {},
    danger: 1,
    skill: 'logistics',
  },
  {
    id: 'air-force.maintenance',
    branch: 'air-force',
    name: 'Aircraft Maintenance',
    requires: { smarts: 40 },
    danger: 1,
    skill: 'aviation',
  },
  {
    id: 'air-force.security',
    branch: 'air-force',
    name: 'Security Forces',
    requires: { discipline: 50 },
    danger: 2,
    skill: 'security',
  },
  {
    id: 'air-force.cyber',
    branch: 'air-force',
    name: 'Cyber Systems',
    requires: { smarts: 60 },
    danger: 1,
    skill: 'technical',
  },
  {
    id: 'air-force.medical',
    branch: 'air-force',
    name: 'Aerospace Medical Service',
    requires: { smarts: 50 },
    danger: 1,
    skill: 'medical',
  },

  {
    id: 'coast-guard.boatswain',
    branch: 'coast-guard',
    name: "Boatswain's Mate",
    requires: {},
    danger: 2,
    skill: 'maritime',
  },
  {
    id: 'coast-guard.machinery',
    branch: 'coast-guard',
    name: 'Machinery Technician',
    requires: { smarts: 45 },
    danger: 1,
    skill: 'mechanical',
  },
  {
    id: 'coast-guard.enforcement',
    branch: 'coast-guard',
    name: 'Maritime Enforcement',
    requires: { discipline: 50 },
    danger: 2,
    skill: 'security',
  },
  {
    id: 'coast-guard.health',
    branch: 'coast-guard',
    name: 'Health Services Technician',
    requires: { smarts: 50 },
    danger: 1,
    skill: 'medical',
  },
  {
    id: 'coast-guard.survival',
    branch: 'coast-guard',
    name: 'Aviation Survival Technician',
    requires: { health: 70, discipline: 55 },
    danger: 3,
    skill: 'aviation',
  },
];

export const specialtiesOf = (branch: string): readonly SpecialtyRow[] =>
  SPECIALTIES.filter((row) => row.branch === branch);

export const findSpecialty = (id: string): SpecialtyRow | undefined =>
  SPECIALTIES.find((row) => row.id === id);

/** The branch's open specialty, the one that asks for nothing extra. */
export const openSpecialtyOf = (branch: string): SpecialtyRow =>
  (specialtiesOf(branch)[0] ?? SPECIALTIES[0]) as SpecialtyRow;

export interface AptitudeStats {
  readonly smarts: number;
  readonly health: number;
  readonly discipline: number;
}

/** What stands between somebody and a specialty: the first stat that falls short, or nothing. */
export function specialtyBar(
  row: SpecialtyRow,
  stats: AptitudeStats,
): 'smarts' | 'health' | 'discipline' | undefined {
  if (row.requires.smarts !== undefined && stats.smarts < row.requires.smarts) return 'smarts';
  if (row.requires.health !== undefined && stats.health < row.requires.health) return 'health';
  if (row.requires.discipline !== undefined && stats.discipline < row.requires.discipline) {
    return 'discipline';
  }
  return undefined;
}
